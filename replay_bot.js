const { createClient } = require('bedrock-protocol')
const fs = require('fs')
const path = require('path')

const RECORDING_FILE = path.join(__dirname, 'recording.jsonl')
const TARGET_HOST = '127.0.0.1'
const TARGET_PORT = 19132 // Connect directly to server

if (!fs.existsSync(RECORDING_FILE)) {
    console.error('Recording file not found!')
    process.exit(1)
}

// Load Recording
console.log('Loading recording...')
const packets = []
const lines = fs.readFileSync(RECORDING_FILE, 'utf-8').split('\n')

for (const line of lines) {
    if (!line.trim()) continue
    try {
        const pkt = JSON.parse(line)
        if (pkt.name === 'player_auth_input') {
            packets.push(pkt)
        }
    } catch (e) { }
}

if (packets.length === 0) {
    console.error('No movement packets found in recording!')
    process.exit(1)
}

console.log(`Loaded ${packets.length} movement packets.`)

// Create Bot
const client = createClient({
    host: TARGET_HOST,
    port: TARGET_PORT,
    username: 'ReplayBot',
    offline: true,
    skipPing: true
})

client.on('error', err => console.log('Client Error:', err))

client.on('join', () => {
    console.log('Bot joined! Waiting for tick sync...')
})

let serverStartTick = 0n

client.on('start_game', (packet) => {
    serverStartTick = BigInt(packet.current_tick)
    const spawnPos = packet.player_position

    console.log(`Server Start Tick: ${serverStartTick}`)
    console.log(`Spawn Position: ${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z}`)

    // Calculate Offset
    const recStart = packets[0].params.position
    const offset = {
        x: spawnPos.x - recStart.x,
        y: spawnPos.y - recStart.y,
        z: spawnPos.z - recStart.z
    }

    console.log(`Applying Offset: ${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)}`)

    // Give it a moment to settle
    setTimeout(() => startReplay(offset), 2000)
})

client.on('disconnect', (packet) => {
    console.log('Client Disconnected via packet:', packet)
})

client.on('kick', (packet) => {
    console.log('Client Kicked:', packet)
})

function startReplay(offset) {
    console.log('Starting Replay with Offset...')
    const startTimestamp = packets[0].timestamp
    const firstRecordedTick = BigInt(packets[0].params.tick || 0)

    packets.forEach((pkt, index) => {
        const delay = pkt.timestamp - startTimestamp

        setTimeout(() => {
            const params = pkt.params

            // Fix BigInts (they became strings in JSON)
            if (params.input_data && params.input_data._value) {
                // Bedrock-protocol serializer likely expects the BigInt directly, not the object
                params.input_data = BigInt(params.input_data._value)
            }

            // Sync Tick
            const recordedTick = BigInt(params.tick || 0)
            const tickDelta = recordedTick - firstRecordedTick
            const currentServerTick = serverStartTick + tickDelta
            params.tick = currentServerTick

            // Apply Position Offset
            if (params.position) {
                params.position.x += offset.x
                params.position.y += offset.y
                params.position.z += offset.z
            }

            // Log first few to debug
            if (index < 5) console.log(`Sending: Pos ${params.position.x.toFixed(1)},${params.position.y.toFixed(1)},${params.position.z.toFixed(1)}`)

            client.queue('player_auth_input', params)

            if (index % 50 === 0) console.log(`Replayed ${index}/${packets.length} packets`)

            if (index === packets.length - 1) {
                console.log('Replay Finished!')
                client.close()
                process.exit(0)
            }
        }, delay)
    })
}
