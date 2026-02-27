/**
 * Hardware Input Bot - Simulates keyboard input more accurately
 * 
 * Tests different input flag combinations including START events
 */

const { createClient } = require('bedrock-protocol')

// Input flags (bits)
const FLAGS = {
    ASCEND: 1n << 0n,
    DESCEND: 1n << 1n,
    NORTH_JUMP: 1n << 2n,
    JUMP_DOWN: 1n << 3n,
    SPRINT_DOWN: 1n << 4n,
    CHANGE_HEIGHT: 1n << 5n,
    JUMPING: 1n << 6n,
    AUTO_JUMPING_IN_WATER: 1n << 7n,
    SNEAKING: 1n << 8n,
    SNEAK_DOWN: 1n << 9n,
    UP: 1n << 10n,           // W key
    DOWN: 1n << 11n,         // S key
    LEFT: 1n << 12n,         // A key
    RIGHT: 1n << 13n,        // D key
    UP_LEFT: 1n << 14n,
    UP_RIGHT: 1n << 15n,
    WANT_UP: 1n << 16n,
    WANT_DOWN: 1n << 17n,
    WANT_DOWN_SLOW: 1n << 18n,
    WANT_UP_SLOW: 1n << 19n,
    SPRINTING: 1n << 20n,
    ASCEND_BLOCK: 1n << 21n,
    DESCEND_BLOCK: 1n << 22n,
    SNEAK_TOGGLE_DOWN: 1n << 23n,
    PERSIST_SNEAK: 1n << 24n,
    START_SPRINTING: 1n << 25n,
    STOP_SPRINTING: 1n << 26n,
    START_SNEAKING: 1n << 27n,
    STOP_SNEAKING: 1n << 28n,
    START_SWIMMING: 1n << 29n,
    STOP_SWIMMING: 1n << 30n,
    START_JUMPING: 1n << 31n,
    START_GLIDING: 1n << 32n,
    STOP_GLIDING: 1n << 33n,
    ITEM_INTERACT: 1n << 34n,
    BLOCK_ACTIONS: 1n << 35n,
    ITEM_STACK_REQ: 1n << 36n,
    HANDLED_TELEPORT: 1n << 37n,
    EMOTING: 1n << 38n,
    BASE: 1n << 48n,         // Always set
    VERTICAL_COLLISION: 1n << 50n,  // On ground
    HORIZONTAL_COLLISION: 1n << 51n
}

class HardwareInputBot {
    constructor() {
        this.client = null
        this.position = { x: 0, y: 64, z: 0 }
        this.spawnPosition = null
        this.serverTick = 0n
        this.yaw = 0
        this.tickCount = 0
    }

    connect() {
        console.log('[HardwareInputBot] Testing hardware-like input')

        this.client = createClient({
            host: '127.0.0.1',
            port: 19132,
            username: 'HWInputBot',
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
            console.log('[HardwareInputBot] Spawned at:', this.position)
            setTimeout(() => this.startTest(), 2000)
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

    sendInput(flags, description) {
        this.serverTick += 1n
        
        // Calculate movement based on yaw
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
            input_mode: 'keyboard_and_mouse',  // Changed!
            play_mode: 'screen',
            interaction_model: 'crosshair',    // Changed!
            interact_rotation: { x: 0, z: this.yaw },
            tick: this.serverTick,
            delta: { x: deltaX, y: 0, z: deltaZ },
            analogue_move_vector: { x: 0, z: 0 },
            camera_orientation: { x: 0, y: 0, z: 0 },
            raw_move_vector: { x: 0, z: 1 }
        }

        this.client.queue('player_auth_input', packet)
    }

    async startTest() {
        console.log('\n[HardwareInputBot] Starting input tests...\n')

        // Test 1: Standard movement (what we've been using)
        console.log('Test 1: Standard UP + VERTICAL_COLLISION')
        const standardFlags = FLAGS.BASE | FLAGS.UP | FLAGS.VERTICAL_COLLISION
        for (let i = 0; i < 40; i++) {
            this.sendInput(standardFlags, 'standard')
            await this.delay(50)
        }
        this.logDistance('Test 1')

        // Test 2: Add WANT_UP
        console.log('Test 2: + WANT_UP')
        const wantUpFlags = FLAGS.BASE | FLAGS.UP | FLAGS.VERTICAL_COLLISION | FLAGS.WANT_UP
        for (let i = 0; i < 40; i++) {
            this.sendInput(wantUpFlags, 'want_up')
            await this.delay(50)
        }
        this.logDistance('Test 2')

        // Test 3: Add ASCEND
        console.log('Test 3: + ASCEND')
        const ascendFlags = FLAGS.BASE | FLAGS.UP | FLAGS.VERTICAL_COLLISION | FLAGS.ASCEND
        for (let i = 0; i < 40; i++) {
            this.sendInput(ascendFlags, 'ascend')
            await this.delay(50)
        }
        this.logDistance('Test 3')

        // Test 4: Sprint
        console.log('Test 4: + SPRINTING + START_SPRINTING')
        const sprintFlags = FLAGS.BASE | FLAGS.UP | FLAGS.VERTICAL_COLLISION | FLAGS.SPRINTING | FLAGS.START_SPRINTING
        for (let i = 0; i < 40; i++) {
            this.sendInput(sprintFlags, 'sprint')
            await this.delay(50)
        }
        this.logDistance('Test 4')

        // Test 5: Without updating position locally
        console.log('Test 5: UP only (no vertical collision)')
        const upOnlyFlags = FLAGS.BASE | FLAGS.UP
        for (let i = 0; i < 40; i++) {
            this.sendInput(upOnlyFlags, 'up_only')
            await this.delay(50)
        }
        this.logDistance('Test 5')

        // Test 6: JUMP to test if server responds
        console.log('Test 6: JUMP test')
        const jumpFlags = FLAGS.BASE | FLAGS.VERTICAL_COLLISION | FLAGS.JUMPING | FLAGS.START_JUMPING | FLAGS.JUMP_DOWN
        for (let i = 0; i < 40; i++) {
            this.sendInput(jumpFlags, 'jump')
            await this.delay(50)
        }
        this.logDistance('Test 6')

        console.log('\n[HardwareInputBot] Tests complete!')
        this.client.close()
        process.exit(0)
    }

    logDistance(test) {
        const dx = this.position.x - this.spawnPosition.x
        const dz = this.position.z - this.spawnPosition.z
        console.log(`  ${test} Distance: ${Math.sqrt(dx*dx + dz*dz).toFixed(2)} blocks\n`)
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

const bot = new HardwareInputBot()
bot.connect()
