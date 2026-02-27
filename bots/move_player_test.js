/**
 * Move Player Bot - Try using move_player packet directly
 */

const { createClient } = require('bedrock-protocol')

class MovePlayerBot {
    constructor() {
        this.client = null
        this.position = { x: 0, y: 64, z: 0 }
        this.spawnPosition = null
        this.tickCount = 0
        this.yaw = 0
    }

    connect() {
        console.log('[MovePlayerBot] Testing move_player packet...')

        this.client = createClient({
            host: '127.0.0.1',
            port: 19132,
            username: 'MoveBot',
            offline: true,
            skipPing: true
        })

        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.position = { ...packet.player_position }
                this.spawnPosition = { ...packet.player_position }
            }
            this.runtimeId = packet.runtime_entity_id
            console.log('Runtime ID:', this.runtimeId)
        })

        this.client.on('spawn', () => {
            console.log('[MovePlayerBot] Spawned at:', this.position)
            setTimeout(() => this.startMovement(), 2000)
        })

        this.client.on('move_player', (packet) => {
            if (packet.position) {
                this.position = { ...packet.position }
            }
        })

        this.client.on('error', (err) => {
            console.error('Error:', err.message)
        })
    }

    startMovement() {
        console.log('[MovePlayerBot] Sending move_player packets...\n')
        
        const interval = setInterval(() => {
            this.tickCount++
            
            // Move forward
            const speed = 0.1
            const radYaw = (this.yaw * Math.PI) / 180
            this.position.x += -Math.sin(radYaw) * speed
            this.position.z += Math.cos(radYaw) * speed

            // Send move_player packet
            this.client.queue('move_player', {
                runtime_id: Number(this.runtimeId),
                position: { ...this.position },
                pitch: 0,
                yaw: this.yaw,
                head_yaw: this.yaw,
                mode: 'normal',
                on_ground: true,
                tick: this.tickCount
            })

            // Log every 2 seconds
            if (this.tickCount % 40 === 0) {
                const dx = this.position.x - this.spawnPosition.x
                const dz = this.position.z - this.spawnPosition.z
                console.log(`Tick ${this.tickCount} | Distance: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)}`)
            }
        }, 50)

        setTimeout(() => {
            clearInterval(interval)
            const dx = this.position.x - this.spawnPosition.x
            const dz = this.position.z - this.spawnPosition.z
            console.log(`\nFinal distance: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)} blocks`)
            this.client.close()
            process.exit(0)
        }, 10000)
    }
}

const bot = new MovePlayerBot()
bot.connect()
