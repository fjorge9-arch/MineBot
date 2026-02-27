/**
 * Server Auth Bot - Let server handle position, only send input flags
 * 
 * The server seems to reject client position predictions.
 * This bot only sends input flags and lets the server calculate movement.
 */

const { createClient } = require('bedrock-protocol')

const INPUT_BASE = 281474976710656n
const INPUT_UP = 1n << 10n                    // W key
const INPUT_VERTICAL_COLLISION = 1n << 50n    // On ground

class ServerAuthBot {
    constructor() {
        this.client = null
        this.position = { x: 0, y: 64, z: 0 }
        this.spawnPosition = null
        this.serverTick = 0n
        this.yaw = 0
        this.tickCount = 0
        this.moveInterval = null
    }

    connect() {
        console.log('='.repeat(60))
        console.log('[ServerAuthBot] Testing server-authoritative movement')
        console.log('(Not updating position locally, letting server move us)')
        console.log('='.repeat(60))

        this.client = createClient({
            host: '127.0.0.1',
            port: 19132,
            username: 'ServerAuthBot',
            offline: true,
            skipPing: true
        })

        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.position = { ...packet.player_position }
                this.spawnPosition = { ...packet.player_position }
                console.log(`[Spawn] ${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}`)
            }
            if (packet.current_tick) {
                this.serverTick = BigInt(packet.current_tick)
            }
            
            // Log server movement settings
            console.log('Server auth:', packet.server_authoritative_movement)
            console.log('Rewind history:', packet.rewind_history_size)
        })

        this.client.on('spawn', () => {
            console.log('[ServerAuthBot] Spawned! Starting in 2s...')
            setTimeout(() => this.startMovement(), 2000)
        })

        this.client.on('move_player', (packet) => {
            if (packet.position) {
                this.position = { ...packet.position }
            }
        })

        this.client.on('correct_player_move_prediction', (packet) => {
            console.log('[PREDICTION REJECTED]')
        })

        this.client.on('error', (err) => {
            console.error('Error:', err.message)
        })
    }

    startMovement() {
        console.log('\n[ServerAuthBot] Sending input flags (server moves us)...\n')
        
        this.moveInterval = setInterval(() => {
            this.tickCount++
            this.serverTick += 1n
            
            // DON'T update position - let server do it
            // Just send input flags indicating "I want to move forward"
            
            const inputData = INPUT_BASE | INPUT_UP | INPUT_VERTICAL_COLLISION
            
            const packet = {
                pitch: 0,
                yaw: this.yaw,
                position: { ...this.position },  // Use SERVER position
                move_vector: { x: 0, z: 1 },     // Forward
                head_yaw: this.yaw,
                input_data: inputData,
                input_mode: 'mouse',
                play_mode: 'screen',
                interaction_model: 'touch',
                interact_rotation: { x: 0, z: this.yaw },
                tick: this.serverTick,
                delta: { x: 0, y: 0, z: 0 },     // No delta - let server calculate
                analogue_move_vector: { x: 0, z: 0 },
                camera_orientation: { x: 0, y: 0, z: 0 },
                raw_move_vector: { x: 0, z: 1 }  // Forward
            }

            this.client.queue('player_auth_input', packet)

            // Log position every 2 seconds
            if (this.tickCount % 40 === 0) {
                const dx = this.position.x - this.spawnPosition.x
                const dz = this.position.z - this.spawnPosition.z
                const dist = Math.sqrt(dx*dx + dz*dz)
                console.log(`Tick ${this.tickCount} | Pos: ${this.position.x.toFixed(2)}, ${this.position.z.toFixed(2)} | Distance: ${dist.toFixed(2)}`)
            }
        }, 50)

        // Stop after 15 seconds
        setTimeout(() => this.stop(), 15000)
    }

    stop() {
        console.log('\n[ServerAuthBot] Done!')
        if (this.moveInterval) {
            clearInterval(this.moveInterval)
        }
        
        const dx = this.position.x - this.spawnPosition.x
        const dz = this.position.z - this.spawnPosition.z
        console.log(`Final distance: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)} blocks`)
        
        if (this.client) this.client.close()
        process.exit(0)
    }
}

const bot = new ServerAuthBot()
bot.connect()
process.on('SIGINT', () => bot.stop())
