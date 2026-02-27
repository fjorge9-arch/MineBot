/**
 * Episode - Run a single evaluation episode for a genome
 * 
 * Connects a bot to the server, uses genome parameters to control movement,
 * measures distance traveled, and returns fitness score.
 * 
 * @module src/evolution/Episode
 */

const { createClient } = require('bedrock-protocol')

// Base input value (from analysis)
const INPUT_BASE = 281474976710656n
const INPUT_UP = 1n << 10n           // Forward (W key)
const INPUT_VERTICAL_COLLISION = 1n << 50n  // On ground
const INPUT_WANT_UP = 1n << 16n      // Want up

class Episode {
    constructor(genome, config = {}) {
        this.genome = genome
        this.config = {
            host: config.host || '127.0.0.1',
            port: config.port || 19132,
            duration: config.duration || 5000,  // Episode duration in ms
            tickRate: config.tickRate || 50,    // ms per tick (20 ticks/s)
            username: config.username || `EvoBot_${Date.now() % 10000}`,
            ...config
        }
        
        this.client = null
        this.state = {
            position: { x: 0, y: 64, z: 0 },
            serverPosition: { x: 0, y: 64, z: 0 },  // Position from server
            spawnPosition: null,
            yaw: 0,
            pitch: 0,
            serverTick: 0n,
            isSpawned: false,
            tickCount: 0
        }
        
        this.fitness = 0
        this.maxDistance = 0
        this.serverMaxDistance = 0  // Distance based on server position
    }

    /**
     * Run the episode and return fitness
     * @returns {Promise<number>} - Fitness score (distance from spawn)
     */
    async run() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._cleanup()
                resolve(this.fitness)
            }, this.config.duration + 5000) // Extra time for connection
            
            try {
                this._connect()
                
                this.client.on('spawn', () => {
                    this.state.isSpawned = true
                    
                    // Start movement loop
                    const interval = setInterval(() => {
                        if (!this.state.isSpawned) {
                            clearInterval(interval)
                            return
                        }
                        this._tick()
                    }, this.config.tickRate)
                    
                    // Stop after duration
                    setTimeout(() => {
                        clearInterval(interval)
                        clearTimeout(timeout)
                        this._calculateFitness()
                        this._cleanup()
                        resolve(this.fitness)
                    }, this.config.duration)
                })
                
                this.client.on('error', (err) => {
                    clearTimeout(timeout)
                    this._cleanup()
                    resolve(0) // Return 0 fitness on error
                })
                
            } catch (err) {
                clearTimeout(timeout)
                this._cleanup()
                resolve(0)
            }
        })
    }

    /**
     * Connect to server
     * @private
     */
    _connect() {
        this.client = createClient({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            offline: true,
            skipPing: true
        })
        
        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.state.position = { ...packet.player_position }
                this.state.serverPosition = { ...packet.player_position }
                this.state.spawnPosition = { ...packet.player_position }
                this.state.yaw = this.genome.genes.preferredDirection || 0
            }
            if (packet.current_tick) {
                this.state.serverTick = BigInt(packet.current_tick)
            }
        })
        
        // Listen for server position updates
        this.client.on('move_player', (packet) => {
            if (packet.position) {
                this.state.serverPosition = { ...packet.position }
                this._updateServerMaxDistance()
            }
        })
    }

    /**
     * Execute one movement tick using genome parameters
     * @private
     */
    _tick() {
        const genes = this.genome.genes
        this.state.tickCount++
        
        // Build input_data based on genome flags
        let inputData = INPUT_BASE
        if (genes.useUpFlag) inputData |= INPUT_UP
        if (genes.useVerticalCollision) inputData |= INPUT_VERTICAL_COLLISION
        if (genes.useWantUp) inputData |= INPUT_WANT_UP
        
        // Calculate delta based on genome multipliers
        const radYaw = (this.state.yaw * Math.PI) / 180
        const deltaX = -Math.sin(radYaw) * genes.deltaMultiplierX
        const deltaZ = Math.cos(radYaw) * genes.deltaMultiplierZ
        const deltaY = genes.deltaY
        
        // Update position based on genome strategy
        if (genes.updatePositionFromDelta) {
            const lerp = genes.positionLerpFactor
            this.state.position.x += deltaX * lerp
            this.state.position.y += deltaY * lerp
            this.state.position.z += deltaZ * lerp
            
            // Clamp Y to ground
            if (this.state.position.y < 64) this.state.position.y = 64
        }
        
        // Turn based on genome parameters
        if (this.state.tickCount % Math.max(1, Math.floor(genes.turnPeriod)) === 0) {
            this.state.yaw += genes.turnRate
        }
        
        // Build packet
        const packet = {
            pitch: this.state.pitch,
            yaw: this.state.yaw,
            position: { ...this.state.position },
            move_vector: { x: 0, z: genes.moveVectorZ },
            head_yaw: this.state.yaw,
            input_data: inputData,
            input_mode: 'mouse',
            play_mode: 'screen',
            interaction_model: 'touch',
            interact_rotation: { x: this.state.pitch, z: this.state.yaw },
            tick: this.state.serverTick,
            delta: { x: deltaX, y: deltaY, z: deltaZ },
            analogue_move_vector: { x: 0, z: 0 },
            camera_orientation: { x: 0, y: 0, z: 0 },
            raw_move_vector: { x: 0, z: genes.rawMoveVectorZ }
        }
        
        this.client.queue('player_auth_input', packet)
        
        // Update tick counter
        this.state.serverTick += BigInt(Math.max(1, genes.tickIncrement))
        
        // Track max distance for fitness
        this._updateMaxDistance()
    }

    /**
     * Update maximum distance from spawn (client-side)
     * @private
     */
    _updateMaxDistance() {
        if (!this.state.spawnPosition) return
        
        const dx = this.state.position.x - this.state.spawnPosition.x
        const dz = this.state.position.z - this.state.spawnPosition.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        
        if (distance > this.maxDistance) {
            this.maxDistance = distance
        }
    }

    /**
     * Update maximum distance from spawn (server-side - REAL position)
     * @private
     */
    _updateServerMaxDistance() {
        if (!this.state.spawnPosition) return
        
        const dx = this.state.serverPosition.x - this.state.spawnPosition.x
        const dz = this.state.serverPosition.z - this.state.spawnPosition.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        
        if (distance > this.serverMaxDistance) {
            this.serverMaxDistance = distance
        }
    }

    /**
     * Calculate final fitness score
     * @private
     */
    _calculateFitness() {
        // PRIMARY: Use SERVER position (real movement!)
        this.fitness = this.serverMaxDistance
        
        // Bonus for consistent movement (not stuck at 0)
        if (this.serverMaxDistance > 0.5) {
            this.fitness += 1  // Small bonus for any movement
        }
        
        // Bonus for larger distances
        if (this.serverMaxDistance > 5) {
            this.fitness += 5
        }
        if (this.serverMaxDistance > 10) {
            this.fitness += 10
        }
    }

    /**
     * Cleanup connection
     * @private
     */
    _cleanup() {
        this.state.isSpawned = false
        if (this.client) {
            try {
                this.client.close()
            } catch (e) {}
            this.client = null
        }
    }
}

module.exports = Episode
