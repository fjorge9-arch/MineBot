/**
 * Episode - Single evaluation run for a genome
 *
 * Uses the same PhysicsEngine/InputGenerator as the walker bot so that
 * evolved genomes generalise to real movement.
 *
 * Fitness is based exclusively on server-reported position (move_player /
 * correct_player_move_prediction), NOT on local physics predictions.
 */

const { createClient }  = require('bedrock-protocol')
const { PhysicsEngine } = require('../movement/PhysicsEngine')
const { InputGenerator, INPUT_BASE } = require('../movement/InputGenerator')
const { cameraOrientation, distance2D } = require('../utils/helpers')

// Flags referenced by genome boolean genes
const INPUT_UP                = 1n << 10n
const INPUT_VERTICAL_COLLISION = 1n << 50n
const INPUT_WANT_UP           = 1n << 16n

class Episode {
    constructor(genome, config = {}) {
        this.genome = genome
        this.config = {
            host:     config.host     || '127.0.0.1',
            port:     config.port     || 19132,
            duration: config.duration || 5000,
            tickRate: config.tickRate || 50,
            username: config.username || `EvoBot_${Date.now() % 10000}`,
            ...config
        }

        this.client  = null
        this.physics = new PhysicsEngine()
        this.inputGen = new InputGenerator()

        this.state = {
            yaw:          0,
            pitch:        0,
            serverTick:   0n,
            isSpawned:    false,
            tickCount:    0,
            spawnPosition:  null,
            // Server-authoritative tracking
            serverPos:    { x: 0, y: 64, z: 0 },
            correctionCount: 0
        }

        this.serverMaxDistance = 0
        this.fitness = 0
    }

    async run() {
        return new Promise((resolve) => {
            const safetyTimeout = setTimeout(() => {
                this._cleanup()
                resolve(this.fitness)
            }, this.config.duration + 8000)

            try {
                this._connect()

                this.client.on('spawn', () => {
                    this.state.isSpawned = true
                    this.state.yaw = this.genome.genes.preferredDirection || 0

                    const interval = setInterval(() => {
                        if (!this.state.isSpawned) { clearInterval(interval); return }
                        if (!this.state.spawnPosition) return
                        this._tick()
                    }, this.config.tickRate)

                    setTimeout(() => {
                        clearInterval(interval)
                        clearTimeout(safetyTimeout)
                        this._calculateFitness()
                        this._cleanup()
                        resolve(this.fitness)
                    }, this.config.duration)
                })

                this.client.on('error', () => {
                    clearTimeout(safetyTimeout)
                    this._cleanup()
                    resolve(0)
                })

            } catch {
                clearTimeout(safetyTimeout)
                this._cleanup()
                resolve(0)
            }
        })
    }

    _connect() {
        this.client = createClient({
            host:     this.config.host,
            port:     this.config.port,
            username: this.config.username,
            version:  '1.26.14',
            offline:  true,
            skipPing: true
        })

        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.physics.setPosition(packet.player_position)
                this.physics.setGroundY(packet.player_position.y)
                this.state.spawnPosition = { ...packet.player_position }
                this.state.serverPos     = { ...packet.player_position }
            }
            if (packet.current_tick) {
                this.state.serverTick = BigInt(packet.current_tick)
            }
        })

        // move_player reflects the server's broadcast position (used by other clients to render the bot).
        // Use it only to track fitness distance — never update local physics from it.
        this.client.on('move_player', (packet) => {
            if (this.client.entityId && packet.runtime_id !== this.client.entityId) return
            if (packet.position) {
                this.state.serverPos = { ...packet.position }
                this._trackServerDistance()
            }
        })

        this.client.on('correct_player_move_prediction', (packet) => {
            if (packet.position) {
                this.state.serverPos = { ...packet.position }
                this.physics.correctPosition(packet.position)
                this._trackServerDistance()
                this.state.correctionCount++
            }
            if (packet.tick != null) {
                this.state.serverTick = BigInt(packet.tick)
            }
        })
    }

    _tick() {
        const genes = this.genome.genes
        this.state.tickCount++

        // --- Determine movement intent from genome behavioural genes ---
        const moving = Math.random() < genes.walkProbability
        const sprinting = moving && Math.random() < genes.sprintProbability
        const jumping   = moving && Math.random() < genes.jumpProbability &&
                          this.state.tickCount % Math.max(1, genes.jumpInterval) === 0

        // Direction changes
        if (Math.random() < genes.directionChangeProbability) {
            this.state.yaw += (Math.random() - 0.5) * 90
        }
        if (this.state.tickCount % Math.max(1, Math.floor(genes.turnPeriod)) === 0) {
            this.state.yaw += genes.turnRate
        }

        const intent = {
            forward:  moving,
            backward: false,
            left:     false,
            right:    false,
            jump:     jumping,
            sneak:    false,
            sprint:   sprinting
        }

        // --- Physics tick (corrected engine) ---
        const delta = this.physics.tick(this.state.yaw, intent)
        const physState = this.physics.getState()

        // --- Input flags ---
        this.inputGen.reset()
        if (intent.forward)  this.inputGen.move('forward')
        if (intent.sprint)   this.inputGen.sprint()
        if (intent.jump)     this.inputGen.jump()
        if (physState.hadVerticalCollision) this.inputGen.onGround()

        // Override flags with genome boolean overrides (for evolution to discover)
        let inputData = this.inputGen.build()
        if (genes.useUpFlag && !intent.forward)         inputData |= INPUT_UP
        if (!genes.useVerticalCollision)                inputData &= ~INPUT_VERTICAL_COLLISION
        if (genes.useWantUp)                            inputData |= INPUT_WANT_UP

        const camOri = cameraOrientation(this.state.yaw, this.state.pitch)

        const pos = physState.position

        this.client.queue('player_auth_input', {
            pitch:             this.state.pitch,
            yaw:               this.state.yaw,
            position:          { x: pos.x, y: pos.y, z: pos.z },
            move_vector:       { x: 0, z: intent.forward ? 1 : 0 },
            head_yaw:          this.state.yaw,
            input_data:        inputData,
            input_mode:        'mouse',
            play_mode:         'screen',
            interaction_model: 'touch',
            interact_rotation: { x: this.state.pitch, z: this.state.yaw },
            tick:              this.state.serverTick,
            delta,
            analogue_move_vector: { x: 0, z: 0 },
            camera_orientation:   camOri,
            raw_move_vector:   { x: 0, z: intent.forward ? 1 : 0 }
        })

        this.state.serverTick++
    }

    _trackServerDistance() {
        if (!this.state.spawnPosition) return
        const d = distance2D(
            this.state.spawnPosition.x, this.state.spawnPosition.z,
            this.state.serverPos.x,     this.state.serverPos.z
        )
        if (d > this.serverMaxDistance) this.serverMaxDistance = d
    }

    _calculateFitness() {
        // Primary metric: real distance confirmed by server
        this.fitness = this.serverMaxDistance

        if (this.serverMaxDistance > 0.5)  this.fitness += 1
        if (this.serverMaxDistance > 5)    this.fitness += 5
        if (this.serverMaxDistance > 10)   this.fitness += 10

        // Small penalty for excessive server corrections (desync indicates bad physics)
        this.fitness -= this.state.correctionCount * 0.05
        if (this.fitness < 0) this.fitness = 0
    }

    _cleanup() {
        this.state.isSpawned = false
        if (this.client) {
            try { this.client.close() } catch {}
            this.client = null
        }
    }
}

module.exports = Episode
