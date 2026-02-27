#!/usr/bin/env node
/**
 * Teste: Bit 11 vs Bit 10
 * 
 * O walking_bot usa bit 11 (value: 1407374883555328)
 * Nosso código usa bit 10 (value: 1407374883554304)
 * 
 * Também testa:
 * - client.write() vs client.queue()
 * - analogue_move_vector, raw_move_vector
 */

const bedrock = require('bedrock-protocol')

const client = bedrock.createClient({
    host: '127.0.0.1',
    port: 19132,
    username: `Bit11Test_${Date.now() % 10000}`,
    offline: true,
    skipPing: true
})

let spawnPosition = null
let serverPosition = null
let tick = 0n
let testPhase = 0

// Valores de input_data
const BIT11_VALUE = BigInt('1407374883555328') // Bits: 11, 48, 50 (walking_bot)
const BIT10_VALUE = BigInt('1407374883554304') // Bits: 10, 48, 50 (nosso)

function distance3D(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = a.z - b.z
    return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

client.on('spawn', () => {
    console.log('[Bit11Test] Spawned!')
})

client.on('move_player', packet => {
    if (!spawnPosition) {
        spawnPosition = { ...packet.position }
        serverPosition = { ...packet.position }
        console.log(`[Bit11Test] Position: ${packet.position.x.toFixed(2)}, ${packet.position.y.toFixed(2)}, ${packet.position.z.toFixed(2)}`)
        console.log('[Bit11Test] Starting test in 2 seconds...')
        
        setTimeout(startTest, 2000)
    } else {
        serverPosition = { ...packet.position }
    }
})

function startTest() {
    const tests = [
        { name: 'BIT 10 (UP) + write', inputData: BIT10_VALUE, useWrite: true },
        { name: 'BIT 11 (DOWN?) + write', inputData: BIT11_VALUE, useWrite: true },
        { name: 'BIT 10 + queue', inputData: BIT10_VALUE, useWrite: false },
        { name: 'BIT 11 + queue', inputData: BIT11_VALUE, useWrite: false },
    ]
    
    let currentTest = 0
    let testTick = 0
    
    console.log('\n=== STARTING TESTS ===\n')
    
    const interval = setInterval(() => {
        if (currentTest >= tests.length) {
            clearInterval(interval)
            console.log('\n=== ALL TESTS COMPLETE ===')
            setTimeout(() => process.exit(0), 1000)
            return
        }
        
        const test = tests[currentTest]
        testTick++
        tick++
        
        if (testTick === 1) {
            console.log(`\nTest ${currentTest + 1}: ${test.name}`)
            console.log(`  input_data: ${test.inputData}`)
        }
        
        const packet = {
            pitch: 0,
            yaw: 0,
            position: serverPosition,
            move_vector: { x: 0, z: 1 },
            head_yaw: 0,
            input_data: test.inputData,
            input_mode: 'mouse',
            play_mode: 'screen',
            interaction_model: 'touch',
            interact_rotation: { x: 0, z: 0 },
            tick: tick,
            delta: { x: 0, y: 0, z: 0.1 },
            analogue_move_vector: { x: 0, z: 1 },
            camera_orientation: { x: 0, y: 0, z: 0 },
            raw_move_vector: { x: 0, z: 1 }
        }
        
        try {
            if (test.useWrite) {
                client.write('player_auth_input', packet)
            } else {
                client.queue('player_auth_input', packet)
            }
        } catch (e) {
            console.log(`  Error: ${e.message}`)
        }
        
        if (testTick % 20 === 0) {
            const dist = distance3D(serverPosition, spawnPosition)
            console.log(`  Tick ${testTick} | Distance: ${dist.toFixed(2)}`)
        }
        
        if (testTick >= 60) {
            const finalDist = distance3D(serverPosition, spawnPosition)
            console.log(`  Final Distance: ${finalDist.toFixed(2)} blocks`)
            currentTest++
            testTick = 0
        }
    }, 50)
}

client.on('error', err => console.error('[Bit11Test] Error:', err.message))
client.on('kick', reason => {
    console.warn('[Bit11Test] Kicked:', JSON.stringify(reason))
    process.exit(1)
})

console.log('[Bit11Test] Connecting...')
