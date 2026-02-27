/**
 * Gateway/Proxy - MITM proxy for packet recording
 * 
 * Acts as intermediary between Minecraft client and server.
 * Records all relevant packets to JSONL for analysis/replay.
 * 
 * Usage: node tools/gateway.js
 * 
 * @module tools/gateway
 */

const { Relay } = require('bedrock-protocol')
const fs = require('fs')
const path = require('path')

// Configuration
const CONFIG = {
    listenHost: '0.0.0.0',
    listenPort: 19134,
    serverHost: '127.0.0.1',
    serverPort: 19132,
    recordingsDir: path.join(__dirname, '..', 'recordings'),
    version: '1.26.0'
}

// Create recordings directory if it doesn't exist
if (!fs.existsSync(CONFIG.recordingsDir)) {
    fs.mkdirSync(CONFIG.recordingsDir, { recursive: true })
}

// Generate unique session filename
const sessionFile = path.join(
    CONFIG.recordingsDir, 
    `session-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
)

console.log('='.repeat(50))
console.log('[Gateway] MineBot Proxy Server')
console.log('='.repeat(50))
console.log(`[Gateway] Listen: ${CONFIG.listenHost}:${CONFIG.listenPort}`)
console.log(`[Gateway] Server: ${CONFIG.serverHost}:${CONFIG.serverPort}`)
console.log(`[Gateway] Recording: ${path.basename(sessionFile)}`)
console.log('='.repeat(50))

// Packets to record (C->S)
const RECORD_PACKETS = [
    'player_auth_input',      // Movement - most important
    'inventory_transaction',  // Block interaction / item use
    'mob_equipment',          // Hotbar selection
    'interact',               // Entity interaction
    'block_pick_request',     // Middle-click pick block
    'animate',                // Arm swing
    'player_action'           // More actions
]

// Initialize recording file
fs.writeFileSync(sessionFile, '')

let packetCount = 0
let startTime = Date.now()
let lastLogTime = 0

/**
 * Serialize packet data, handling BigInt
 */
function serializePacket(data) {
    return JSON.stringify(data, (key, value) => 
        typeof value === 'bigint' ? { _bigint: value.toString() } : value
    )
}

// Create relay
let relay
try {
    relay = new Relay({
        version: CONFIG.version,
        offline: true,
        host: CONFIG.listenHost,
        port: CONFIG.listenPort,
        destination: {
            host: CONFIG.serverHost,
            port: CONFIG.serverPort,
            offline: true
        },
        onMitm: (client, server) => {
            console.log(`[Gateway] MITM established for ${client.connection?.address || 'unknown'}`)
        }
    })
    
    relay.listen()
    console.log('[Gateway] Relay listening...')
    
} catch (err) {
    console.error('[Gateway] Failed to start:', err.message)
    process.exit(1)
}

// Handle player connections
relay.on('join', (player) => {
    console.log(`[Gateway] Player connected: ${player.connection?.address || 'unknown'}`)
    startTime = Date.now()
    packetCount = 0

    // Record client-to-server packets
    player.on('serverbound', ({ name, params }) => {
        const timestamp = Date.now() - startTime

        if (RECORD_PACKETS.includes(name)) {
            const record = {
                t: timestamp,
                d: 'C->S',
                n: name,
                p: params
            }

            fs.appendFileSync(sessionFile, serializePacket(record) + '\n')
            packetCount++

            // Throttled logging
            if (name === 'player_auth_input') {
                if (Date.now() - lastLogTime > 2000) {
                    const pos = params.position
                    console.log(`[Record] ${packetCount} packets | Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`)
                    lastLogTime = Date.now()
                }
            } else {
                console.log(`[Record] ${name}`)
            }
        }
    })

    // Optional: Record critical server-to-client packets
    player.on('clientbound', ({ name, params }) => {
        // Could record spawn, teleport, etc. for replay sync
    })
})

relay.on('error', (err) => {
    console.error('[Gateway] Error:', err.message)
})

relay.on('close', () => {
    console.log('[Gateway] Closed')
    console.log(`[Gateway] Recorded ${packetCount} packets to ${path.basename(sessionFile)}`)
})

// Keep alive
setInterval(() => {}, 1000)

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Gateway] Shutting down...')
    console.log(`[Gateway] Total packets recorded: ${packetCount}`)
    process.exit(0)
})
