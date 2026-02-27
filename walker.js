const { createClient } = require('bedrock-protocol')

const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 19132

// Physics constants (from Minecraft)
const WALK_SPEED = 0.1  // blocks per tick when walking
const GRAVITY = -0.0784 // gravity per tick when on ground

const client = createClient({
    host: SERVER_HOST,
    port: SERVER_PORT,
    offline: true,
    username: 'WalkerBot',
    skipPing: true
})

// Bot State
let serverTick = 0n
let position = { x: 0, y: 0, z: 0 }
let velocity = { x: 0, y: 0, z: 0 }
let yaw = 0
let pitch = 0
let isSpawned = false

// Input flags from real recording
const INPUT_IDLE = 1407374883553280n
const INPUT_FORWARD = INPUT_IDLE | 1n  // up flag = W key

client.on('join', () => {
    console.log('Bot joined server!')
})

client.on('start_game', (packet) => {
    console.log('Game Started!')
    if (packet.player_position) {
        position = { ...packet.player_position }
        console.log(`Spawn: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`)
    }
    if (packet.current_tick) {
        serverTick = BigInt(packet.current_tick)
        console.log(`Server Tick: ${serverTick}`)
    }
})

client.on('spawn', () => {
    console.log('Bot spawned! Starting autonomous movement...')
    isSpawned = true
    
    setTimeout(() => {
        setInterval(movementLoop, 50) // 20 ticks/s
    }, 1000)
})

function movementLoop() {
    if (!isSpawned) return

    try {
        // Calculate movement delta (client-side physics prediction)
        const radYaw = (yaw * Math.PI) / 180
        
        // Walking forward in direction of yaw
        velocity.x = -Math.sin(radYaw) * WALK_SPEED
        velocity.z = Math.cos(radYaw) * WALK_SPEED
        velocity.y = GRAVITY // On ground
        
        // Update predicted position
        position.x += velocity.x
        position.y += velocity.y
        position.z += velocity.z
        
        // Clamp Y to not go below spawn (simple ground detection)
        if (position.y < 64) position.y = 64.62

        // Build packet with client physics prediction
        const packet = {
            pitch: pitch,
            yaw: yaw,
            position: { x: position.x, y: position.y, z: position.z },
            move_vector: { x: 0, z: 1 }, // Forward
            head_yaw: yaw,
            input_data: INPUT_FORWARD,
            input_mode: 'mouse',
            play_mode: 'screen',
            interaction_model: 'touch',
            interact_rotation: { x: pitch, z: yaw },
            tick: serverTick,
            delta: { x: velocity.x, y: velocity.y, z: velocity.z }, // Physics delta
            analogue_move_vector: { x: 0, z: 0 },
            camera_orientation: { x: 1, y: 0, z: 0 },
            raw_move_vector: { x: 0, z: 1 }
        }

        client.queue('player_auth_input', packet)

        if (serverTick % 20n === 0n) {
            console.log(`[Tick ${serverTick}] Pos: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)} | Delta Z: ${velocity.z.toFixed(3)}`)
        }

        serverTick++
    } catch (e) {
        console.error('Error in movement loop:', e)
        isSpawned = false
    }
}

client.on('error', (err) => console.error('Client Error:', err))
client.on('end', (reason) => console.log('Client disconnected:', reason))
