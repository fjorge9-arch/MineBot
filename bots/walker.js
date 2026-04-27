/**
 * WalkerBot - Autonomous walking bot using modular architecture
 * 
 * Usage: node bots/walker.js
 * 
 * Connects to server and walks forward autonomously.
 * Demonstrates use of BaseBot and MovementController modules.
 * 
 * @module bots/walker
 */

const path = require('path')
const BaseBot = require(path.join(__dirname, '..', 'src', 'client', 'BaseBot'))
const MovementController = require(path.join(__dirname, '..', 'src', 'movement', 'MovementController'))

// Configuration
const CONFIG = {
    host: '127.0.0.1',
    port: 19132,              // Direct to server (use 19134 if via gateway)
    username: 'WalkerBot'
}

console.log('='.repeat(50))
console.log('[WalkerBot] Autonomous Walking Bot')
console.log('='.repeat(50))
console.log(`[WalkerBot] Target: ${CONFIG.host}:${CONFIG.port}`)
console.log('='.repeat(50))

// Create bot instance
const bot = new BaseBot(CONFIG)

// Create movement controller
const movement = new MovementController(bot)

// Wait for spawn, then start walking
bot.on('spawn', () => {
    console.log('[WalkerBot] Bot spawned, starting movement immediately')
    console.log(`[WalkerBot] Server tick at spawn: ${bot.state.serverTick}`)

    // Start immediately — any delay drifts the tick counter out of sync with the server
    console.log('[WalkerBot] Starting forward movement!')

    // Start the movement loop (20 ticks/second)
    movement.start()

    // Walk forward
    movement.moveForward()

    // Log status periodically
    const statusInterval = setInterval(() => {
        const pos = movement.getPosition()
        const spawn = bot.state.spawnPosition
        if (spawn) {
            const distance = Math.sqrt(
                Math.pow(pos.x - spawn.x, 2) +
                Math.pow(pos.z - spawn.z, 2)
            )
            console.log(`[WalkerBot] Distance from spawn: ${distance.toFixed(2)} blocks`)
        }
    }, 5000)

    // Stop after 30 seconds
    setTimeout(() => {
        console.log('[WalkerBot] Test complete, stopping...')
        clearInterval(statusInterval)
        movement.stop()

        const pos = movement.getPosition()
        const spawn = bot.state.spawnPosition
        if (spawn) {
            const distance = Math.sqrt(
                Math.pow(pos.x - spawn.x, 2) +
                Math.pow(pos.z - spawn.z, 2)
            )
            console.log(`[WalkerBot] Final distance from spawn: ${distance.toFixed(2)} blocks`)
        }

        bot.disconnect()
        process.exit(0)
    }, 30000)
})

// Handle errors gracefully
bot.on('error', (err) => {
    console.error('[WalkerBot] Error:', err.message)
})

bot.on('end', (reason) => {
    console.log('[WalkerBot] Disconnected:', reason)
    process.exit(0)
})

// Handle corrections (for debugging)
bot.on('move_correction', (packet) => {
    console.log('[WalkerBot] Server CORRECTION:', packet.position)
})

// Verbose server packet logging to diagnose movement acceptance
bot.on('join', () => {
    let moveCount = 0
    bot.client.on('packet', (packet) => {
        const name = packet.data?.name
        const p = packet.data?.params
        if (name === 'start_game') {
            console.log(`[SERVER] start_game player_position=${JSON.stringify(p?.player_position)} gamemode=${p?.player_gamemode}`)
        }
        if (name === 'correct_player_move_prediction') {
            console.log(`[SERVER] CORRECTION → pos: ${JSON.stringify(p?.position)}, tick: ${p?.tick}`)
        }
        if (name === 'move_player') {
            moveCount++
            const eid = bot.client.entityId
            const isSelf = eid && p?.runtime_id === eid
            // Log every move_player in first 3s to see what's happening
            if (moveCount <= 60 || isSelf) {
                console.log(`[SERVER] move_player rid=${p?.runtime_id} self=${isSelf} mode=${p?.mode} pos=${JSON.stringify(p?.position)}`)
            }
        }
        if (name === 'set_actor_motion') {
            console.log(`[SERVER] set_actor_motion vel=${JSON.stringify(p?.velocity)}`)
        }
        if (name === 'move_actor_absolute') {
            console.log(`[SERVER] move_actor_absolute rid=${p?.runtime_id} pos=${JSON.stringify(p?.position)}`)
        }
        if (name === 'move_actor_delta') {
            const eid = bot.client?.entityId
            const isSelf = eid && p?.runtime_id === eid
            console.log(`[SERVER] move_actor_delta rid=${p?.runtime_id} self=${isSelf} flags=${p?.flags}`)
        }
        if (name === 'network_chunk_publisher_update') {
            console.log(`[SERVER] chunk_publisher pos=${JSON.stringify(p?.coordinates)} radius=${p?.radius}`)
        }
    })
})

// Connect to server
bot.connect()
