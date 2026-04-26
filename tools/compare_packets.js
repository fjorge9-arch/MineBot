/**
 * compare_packets.js — Bot output vs real recording diff tool
 *
 * Replays a JSONL recording through the bot logic and shows field-by-field
 * differences between what the real client sent and what our bot would send.
 *
 * Usage:
 *   node tools/compare_packets.js [recording.jsonl] [--ticks=20]
 *
 * Defaults to the most recent session in recordings/.
 */

const fs   = require('fs')
const path = require('path')

const { PhysicsEngine } = require('../src/movement/PhysicsEngine')
const { InputGenerator } = require('../src/movement/InputGenerator')
const { getNewestFile } = require('../src/utils/helpers')

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const ticksArg = args.find(a => a.startsWith('--ticks='))
const skipArg  = args.find(a => a.startsWith('--skip='))
const MAX_TICKS = ticksArg ? parseInt(ticksArg.split('=')[1]) : 30
const SKIP_TICKS = skipArg ? parseInt(skipArg.split('=')[1]) : 0

let recordingFile = args.find(a => !a.startsWith('--'))
if (!recordingFile) {
    const dir = path.join(__dirname, '..', 'recordings')
    recordingFile = getNewestFile(dir, f => f.endsWith('.jsonl'))
    if (!recordingFile) { console.error('No recordings found in recordings/'); process.exit(1) }
}
console.log(`\nComparing against: ${path.basename(recordingFile)}\n`)

// ── Load recording ────────────────────────────────────────────────────────────
function reviveBigInt(_, v) {
    if (v && typeof v === 'object' && '_bigint' in v) return BigInt(v._bigint)
    return v
}

// Extract BigInt from the various formats bedrock-protocol uses in recordings:
//   plain BigInt, {_bigint:"..."}, {_value:{_bigint:"..."}, ...flags}
function extractBigInt(v) {
    if (typeof v === 'bigint') return v
    if (!v) return 0n
    if (typeof v._value === 'bigint') return v._value
    if (typeof v._bigint === 'string')  return BigInt(v._bigint)
    return 0n
}

const lines = fs.readFileSync(recordingFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l, reviveBigInt))

const authInputPackets = lines
    .filter(l => l.n === 'player_auth_input' && l.d === 'C->S')
    .map(l => l.p)

if (!authInputPackets.length) {
    console.error('No player_auth_input packets found in recording.')
    process.exit(1)
}

// ── Simulate bot ──────────────────────────────────────────────────────────────
const physics  = new PhysicsEngine()
const inputGen = new InputGenerator()

// Bootstrap from first packet's position (before skip)
const first = authInputPackets[0]
physics.setPosition(first.position)
physics.setGroundY(first.position.y)

// Fast-forward through skipped packets to warm up physics state
for (let i = 0; i < Math.min(SKIP_TICKS, authInputPackets.length); i++) {
    const p = authInputPackets[i]
    const f = extractBigInt(p.input_data)
    physics.tick(p.yaw, {
        forward: Boolean(f & (1n << 10n)),
        sprint:  Boolean(f & (1n << 20n)),
        jump:    Boolean(f & (1n << 0n))
    })
    // Sync position from recording during warmup
    if (p.position) physics.setPosition(p.position)
}
// Start from the skip point
const startPackets = authInputPackets.slice(SKIP_TICKS)

const COMPARE_KEYS = [
    'position', 'delta', 'move_vector', 'raw_move_vector',
    'camera_orientation', 'input_data', 'play_mode'
]

let totalPackets = 0
let matchedPackets = 0
const fieldMisses = {}

for (let i = 0; i < Math.min(MAX_TICKS, startPackets.length); i++) {
    const real = startPackets[i]
    totalPackets++

    // Determine intent from real input_data flags
    const flags  = extractBigInt(real.input_data)

    const forward  = Boolean(flags & (1n << 10n))
    const sprinting = Boolean(flags & (1n << 20n))
    const jumping  = Boolean(flags & (1n << 0n))
    const onGround = Boolean(flags & (1n << 50n))

    const intent = { forward, backward: false, left: false, right: false,
                     jump: jumping, sneak: false, sprint: sprinting }

    const yaw   = real.yaw
    const pitch = real.pitch

    const delta  = physics.tick(yaw, intent)
    const state  = physics.getState()

    // Build input_data
    inputGen.reset()
    if (intent.forward)  inputGen.move('forward')
    if (intent.sprint)   inputGen.sprint()
    if (intent.jump)     inputGen.jump()
    if (state.hadVerticalCollision) inputGen.onGround()
    const inputData = inputGen.build()

    // Camera orientation
    const yawRad   = (yaw   * Math.PI) / 180
    const pitchRad = (pitch * Math.PI) / 180
    const camOri = {
        x: -Math.sin(yawRad) * Math.cos(pitchRad),
        y: -Math.sin(pitchRad),
        z:  Math.cos(yawRad)  * Math.cos(pitchRad)
    }

    const bot = {
        position:          state.position,
        delta,
        move_vector:       { x: 0, z: forward ? 1 : 0 },
        raw_move_vector:   { x: 0, z: forward ? 1 : 0 },
        camera_orientation: camOri,
        input_data:        inputData,
        play_mode:         'screen'
    }

    // ── Compare ───────────────────────────────────────────────────────────────
    let tickOk = true
    const diffs = []

    for (const key of COMPARE_KEYS) {
        const r = real[key]
        const b = bot[key]

        if (key === 'input_data') {
            const rv = extractBigInt(r)
            const bv = b
            if (rv !== bv) {
                diffs.push(`  ${key}: real=${rv} bot=${bv}`)
                fieldMisses[key] = (fieldMisses[key] || 0) + 1
                tickOk = false
            }
        } else if (r && typeof r === 'object' && !Array.isArray(r)) {
            for (const sub of Object.keys(r)) {
                const rv = r[sub]
                const bv = b?.[sub]
                if (typeof rv === 'number' && typeof bv === 'number') {
                    if (Math.abs(rv - bv) > 0.005) {
                        diffs.push(`  ${key}.${sub}: real=${rv.toFixed(4)} bot=${bv?.toFixed(4)}`)
                        fieldMisses[`${key}.${sub}`] = (fieldMisses[`${key}.${sub}`] || 0) + 1
                        tickOk = false
                    }
                }
            }
        } else if (r !== b) {
            diffs.push(`  ${key}: real=${r} bot=${b}`)
            fieldMisses[key] = (fieldMisses[key] || 0) + 1
            tickOk = false
        }
    }

    if (tickOk) {
        matchedPackets++
    } else {
        console.log(`Tick ${i + 1} (yaw=${yaw.toFixed(1)}°, forward=${forward}):`)
        diffs.forEach(d => console.log(d))
        console.log()
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('─'.repeat(60))
console.log(`Packets compared : ${totalPackets}`)
console.log(`Exact matches    : ${matchedPackets} (${((matchedPackets / totalPackets) * 100).toFixed(1)}%)`)
console.log(`\nField miss counts (fields that differed most):`)
const sorted = Object.entries(fieldMisses).sort((a, b) => b[1] - a[1])
if (sorted.length === 0) {
    console.log('  All fields matched!')
} else {
    sorted.forEach(([k, n]) => console.log(`  ${k.padEnd(30)} ${n}x`))
}
