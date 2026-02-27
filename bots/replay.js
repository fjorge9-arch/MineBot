/**
 * ReplayBot - Replay recorded sessions using modular architecture
 * 
 * Usage: node bots/replay.js [recording.jsonl]
 * 
 * Loads a recording file and replays the movement packets
 * with position offset applied.
 * 
 * @module bots/replay
 */

const fs = require('fs')
const path = require('path')
const BaseBot = require(path.join(__dirname, '..', 'src', 'client', 'BaseBot'))

// Configuration
const CONFIG = {
    host: '127.0.0.1',
    port: 19134,              // Via gateway to see logs
    username: 'ReplayBot'
}

// Get recording file from args or use default
const recordingFile = process.argv[2] || path.join(__dirname, '..', 'recording.jsonl')

if (!fs.existsSync(recordingFile)) {
    console.error(`Recording not found: ${recordingFile}`)
    process.exit(1)
}

console.log('='.repeat(50))
console.log('[ReplayBot] Movement Replay Bot')
console.log('='.repeat(50))
console.log(`[ReplayBot] Recording: ${path.basename(recordingFile)}`)
console.log(`[ReplayBot] Target: ${CONFIG.host}:${CONFIG.port}`)
console.log('='.repeat(50))

// Load recording
const packets = []
const lines = fs.readFileSync(recordingFile, 'utf-8').split('\n')

for (const line of lines) {
    if (!line.trim()) continue
    try {
        const pkt = JSON.parse(line, (key, value) => {
            // Handle BigInt serialized as {_bigint: "..."} 
            if (value && typeof value === 'object' && value._bigint) {
                return BigInt(value._bigint)
            }
            // Handle older format {_value: "..."}
            if (value && typeof value === 'object' && value._value) {
                return BigInt(value._value)
            }
            return value
        })
        
        // Support both old format (name/params) and new format (n/p)
        const name = pkt.name || pkt.n
        const params = pkt.params || pkt.p
        const timestamp = pkt.timestamp || pkt.t
        
        if (name === 'player_auth_input') {
            packets.push({ timestamp, params })
        }
    } catch (e) {
        // Skip malformed lines
    }
}

if (packets.length === 0) {
    console.error('No movement packets found in recording!')
    process.exit(1)
}

console.log(`[ReplayBot] Loaded ${packets.length} movement packets`)

// Create bot
const bot = new BaseBot(CONFIG)
let serverStartTick = 0n
let firstRecordedTick = 0n
let offset = { x: 0, y: 0, z: 0 }

bot.on('start_game', (packet) => {
    serverStartTick = BigInt(packet.current_tick || 0)
    const spawnPos = packet.player_position

    // Calculate offset from recording start
    const recStart = packets[0].params.position
    offset = {
        x: spawnPos.x - recStart.x,
        y: spawnPos.y - recStart.y,
        z: spawnPos.z - recStart.z
    }

    console.log(`[ReplayBot] Spawn: ${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)}`)
    console.log(`[ReplayBot] Offset: ${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)}`)
})

bot.on('spawn', () => {
    console.log('[ReplayBot] Spawned, starting replay in 2 seconds...')
    
    setTimeout(() => {
        startReplay()
    }, 2000)
})

function startReplay() {
    console.log('[ReplayBot] Starting replay...')
    
    const startTimestamp = packets[0].timestamp
    firstRecordedTick = BigInt(packets[0].params.tick || 0)

    packets.forEach((pkt, index) => {
        const delay = pkt.timestamp - startTimestamp

        setTimeout(() => {
            const params = { ...pkt.params }

            // Sync tick
            const recordedTick = BigInt(params.tick || 0)
            const tickDelta = recordedTick - firstRecordedTick
            params.tick = serverStartTick + tickDelta

            // Apply position offset
            if (params.position) {
                params.position = {
                    x: params.position.x + offset.x,
                    y: params.position.y + offset.y,
                    z: params.position.z + offset.z
                }
            }

            // Send packet
            bot.send('player_auth_input', params)

            // Progress logging
            if (index === 0 || index === packets.length - 1 || index % 100 === 0) {
                console.log(`[ReplayBot] ${index + 1}/${packets.length} packets`)
            }

            // Done
            if (index === packets.length - 1) {
                console.log('[ReplayBot] Replay complete!')
                setTimeout(() => {
                    bot.disconnect()
                    process.exit(0)
                }, 1000)
            }
        }, delay)
    })
}

bot.on('error', (err) => {
    console.error('[ReplayBot] Error:', err.message)
})

bot.on('end', (reason) => {
    console.log('[ReplayBot] Disconnected:', reason)
})

// Connect
bot.connect()
