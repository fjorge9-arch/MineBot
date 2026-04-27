/**
 * BaseBot - Foundation class for all Minecraft Bedrock bots
 * 
 * Handles:
 * - Connection lifecycle
 * - Game state (position, tick, spawn status)
 * - Server feedback packets (corrections, motion sync)
 * 
 * @module src/client/BaseBot
 */

const { createClient } = require('bedrock-protocol')
const EventEmitter = require('events')
const JWT = require('jsonwebtoken')

class BaseBot extends EventEmitter {
    constructor(options = {}) {
        super()
        
        this.config = {
            host: options.host || '127.0.0.1',
            port: options.port || 19132,
            username: options.username || 'MineBot',
            version: options.version || '1.26.14',
            offline: true,
            skipPing: true
        }

        // Game State
        this.state = {
            position: { x: 0, y: 64, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            yaw: 0,
            pitch: 0,
            headYaw: 0,
            serverTick: 0n,
            isSpawned: false,
            isOnGround: true,
            spawnPosition: null
        }

        // True when start_game gave a placeholder Y (>1000); cleared on first plausible move_player
        this._positionPending = false

        // Timestamp of start_game receipt — used to sync tick counter before first packet
        this._startGameTime = null

        this.client = null
    }

    /**
     * Connect to server
     */
    connect() {
        console.log(`[BaseBot] Connecting to ${this.config.host}:${this.config.port} as "${this.config.username}"`)
        
        this.client = createClient(this.config)
        this._injectXuid()
        this._setupEventHandlers()
        
        return this
    }

    /**
     * Override createClientChain to embed a non-zero XUID in the Certificate chain.
     * BDS reads XUID from the old-format JWT (extraData.XUID), not the OIDC Token xid field.
     * Without a non-zero XUID the server skips movement processing in strict auth mode.
     * @private
     */
    _injectXuid() {
        const fakeXuid = '253327400' + Date.now().toString().slice(-7)
        const client = this.client

        // createClientChain is defined synchronously by login.js during createClient.
        // Override it before sendLogin fires (sendLogin is triggered by network_settings,
        // which requires at least one async round-trip to the server).
        const original = client.createClientChain.bind(client)
        client.createClientChain = (mojangKey, offline) => {
            if (!offline) { original(mojangKey, offline); return }

            // Set xuid on profile before original runs so OIDC JWT embeds xid: fakeXuid.
            // The original OIDC path reads client.profile.xuid for the xid field.
            client.profile.xuid = fakeXuid
            original(mojangKey, offline)
            console.log(`[BaseBot] XUID injected: ${fakeXuid}`)
        }
    }

    /**
     * Setup all packet handlers
     * @private
     */
    _setupEventHandlers() {
        // Connection Events
        this.client.on('join', () => {
            console.log('[BaseBot] Joined server')
            this.emit('join')
        })

        this.client.on('spawn', () => {
            console.log('[BaseBot] Spawned into world')
            // If Y correction never arrived (no other players on server), fall back to
            // Y=64 so the bot starts at a plausible height instead of Y=32769.
            // The server will send correct_player_move_prediction if we're wrong.
            if (this._positionPending) {
                this._positionPending = false
                this.state.position.y = 64
                this.state.spawnPosition = { ...this.state.position }
                console.log('[BaseBot] No Y correction received — falling back to Y=64')
                this.emit('position_corrected', this.state.position)
            }
            this.state.isSpawned = true
            this.emit('spawn')
        })

        this.client.on('error', (err) => {
            console.error('[BaseBot] Error:', err.message)
            this.emit('error', err)
        })

        this.client.on('end', (reason) => {
            console.log('[BaseBot] Disconnected:', reason)
            this.state.isSpawned = false
            this.emit('end', reason)
        })

        // Game State Packets
        this.client.on('start_game', (packet) => {
            this._handleStartGame(packet)
            // Required handshake: tell server how many chunks to load around the bot.
            // Without this the server does not track the bot in the world and won't
            // broadcast its movement to other clients.
            this.client.queue('request_chunk_radius', { chunk_radius: 8, max_chunk_radius: 8 })
        })

        // Server Corrections - CRITICAL for movement sync
        this.client.on('correct_player_move_prediction', (packet) => {
            this._handleMoveCorrection(packet)
        })

        this.client.on('set_actor_motion', (packet) => {
            this._handleMotionUpdate(packet)
        })

        this.client.on('move_player', (packet) => {
            this._handleMovePlayer(packet)
        })

        // Debug: Log all unknown packets we might care about
        this.client.on('packet', (packet) => {
            const name = packet.data?.name
            const debugPackets = ['correct_player_move_prediction', 'set_actor_motion', 'move_actor_absolute']
            if (debugPackets.includes(name)) {
                console.log(`[BaseBot] Debug packet: ${name}`)
            }
        })
    }

    /**
     * Handle start_game packet - initial spawn position and tick
     * @private
     */
    _handleStartGame(packet) {
        if (packet.player_position) {
            this.state.position = { ...packet.player_position }
            if (packet.player_position.y > 1000) {
                // BDS 1.26.14 sends placeholder Y=32769.62 before chunks load.
                // spawnPosition stays null until corrected by first move_player.
                this._positionPending = true
                console.log(`[BaseBot] Placeholder spawn Y=${packet.player_position.y.toFixed(2)} — waiting for world Y`)
            } else {
                this.state.spawnPosition = { ...packet.player_position }
                console.log(`[BaseBot] Spawn position: ${this._formatPos(this.state.position)}`)
            }
        }

        if (packet.current_tick) {
            this.state.serverTick = BigInt(packet.current_tick)
            this._startGameTime = Date.now()
            console.log(`[BaseBot] Server tick: ${this.state.serverTick}`)
        }

        if (packet.rotation) {
            this.state.yaw = packet.rotation.y || 0
            this.state.pitch = packet.rotation.x || 0
        }

        this.emit('start_game', packet)
    }

    /**
     * Handle server position corrections
     * @private
     */
    _handleMoveCorrection(packet) {
        if (packet.position) {
            const oldPos = { ...this.state.position }
            this.state.position = { ...packet.position }
            console.log(`[BaseBot] Server correction: ${this._formatPos(oldPos)} -> ${this._formatPos(this.state.position)}`)
        }
        this.emit('move_correction', packet)
    }

    /**
     * Handle velocity updates from server
     * @private
     */
    _handleMotionUpdate(packet) {
        if (packet.velocity) {
            this.state.velocity = { ...packet.velocity }
            console.log(`[BaseBot] Velocity update: ${this._formatPos(this.state.velocity)}`)
        }
        this.emit('motion_update', packet)
    }

    /**
     * Handle move_player from server
     * @private
     */
    _handleMovePlayer(packet) {
        // If start_game gave a placeholder Y, use the first plausible position from
        // any entity to establish the real world Y before we start sending packets.
        if (this._positionPending && packet.position && packet.position.y < 500) {
            this._positionPending = false
            this.state.position.y = packet.position.y
            this.state.spawnPosition = { ...this.state.position }
            console.log(`[BaseBot] World Y corrected to ${packet.position.y.toFixed(2)} via move_player`)
            this.emit('position_corrected', this.state.position)
        }

        // Only update state and emit for our own entity
        if (this.client.entityId && packet.runtime_id !== this.client.entityId) return

        if (packet.position) {
            this.state.position = { ...packet.position }
        }
        if (packet.on_ground !== undefined) this.state.isOnGround = packet.on_ground

        this.emit('move_player', packet)
    }

    /**
     * Send a packet to the server
     * @param {string} name - Packet name
     * @param {object} params - Packet parameters
     */
    send(name, params) {
        if (!this.client) {
            console.error('[BaseBot] Cannot send - not connected')
            return false
        }
        this.client.queue(name, params)
        return true
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.client) {
            this.client.close()
            this.client = null
        }
    }

    /**
     * Format position for logging
     * @private
     */
    _formatPos(pos) {
        return `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    }
}

module.exports = BaseBot
