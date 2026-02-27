/**
 * Reactive Bot - Only sends input in response to server move_player
 * 
 * Theory: Server expects us to respond to its tick, not initiate our own
 */

const { createClient } = require('bedrock-protocol')

const FLAGS = {
    UP: 1n << 10n,
    BASE: 1n << 48n,
    VERTICAL_COLLISION: 1n << 50n
}

class ReactiveBot {
    constructor() {
        this.client = null
        this.position = { x: 0, y: 64, z: 0 }
        this.spawnPosition = null
        this.serverTick = 0n
        this.yaw = 0
        this.isMoving = false
        this.moveCount = 0
    }

    connect() {
        console.log('[ReactiveBot] Responding to server move_player packets')

        this.client = createClient({
            host: '127.0.0.1',
            port: 19132,
            username: 'ReactiveBot',
            offline: true,
            skipPing: true
        })

        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.position = { ...packet.player_position }
                this.spawnPosition = { ...packet.player_position }
            }
            if (packet.current_tick) {
                this.serverTick = BigInt(packet.current_tick)
            }
        })

        this.client.on('spawn', () => {
            console.log('[ReactiveBot] Spawned at:', this.position)
            console.log('[ReactiveBot] Will start moving after first move_player from server')
            
            // Start moving flag after 2 seconds
            setTimeout(() => {
                console.log('[ReactiveBot] Now responding to server with movement input')
                this.isMoving = true
            }, 2000)
            
            // Stop after 20 seconds
            setTimeout(() => this.stop(), 20000)
        })

        // React to EVERY move_player from server
        this.client.on('move_player', (packet) => {
            if (packet.position) {
                this.position = { ...packet.position }
            }
            if (packet.tick) {
                this.serverTick = BigInt(packet.tick)
            }
            
            if (this.isMoving) {
                this.moveCount++
                this.respondWithMovement()
                
                if (this.moveCount % 20 === 0) {
                    const dx = this.position.x - this.spawnPosition.x
                    const dz = this.position.z - this.spawnPosition.z
                    console.log(`Response #${this.moveCount} | Distance: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)}`)
                }
            }
        })

        this.client.on('error', (err) => {
            console.error('Error:', err.message)
        })
    }

    respondWithMovement() {
        const flags = FLAGS.BASE | FLAGS.UP | FLAGS.VERTICAL_COLLISION
        
        const speed = 0.1
        const radYaw = (this.yaw * Math.PI) / 180
        const deltaX = -Math.sin(radYaw) * speed
        const deltaZ = Math.cos(radYaw) * speed

        const packet = {
            pitch: 0,
            yaw: this.yaw,
            position: { ...this.position },
            move_vector: { x: 0, z: 1 },
            head_yaw: this.yaw,
            input_data: flags,
            input_mode: 'mouse',
            play_mode: 'screen',
            interaction_model: 'touch',
            interact_rotation: { x: 0, z: this.yaw },
            tick: this.serverTick,
            delta: { x: deltaX, y: 0, z: deltaZ },
            analogue_move_vector: { x: 0, z: 0 },
            camera_orientation: { x: 0, y: 0, z: 0 },
            raw_move_vector: { x: 0, z: 1 }
        }

        this.client.queue('player_auth_input', packet)
    }

    stop() {
        console.log('\n[ReactiveBot] Done!')
        const dx = this.position.x - this.spawnPosition.x
        const dz = this.position.z - this.spawnPosition.z
        console.log(`Final distance: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)} blocks`)
        console.log(`Total responses: ${this.moveCount}`)
        this.client.close()
        process.exit(0)
    }
}

const bot = new ReactiveBot()
bot.connect()
