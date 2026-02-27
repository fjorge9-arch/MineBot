/**
 * Evolved Walker - Uses the best genome from evolution
 * 
 * Applies the optimized genes discovered by the evolutionary algorithm
 * 
 * @module bots/evolved_walker
 */

const { createClient } = require('bedrock-protocol')

// Best genome from evolution (fitness: 14.61)
const BEST_GENES = {
    useUpFlag: false,
    useVerticalCollision: true,
    useWantUp: true,
    deltaMultiplierX: 0.1758499918179146,
    deltaMultiplierZ: 0.19826820637585857,
    deltaY: -0.03360120040824911,
    updatePositionFromDelta: true,
    positionLerpFactor: 0.9053354447864946,
    tickIncrement: 0,
    moveVectorZ: 0,
    rawMoveVectorZ: 1,
    turnRate: -3.3614552583747557,
    turnPeriod: 76,
    preferredDirection: 175.7899342771976
}

// Input flags
const INPUT_BASE = 281474976710656n
const INPUT_UP = 1n << 10n
const INPUT_VERTICAL_COLLISION = 1n << 50n
const INPUT_WANT_UP = 1n << 16n

class EvolvedWalker {
    constructor() {
        this.genes = BEST_GENES
        this.client = null
        this.state = {
            position: { x: 0, y: 64, z: 0 },
            spawnPosition: null,
            yaw: this.genes.preferredDirection,
            pitch: 0,
            serverTick: 0n,
            tickCount: 0
        }
        this.moveInterval = null
    }

    connect() {
        console.log('=' .repeat(60))
        console.log('[EvolvedWalker] Using best genome from evolution')
        console.log('=' .repeat(60))
        console.log(`Fitness: 14.61`)
        console.log(`useUpFlag: ${this.genes.useUpFlag}`)
        console.log(`useVerticalCollision: ${this.genes.useVerticalCollision}`)
        console.log(`useWantUp: ${this.genes.useWantUp}`)
        console.log(`deltaMultiplierZ: ${this.genes.deltaMultiplierZ.toFixed(4)}`)
        console.log(`rawMoveVectorZ: ${this.genes.rawMoveVectorZ}`)
        console.log('=' .repeat(60))

        this.client = createClient({
            host: '127.0.0.1',
            port: 19132,
            username: 'EvolvedWalker',
            offline: true,
            skipPing: true
        })

        this.client.on('start_game', (packet) => {
            if (packet.player_position) {
                this.state.position = { ...packet.player_position }
                this.state.spawnPosition = { ...packet.player_position }
                console.log(`[EvolvedWalker] Spawn: ${this.state.position.x.toFixed(2)}, ${this.state.position.y.toFixed(2)}, ${this.state.position.z.toFixed(2)}`)
            }
            if (packet.current_tick) {
                this.state.serverTick = BigInt(packet.current_tick)
            }
        })

        this.client.on('spawn', () => {
            console.log('[EvolvedWalker] Spawned! Starting movement in 2 seconds...')
            setTimeout(() => this.startMovement(), 2000)
        })

        this.client.on('move_player', (packet) => {
            if (packet.position) {
                this.state.position = { ...packet.position }
            }
        })

        this.client.on('error', (err) => {
            console.error('[EvolvedWalker] Error:', err.message)
        })
    }

    startMovement() {
        console.log('[EvolvedWalker] Starting movement with evolved genes!')
        
        this.moveInterval = setInterval(() => {
            this.tick()
        }, 50) // 20 ticks/s

        // Stop after 30 seconds
        setTimeout(() => {
            this.stop()
        }, 30000)
    }

    tick() {
        const genes = this.genes
        this.state.tickCount++

        // Build input_data based on evolved genes
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
        this.state.serverTick += BigInt(Math.max(1, genes.tickIncrement || 1))

        // Log every 40 ticks (2 seconds)
        if (this.state.tickCount % 40 === 0) {
            const dx = this.state.position.x - this.state.spawnPosition.x
            const dz = this.state.position.z - this.state.spawnPosition.z
            const distance = Math.sqrt(dx * dx + dz * dz)
            console.log(`[EvolvedWalker] Tick ${this.state.tickCount} | Pos: ${this.state.position.x.toFixed(2)}, ${this.state.position.y.toFixed(2)}, ${this.state.position.z.toFixed(2)} | Distance: ${distance.toFixed(2)}`)
        }
    }

    stop() {
        console.log('[EvolvedWalker] Stopping...')
        if (this.moveInterval) {
            clearInterval(this.moveInterval)
            this.moveInterval = null
        }

        if (this.state.spawnPosition) {
            const dx = this.state.position.x - this.state.spawnPosition.x
            const dz = this.state.position.z - this.state.spawnPosition.z
            const distance = Math.sqrt(dx * dx + dz * dz)
            console.log(`[EvolvedWalker] Final distance from spawn: ${distance.toFixed(2)} blocks`)
        }

        if (this.client) {
            this.client.close()
        }
        process.exit(0)
    }
}

// Run
const walker = new EvolvedWalker()
walker.connect()

process.on('SIGINT', () => walker.stop())
