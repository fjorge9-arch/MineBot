/**
 * Raw Movement Bot - Test raw packet values to find working movement
 * 
 * Tests exact packet values that should work based on protocol analysis
 */

const { createClient } = require('bedrock-protocol')

// Valores exatos de um cliente real (analisados anteriormente)
const INPUT_BASE = 281474976710656n
const INPUT_UP = 1n << 10n                    // 1024n - W key
const INPUT_VERTICAL_COLLISION = 1n << 50n    // On ground
const INPUT_WANT_UP = 1n << 16n               // Want move up

class RawMoveBot {
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
        console.log('[RawMoveBot] Testing raw movement packets')
        console.log('='.repeat(60))

        this.client = createClient({
            host: '127.0.0.1',
            port: 19132,
            username: 'RawMoveBot',
            offline: true,
            skipPing: true
        })

        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.position = { ...packet.player_position }
                this.spawnPosition = { ...packet.player_position }
                console.log(`[RawMoveBot] Spawn: ${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}`)
            }
            if (packet.current_tick) {
                this.serverTick = BigInt(packet.current_tick)
            }
        })

        this.client.on('spawn', () => {
            console.log('[RawMoveBot] Spawned! Testing movement in 2s...')
            setTimeout(() => this.startMovement(), 2000)
        })

        this.client.on('move_player', (packet) => {
            if (packet.position) {
                const oldPos = { ...this.position }
                this.position = { ...packet.position }
                
                // Log se servidor moveu o jogador
                const dx = this.position.x - oldPos.x
                const dz = this.position.z - oldPos.z
                if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                    console.log(`[SERVER MOVE] dx=${dx.toFixed(3)}, dz=${dz.toFixed(3)}`)
                }
            }
        })

        this.client.on('correct_player_move_prediction', (packet) => {
            console.log('[REJECT] Server rejected our position!')
            console.log('  Predicted:', packet.prediction)
            console.log('  Position:', packet.position)
        })

        this.client.on('error', (err) => {
            console.error('[RawMoveBot] Error:', err.message)
        })
    }

    startMovement() {
        console.log('\n[RawMoveBot] Starting movement test...\n')
        
        // Tentar diferentes combinações de flags
        const tests = [
            { name: 'UP only', flags: INPUT_UP },
            { name: 'UP + VERT_COL', flags: INPUT_UP | INPUT_VERTICAL_COLLISION },
            { name: 'UP + WANT_UP', flags: INPUT_UP | INPUT_WANT_UP },
            { name: 'UP + VERT_COL + WANT_UP', flags: INPUT_UP | INPUT_VERTICAL_COLLISION | INPUT_WANT_UP },
            { name: 'VERT_COL only', flags: INPUT_VERTICAL_COLLISION },
            { name: 'WANT_UP only', flags: INPUT_WANT_UP },
        ]

        let testIndex = 0
        let ticksPerTest = 60  // 3 seconds per test
        
        this.moveInterval = setInterval(() => {
            this.tickCount++
            
            const currentTest = tests[testIndex]
            if (!currentTest) {
                this.stop()
                return
            }

            // Calculate movement delta
            const speed = 0.1  // blocks per tick
            const radYaw = (this.yaw * Math.PI) / 180
            const deltaX = -Math.sin(radYaw) * speed
            const deltaZ = Math.cos(radYaw) * speed
            
            // Update local position (client-side prediction)
            this.position.x += deltaX
            this.position.z += deltaZ
            
            // Build input flags
            const inputData = INPUT_BASE | currentTest.flags
            
            const packet = {
                pitch: 0,
                yaw: this.yaw,
                position: { ...this.position },
                move_vector: { x: 0, z: 1 },  // Forward
                head_yaw: this.yaw,
                input_data: inputData,
                input_mode: 'mouse',
                play_mode: 'screen',
                interaction_model: 'touch',
                interact_rotation: { x: 0, z: this.yaw },
                tick: this.serverTick,
                delta: { x: deltaX, y: 0, z: deltaZ },
                analogue_move_vector: { x: 0, z: 0 },
                camera_orientation: { x: 0, y: 0, z: 0 },
                raw_move_vector: { x: 0, z: 1 }  // Forward
            }

            this.client.queue('player_auth_input', packet)
            this.serverTick += 1n

            // Log every second
            if (this.tickCount % 20 === 0) {
                const dx = this.position.x - this.spawnPosition.x
                const dz = this.position.z - this.spawnPosition.z
                const dist = Math.sqrt(dx*dx + dz*dz)
                console.log(`[Test: ${currentTest.name}] Tick ${this.tickCount} | Distance: ${dist.toFixed(2)}`)
            }

            // Switch to next test
            if (this.tickCount % ticksPerTest === 0) {
                console.log(`\n--- Test "${currentTest.name}" complete ---\n`)
                testIndex++
                if (tests[testIndex]) {
                    console.log(`Starting test: ${tests[testIndex].name}`)
                }
            }
        }, 50) // 20 ticks/s
    }

    stop() {
        console.log('\n[RawMoveBot] Test complete!')
        if (this.moveInterval) {
            clearInterval(this.moveInterval)
        }
        
        if (this.spawnPosition) {
            const dx = this.position.x - this.spawnPosition.x
            const dz = this.position.z - this.spawnPosition.z
            console.log(`Final distance from spawn: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)} blocks`)
        }
        
        if (this.client) {
            this.client.close()
        }
        process.exit(0)
    }
}

const bot = new RawMoveBot()
bot.connect()

process.on('SIGINT', () => bot.stop())
