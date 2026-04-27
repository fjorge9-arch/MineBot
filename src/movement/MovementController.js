/**
 * MovementController - High-level movement API for bots
 *
 * Combines PhysicsEngine and InputGenerator to produce valid
 * player_auth_input packets at the correct tick rate.
 */

const { PhysicsEngine, PHYSICS } = require('./PhysicsEngine')
const { InputGenerator, InputFlags, INPUT_BASE } = require('./InputGenerator')
const { cameraOrientation } = require('../utils/helpers')

class MovementController {
    constructor(bot) {
        this.bot      = bot
        this.physics  = new PhysicsEngine()
        this.inputGen = new InputGenerator()

        this.tickInterval = null
        this.isRunning    = false
        this._tickCount   = 0

        // Callback fired at the start of each physics tick (before intent is read).
        // Use this to drive behaviour from the same loop as physics.
        this.onTick = null

        // Current movement intent
        this.intent = {
            forward:  false,
            backward: false,
            left:     false,
            right:    false,
            jump:     false,
            sneak:    false,
            sprint:   false
        }

        this._setupBotListeners()
    }

    _setupBotListeners() {
        this.bot.on('start_game', (packet) => {
            if (packet.player_position) {
                this.physics.setPosition(packet.player_position)
                // Ground level = spawn y
                this.physics.setGroundY(packet.player_position.y)
            }
        })

        // Server correction: realign physics position and tick counter
        this.bot.on('move_correction', (packet) => {
            if (packet.position) {
                this.physics.correctPosition(packet.position)
            }
            if (packet.tick != null) {
                const serverTick = BigInt(packet.tick)
                if (serverTick !== this.bot.state.serverTick) {
                    console.log(`[MovementController] Tick resync: ${this.bot.state.serverTick} → ${serverTick}`)
                    this.bot.state.serverTick = serverTick
                }
            }
        })

        // BaseBot emits 'position_corrected' when start_game gave a placeholder Y and
        // the real world Y was determined from the first plausible move_player packet.
        this.bot.on('position_corrected', (pos) => {
            this.physics.setPosition(pos)
            this.physics.setGroundY(pos.y)
            console.log(`[MovementController] Physics Y corrected to ${pos.y.toFixed(2)}`)
        })

        // Authoritative teleports from the server also need to update physics.
        this.bot.on('move_player', (packet) => {
            if (packet.position && (packet.mode === 'reset' || packet.mode === 'teleport')) {
                this.physics.setPosition(packet.position)
                this.physics.setGroundY(packet.position.y)
                console.log(`[MovementController] Position ${packet.mode} → y=${packet.position.y.toFixed(2)}`)
            }
        })
    }

    start() {
        if (this.isRunning) return

        // Advance tick counter to match server's current tick.
        // From start_game to here, the server has been ticking at 20Hz
        // while we haven't sent any packets — correct for that drift.
        if (this.bot._startGameTime) {
            const elapsed = Date.now() - this.bot._startGameTime
            const drift = BigInt(Math.round(elapsed / PHYSICS.TICK_DURATION))
            this.bot.state.serverTick += drift
            console.log(`[MovementController] Tick sync: +${drift} ticks (${elapsed}ms since start_game)`)
        }

        console.log('[MovementController] Starting movement loop')
        this.isRunning    = true
        this.tickInterval = setInterval(() => this._tick(), PHYSICS.TICK_DURATION)
    }

    stop() {
        if (!this.isRunning) return
        console.log('[MovementController] Stopping movement loop')
        this.isRunning = false
        if (this.tickInterval) {
            clearInterval(this.tickInterval)
            this.tickInterval = null
        }
    }

    setDirection(direction) {
        this.intent.forward  = false
        this.intent.backward = false
        this.intent.left     = false
        this.intent.right    = false
        if (direction !== 'none') this.intent[direction] = true
    }

    moveForward()  { this.intent.forward = true;  this.intent.backward = false }
    stopMoving()   { this.intent.forward = false; this.intent.backward = false; this.intent.left = false; this.intent.right = false }
    setSprint(on)  { this.intent.sprint = on }
    setSneak(on)   { this.intent.sneak  = on }

    jump() {
        this.intent.jump = true
        setTimeout(() => { this.intent.jump = false }, PHYSICS.TICK_DURATION)
    }

    _tick() {
        if (!this.bot.state.isSpawned) return

        try {
            if (this.onTick) this.onTick(this._tickCount)
            this._tickCount++

            const yaw      = this.bot.state.yaw
            const pitch    = this.bot.state.pitch
            const delta    = this.physics.tick(yaw, this.intent)
            const state    = this.physics.getState()

            // --- Build input_data flags ---
            this.inputGen.reset()
            if (this.intent.forward)  this.inputGen.move('forward')
            if (this.intent.backward) this.inputGen.move('backward')
            if (this.intent.left)     this.inputGen.move('left')
            if (this.intent.right)    this.inputGen.move('right')
            if (this.intent.sprint)   this.inputGen.sprint()
            if (this.intent.sneak)    this.inputGen.sneak()
            if (this.intent.jump)     this.inputGen.jump()
            // VERTICAL_COLLISION: only when gravity was active and ground stopped us
            if (state.hadVerticalCollision) this.inputGen.onGround()

            const camOrientation = cameraOrientation(yaw, pitch)

            // --- Move vectors ---
            const moveVecX = this.intent.left ? -1 : (this.intent.right   ? 1 : 0)
            const moveVecZ = this.intent.forward ? 1 : (this.intent.backward ? -1 : 0)

            const packet = {
                pitch,
                yaw,
                position:       { x: state.position.x, y: state.position.y, z: state.position.z },
                move_vector:    { x: moveVecX, z: moveVecZ },
                head_yaw:       yaw,
                input_data:     this.inputGen.build(),
                input_mode:     'mouse',
                play_mode:      'screen',
                interaction_model: 'touch',
                interact_rotation: { x: pitch, z: yaw },
                tick:           this.bot.state.serverTick,
                delta,
                analogue_move_vector: { x: 0, z: 0 },
                camera_orientation:   camOrientation,
                raw_move_vector: { x: moveVecX, z: moveVecZ }
            }

            this.bot.send('player_auth_input', packet)
            this.bot.state.serverTick++

            if (this.bot.state.serverTick % 40n === 0n) {
                const p = state.position
                console.log(`[Movement] Tick ${this.bot.state.serverTick} | Pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} | Ground: ${state.isOnGround}`)
            }

        } catch (err) {
            console.error('[MovementController] Tick error:', err.message)
        }
    }

    getPosition() {
        return this.physics.getState().position
    }
}

module.exports = MovementController
