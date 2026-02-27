/**
 * MovementController - High-level movement API for bots
 * 
 * Combines PhysicsEngine and InputGenerator to produce valid
 * player_auth_input packets at the correct tick rate.
 * 
 * @module src/movement/MovementController
 */

const { PhysicsEngine, PHYSICS } = require('./PhysicsEngine')
const { InputGenerator, InputFlags, INPUT_BASE } = require('./InputGenerator')

class MovementController {
    constructor(bot) {
        this.bot = bot
        this.physics = new PhysicsEngine()
        this.inputGen = new InputGenerator()
        
        this.tickInterval = null
        this.isRunning = false
        
        // Current movement intent
        this.intent = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sneak: false,
            sprint: false
        }

        // Bind server correction handler
        this._setupBotListeners()
    }

    /**
     * Setup listeners for server feedback
     * @private
     */
    _setupBotListeners() {
        // Sync position from start_game
        this.bot.on('start_game', (packet) => {
            if (packet.player_position) {
                this.physics.setPosition(packet.player_position)
            }
        })

        // Handle server corrections - CRITICAL for preventing desync
        this.bot.on('move_correction', (packet) => {
            if (packet.position) {
                this.physics.correctPosition(packet.position)
            }
        })

        // Handle direct position updates
        this.bot.on('move_player', (packet) => {
            if (packet.position) {
                this.physics.setPosition(packet.position)
            }
        })
    }

    /**
     * Start the movement loop (20 ticks/second)
     */
    start() {
        if (this.isRunning) return
        
        console.log('[MovementController] Starting movement loop')
        this.isRunning = true
        
        this.tickInterval = setInterval(() => {
            this._tick()
        }, PHYSICS.TICK_DURATION)
    }

    /**
     * Stop the movement loop
     */
    stop() {
        if (!this.isRunning) return
        
        console.log('[MovementController] Stopping movement loop')
        this.isRunning = false
        
        if (this.tickInterval) {
            clearInterval(this.tickInterval)
            this.tickInterval = null
        }
    }

    /**
     * Set movement direction
     * @param {'forward'|'backward'|'left'|'right'|'none'} direction
     */
    setDirection(direction) {
        // Reset all directions
        this.intent.forward = false
        this.intent.backward = false
        this.intent.left = false
        this.intent.right = false

        if (direction !== 'none') {
            this.intent[direction] = true
        }
    }

    /**
     * Start moving forward
     */
    moveForward() {
        this.intent.forward = true
        this.intent.backward = false
    }

    /**
     * Stop all movement
     */
    stopMoving() {
        this.intent.forward = false
        this.intent.backward = false
        this.intent.left = false
        this.intent.right = false
    }

    /**
     * Toggle sprint
     * @param {boolean} enabled
     */
    setSprint(enabled) {
        this.intent.sprint = enabled
    }

    /**
     * Toggle sneak
     * @param {boolean} enabled
     */
    setSneak(enabled) {
        this.intent.sneak = enabled
    }

    /**
     * Single jump
     */
    jump() {
        this.intent.jump = true
        // Auto-clear jump after one tick
        setTimeout(() => {
            this.intent.jump = false
        }, PHYSICS.TICK_DURATION)
    }

    /**
     * Execute one movement tick
     * @private
     */
    _tick() {
        if (!this.bot.state.isSpawned) return

        try {
            // Calculate physics delta
            const delta = this.physics.tick(this.bot.state.yaw, this.intent)
            const state = this.physics.getState()

            // Build input_data flags
            this.inputGen.reset()
            if (this.intent.forward) this.inputGen.move('forward')
            if (this.intent.backward) this.inputGen.move('backward')
            if (this.intent.left) this.inputGen.move('left')
            if (this.intent.right) this.inputGen.move('right')
            if (this.intent.sprint) this.inputGen.sprint()
            if (this.intent.sneak) this.inputGen.sneak()
            if (this.intent.jump) this.inputGen.jump()
            
            // CRITICAL: Set vertical_collision when on ground!
            if (state.isOnGround) this.inputGen.onGround()

            // Build packet
            const packet = {
                pitch: this.bot.state.pitch,
                yaw: this.bot.state.yaw,
                position: { 
                    x: state.position.x, 
                    y: state.position.y, 
                    z: state.position.z 
                },
                move_vector: { 
                    x: this.intent.left ? -1 : (this.intent.right ? 1 : 0), 
                    z: this.intent.forward ? 1 : (this.intent.backward ? -1 : 0)
                },
                head_yaw: this.bot.state.yaw,
                input_data: this.inputGen.build(),
                input_mode: 'mouse',
                play_mode: 'screen',
                interaction_model: 'touch',
                interact_rotation: { x: this.bot.state.pitch, z: this.bot.state.yaw },
                tick: this.bot.state.serverTick,
                delta: delta,
                analogue_move_vector: { x: 0, z: 0 },
                camera_orientation: { x: 0, y: 0, z: 0 },
                raw_move_vector: { 
                    x: this.intent.left ? -1 : (this.intent.right ? 1 : 0), 
                    z: this.intent.forward ? 1 : (this.intent.backward ? -1 : 0)
                }
            }

            // Send packet
            this.bot.send('player_auth_input', packet)

            // Increment tick counter
            this.bot.state.serverTick++

            // Debug logging (every 40 ticks = 2 seconds)
            if (this.bot.state.serverTick % 40n === 0n) {
                console.log(`[Movement] Tick ${this.bot.state.serverTick} | Pos: ${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)}`)
            }

        } catch (err) {
            console.error('[MovementController] Tick error:', err.message)
        }
    }

    /**
     * Get current position
     * @returns {object}
     */
    getPosition() {
        return this.physics.getState().position
    }
}

module.exports = MovementController
