const fs = require('fs')
const { createClient } = require('bedrock-protocol')

const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 19132
const RECORDING_FILE = 'recording.jsonl'

function revive(key, value) {
    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
        if (key === '_value' || key.endsWith('entity_id') || key.endsWith('unique_id') || key === 'owner_id' || key === 'target_id' || key === 'interact_id') {
            try { return BigInt(value) } catch (e) { return value }
        }
    }
    return value
}

console.log(`Reading recording from ${RECORDING_FILE}...`)
let packets = []
try {
    if (!fs.existsSync(RECORDING_FILE)) {
        console.error('File does not exist!')
        process.exit(1)
    }
    const fileContent = fs.readFileSync(RECORDING_FILE, 'utf8')
    console.log(`File size: ${fileContent.length} bytes`)

    const lines = fileContent.split('\n').filter(line => line.trim().length > 0)
    console.log(`Found ${lines.length} lines. Parsing...`)

    packets = lines.map((line, idx) => {
        try { return JSON.parse(line, revive) } catch (e) {
            if (idx < 5) console.error(`Error parsing line ${idx}:`, e.message)
            return null
        }
    }).filter(p => p !== null)
} catch (e) {
    console.error('Failed to read recording file:', e)
    process.exit(1)
}

if (packets.length === 0) { console.log('No packets found.'); process.exit(0) }
const startTime = packets[0].timestamp
console.log(`Loaded ${packets.length} packets.`)

const client = createClient({
    host: SERVER_HOST,
    port: SERVER_PORT,
    offline: true,
    username: 'ImitatorBot',
    version: '1.26.0',
    skipPing: true
})

let spawnPos = { x: 0, y: 0, z: 0 }
let hasSpawnPos = false

client.on('start_game', (packet) => {
    console.log('Game Started!')
    console.log('Start Game Keys:', Object.keys(packet))
    if (packet.player_position) {
        spawnPos = packet.player_position
        hasSpawnPos = true
        console.log(`Spawn Position detected: ${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z}`)
    } else {
        console.log('WARNING: No player_position in start_game!')
    }
})

client.on('play_status', (packet) => {
    console.log('Play Status:', packet.status)
})

client.on('join', () => console.log('Bot joined server!'))

client.on('spawn', () => {
    console.log('Bot spawned!')

    if (!hasSpawnPos) {
        console.log('ERROR: No valid spawn position received yet. Cannot calculate offset.')
        // Fallback or retry logic?
        // Maybe wait a bit?
    }

    const firstInput = packets.find(p => p.name === 'player_auth_input')
    let recordStartPos = { x: 0, y: 0, z: 0 }
    if (firstInput) recordStartPos = firstInput.params.position

    // Calculate Offset
    const offset = {
        x: spawnPos.x - recordStartPos.x,
        y: spawnPos.y - recordStartPos.y,
        z: spawnPos.z - recordStartPos.z
    }
    console.log(`Applying offset: X=${offset.x.toFixed(2)}, Y=${offset.y.toFixed(2)}, Z=${offset.z.toFixed(2)}`)

    setTimeout(() => {
        client.queue('text', {
            type: 'chat', needs_translation: false, source_name: client.username, xuid: '', platform_chat_id: '',
            message: `Starting jumps (Offset: ${offset.x.toFixed(1)}, ${offset.y.toFixed(1)}, ${offset.z.toFixed(1)})`
        })
    }, 1000)

    console.log('Starting playback in 3 seconds...')
    setTimeout(() => startPlayback(offset), 3000)
})

function startPlayback(offset) {
    const playbackStart = Date.now()
    let currentTick = 0n

    packets.forEach((packet, index) => {
        if (packet.direction !== 'C->S') return

        const delay = packet.timestamp - startTime

        setTimeout(() => {
            try {
                const params = packet.params
                const name = packet.name // Use local var to avoid closure issues if any

                if (name === 'player_auth_input') {
                    params.tick = currentTick
                    currentTick++

                    if (params.position) {
                        params.position.x += offset.x
                        params.position.y += offset.y
                        params.position.z += offset.z
                    }
                }

                client.queue(name, params)

                if (index % 50 === 0) {
                    // console.log(`[${Date.now() - playbackStart}ms] Replayed ${name}`)
                }
            } catch (e) {
                console.error(`Error sending ${packet.name}:`, e.message)
            }
        }, delay)
    })
}

client.on('error', (err) => console.error('Client Error:', err))
client.on('end', (reason) => console.log('Client disconnected:', reason))
