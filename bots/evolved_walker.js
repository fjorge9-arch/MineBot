/**
 * evolved_walker.js — Apply best genome from a saved JSON file
 *
 * Usage:
 *   node bots/evolved_walker.js [genome.json]
 *
 * Defaults to the most recent best_genome_*.json in recordings/.
 */

const path = require('path')
const fs   = require('fs')

const BaseBot            = require('../src/client/BaseBot')
const MovementController = require('../src/movement/MovementController')
const Genome             = require('../src/evolution/Genome')
const { getNewestFile, distance2D } = require('../src/utils/helpers')

// ── Load genome ───────────────────────────────────────────────────────────────
let genomePath = process.argv[2]
if (!genomePath) {
    const dir = path.join(__dirname, '..', 'recordings')
    genomePath = getNewestFile(dir, f => f.startsWith('best_genome') && f.endsWith('.json'))
    if (!genomePath) {
        console.error('[EvolvedWalker] No best_genome_*.json found. Run evolution first.')
        process.exit(1)
    }
}

const genome = Genome.fromJSON(JSON.parse(fs.readFileSync(genomePath, 'utf8')))
const genes  = genome.genes

console.log('='.repeat(60))
console.log('[EvolvedWalker] Loaded genome from:', path.basename(genomePath))
console.log(`  Fitness: ${genome.fitness.toFixed(2)} | Generation: ${genome.generation}`)
console.log(`  walkProbability:  ${genes.walkProbability.toFixed(3)}`)
console.log(`  sprintProbability:${genes.sprintProbability.toFixed(3)}`)
console.log(`  turnRate:         ${genes.turnRate.toFixed(2)}°`)
console.log(`  preferredDir:     ${genes.preferredDirection.toFixed(1)}°`)
console.log('='.repeat(60))

// ── Bot setup ─────────────────────────────────────────────────────────────────
const bot      = new BaseBot({ username: 'EvolvedWalker' })
const movement = new MovementController(bot)

// Behaviour runs inside the physics tick so they are always in sync.
movement.onTick = (tick) => {
    const walking   = Math.random() < genes.walkProbability
    const sprinting = walking && Math.random() < genes.sprintProbability

    if (walking) movement.moveForward()
    else         movement.stopMoving()
    movement.setSprint(sprinting)

    if (Math.random() < genes.jumpProbability &&
        tick % Math.max(1, Math.floor(genes.jumpInterval)) === 0) {
        movement.jump()
    }

    if (tick % Math.max(1, Math.floor(genes.turnPeriod)) === 0) {
        bot.state.yaw += genes.turnRate
    }
    if (Math.random() < genes.directionChangeProbability) {
        bot.state.yaw += (Math.random() - 0.5) * 90
    }
}

bot.on('spawn', () => {
    console.log('[EvolvedWalker] Spawned! Starting in 2 seconds...')
    setTimeout(() => {
        bot.state.yaw = genes.preferredDirection
        movement.start()

        const statusInterval = setInterval(() => {
            const pos   = movement.getPosition()
            const spawn = bot.state.spawnPosition
            if (spawn) {
                const d = distance2D(spawn.x, spawn.z, pos.x, pos.z)
                console.log(`[EvolvedWalker] Distance: ${d.toFixed(2)} blocks`)
            }
        }, 5000)

        setTimeout(() => {
            console.log('[EvolvedWalker] Test complete.')
            clearInterval(statusInterval)
            movement.stop()
            const pos   = movement.getPosition()
            const spawn = bot.state.spawnPosition
            if (spawn) {
                const d = distance2D(spawn.x, spawn.z, pos.x, pos.z)
                console.log(`[EvolvedWalker] Final distance: ${d.toFixed(2)} blocks`)
            }
            bot.disconnect()
            process.exit(0)
        }, 60000)
    }, 2000)
})

bot.on('error', err => console.error('[EvolvedWalker] Error:', err.message))
bot.on('end',   ()  => process.exit(0))

bot.connect()
process.on('SIGINT', () => { movement.stop(); bot.disconnect(); process.exit(0) })
