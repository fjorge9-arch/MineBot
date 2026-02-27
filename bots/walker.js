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
    console.log('[WalkerBot] Bot spawned, starting movement in 2 seconds...')
    
    setTimeout(() => {
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
        }, 5000) // Every 5 seconds

        // Stop after 30 seconds (for testing)
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

    }, 2000)
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

// Debug packet logging after connection - only log corrections, not move_player (too spammy)
bot.on('join', () => {
    bot.client.on('packet', (packet) => {
        const name = packet.data?.name
        // Only log position CORRECTIONS (not move_player which is for all entities)
        if (['correct_player_move_prediction', 'set_actor_motion'].includes(name)) {
            console.log(`[DEBUG] Server sent: ${name}`)
        }
    })
})

// Connect to server
bot.connect()
