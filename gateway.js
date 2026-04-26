const { Relay } = require('bedrock-protocol')
const fs = require('fs')
const path = require('path')

// Configuration
const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 19132
const LISTEN_PORT = 19134

const RECORDING_FILE = path.join(__dirname, 'recording.jsonl')

// Clear previous recording on start to avoid mixing sessions
fs.writeFileSync(RECORDING_FILE, '')

console.log(`[Gateway] Initializing...`)
console.log(`[Gateway] Listening on 0.0.0.0:${LISTEN_PORT}`)
console.log(`[Gateway] Forwarding to ${SERVER_HOST}:${SERVER_PORT}`)
console.log(`[Gateway] Recording packets to: ${RECORDING_FILE}`)

let relay
try {
    relay = new Relay({
        version: '1.26.14', // Allow ANY client version to connect (fixes "Outdated Server" errors)
        offline: true,
        host: '0.0.0.0', // Bind to all interfaces (IPv4)
        port: LISTEN_PORT,
        destination: {
            host: SERVER_HOST,
            port: SERVER_PORT,
            offline: true
        },
        onMitm: (client, server) => {
            console.log('[Gateway] MITM session started')
            console.log(`[Gateway] Client: ${client.connection?.address}`)

            client.on('packet', (packet) => {
                // Log first few packets to confirm handshake
                if (packet.data.name === 'login' || packet.data.name === 'client_to_server_handshake') {
                    console.log(`[Gateway] Received handshake packet: ${packet.data.name}`)
                }
            })
        }
    })
    console.log('[Gateway] Relay instance created successfully')
    relay.listen() // Explicitly start listening
} catch (e) {
    console.error('[Gateway] Failed to create Relay:', e)
    process.exit(1)
}

relay.conLog = console.log

// Keep process alive
setInterval(() => { }, 1000)

relay.on('error', (err) => {
    console.error(`[Gateway Error]`, err)
})

relay.on('close', () => {
    console.log(`[Gateway] Relay closed.`)
})

relay.on('join', (player) => {
    console.log(`[Gateway] New connection established! Player: ${player.connection.address}`)
    const startTime = Date.now()
    let lastLogTime = 0

    // Intercept packets coming FROM the Client (You) going TO the Server
    player.on('serverbound', ({ name, params }) => {
        const timestamp = Date.now() - startTime

        // Filter for critical learning packets
        if (name === 'player_auth_input' ||
            name === 'inventory_transaction' ||
            name === 'mob_equipment' ||
            name === 'interact') {

            const packetData = {
                timestamp,
                direction: 'C->S',
                name,
                params
            }

            // Append to JSONL file
            // Use replacer to handle BigInt (which bedrock-protocol uses heavily)
            fs.appendFileSync(RECORDING_FILE, JSON.stringify(packetData, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            ) + '\n')

            // Logging to Console (Monitoring)
            if (name === 'player_auth_input') {
                // Throttle movement logs to avoid spam (every 2 seconds)
                if (Date.now() - lastLogTime > 2000) {
                    const pos = params.position
                    console.log(`[Monitor] Player moving at ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`)
                    lastLogTime = Date.now()
                }
            } else if (name === 'inventory_transaction') {
                console.log(`[Monitor] Action: Inventory Interaction`)
            } else if (name === 'mob_equipment') {
                console.log(`[Monitor] Action: Changed Item`)
            }
        }
    })

    // Intercept packets coming FROM the Server going TO the Client (You)
    player.on('clientbound', ({ name, params }) => {
        if (name === 'start_game') {
            console.log(`[Monitor] Game Started! Entity ID: ${params.runtime_entity_id}`)
        }
    })
})

console.log('[Gateway] Ready. Connect to "localhost:19134" in Minecraft.')
