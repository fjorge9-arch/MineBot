const fs = require('fs')
const path = require('path')

const RECORDING_FILE = path.join(__dirname, 'recording.jsonl')

if (!fs.existsSync(RECORDING_FILE)) {
    console.error('Recording file not found!')
    process.exit(1)
}

console.log(`Analyzing: ${RECORDING_FILE}`)

const fileStream = fs.readFileSync(RECORDING_FILE, 'utf-8')
const lines = fileStream.split('\n').filter(line => line.trim() !== '')

console.log(`Total Packets: ${lines.length}`)

let firstTick = null
let lastTick = null
let positions = []
let inputs = []

lines.forEach((line, index) => {
    try {
        const packet = JSON.parse(line)

        if (packet.name === 'player_auth_input') {
            const params = packet.params
            const tick = BigInt(params.tick || 0) // Handle BigInt if present

            if (firstTick === null) firstTick = tick
            lastTick = tick

            const pos = params.position
            const rot = { x: params.pitch, y: params.yaw }
            const moveVec = params.move_vector // {x, z} usually

            positions.push({ x: pos.x, y: pos.y, z: pos.z, tick: tick.toString() })

            // Check for interesting inputs
            const inputData = params.input_data
            let activeInputs = []
            if (inputData.jumping) activeInputs.push('JUMP')
            if (inputData.sneaking) activeInputs.push('SNEAK')
            if (inputData.sprinting) activeInputs.push('SPRINT')

            if (activeInputs.length > 0 || Math.abs(moveVec.x) > 0 || Math.abs(moveVec.z) > 0) {
                inputs.push({
                    tick: tick.toString(),
                    move: moveVec,
                    actions: activeInputs
                })
            }
        }

    } catch (e) {
        console.error(`Error parsing line ${index}:`, e.message)
    }
})

console.log(`\n=== Analysis ===`)
console.log(`Movement Packets: ${positions.length}`)
if (positions.length > 0) {
    const start = positions[0]
    const end = positions[positions.length - 1]
    console.log(`Start Pos: ${start.x.toFixed(1)}, ${start.y.toFixed(1)}, ${start.z.toFixed(1)}`)
    console.log(`End Pos:   ${end.x.toFixed(1)}, ${end.y.toFixed(1)}, ${end.z.toFixed(1)}`)

    // Calculate roughly distance
    const dx = end.x - start.x
    const dy = end.y - start.y
    const dz = end.z - start.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    console.log(`Distance Traveled: ${dist.toFixed(2)} blocks`)
}

console.log(`\n=== Input Summary ===`)
console.log(`Active Input Ticks: ${inputs.length}`)
if (inputs.length > 0) {
    console.log(`First 5 Inputs:`)
    console.log(JSON.stringify(inputs.slice(0, 5), null, 2))
}
