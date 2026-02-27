/**
 * Evolution Runner - Main script to run evolutionary optimization
 * 
 * Usage:
 *   node bots/evolution.js [options]
 * 
 * Options:
 *   --population=N   Population size (default: 20)
 *   --generations=N  Max generations (default: 50)
 *   --duration=N     Episode duration in ms (default: 5000)
 *   --port=N         Server port (default: 19132)
 *   --parallel=N     Bots running in parallel (default: 1)
 * 
 * @module bots/evolution
 */

const EvolutionEngine = require('../src/evolution/EvolutionEngine')
const path = require('path')

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=')
    acc[key] = value
    return acc
}, {})

const config = {
    populationSize: parseInt(args.population) || 20,
    maxGenerations: parseInt(args.generations) || 50,
    episodeDuration: parseInt(args.duration) || 5000,
    serverPort: parseInt(args.port) || 19132,
    serverHost: args.host || '127.0.0.1',
    parallelEpisodes: parseInt(args.parallel) || 1,
    eliteCount: 2,
    mutationRate: 0.3,
    targetFitness: 20,
    delayBetweenEpisodes: 1500
}

console.log('='.repeat(60))
console.log('MineBot Evolution Runner')
console.log('='.repeat(60))
console.log(`Population: ${config.populationSize}`)
console.log(`Max Generations: ${config.maxGenerations}`)
console.log(`Episode Duration: ${config.episodeDuration}ms`)
console.log(`Parallel Bots: ${config.parallelEpisodes}`)
console.log(`Server: ${config.serverHost}:${config.serverPort}`)
console.log(`Elite Count: ${config.eliteCount}`)
console.log(`Mutation Rate: ${config.mutationRate}`)
console.log(`Target Fitness: ${config.targetFitness}`)
console.log('='.repeat(60))

const engine = new EvolutionEngine(config)

// Event listeners
engine.on('evolution_started', (info) => {
    console.log(`\n🧬 Evolution started with ${info.populationSize} genomes`)
})

engine.on('generation_started', (gen) => {
    console.log(`\n--- Generation ${gen} ---`)
})

engine.on('evaluating', (info) => {
    process.stdout.write(`\r  Evaluating ${info.index}/${info.total} (batch of ${info.batchSize || 1})...`)
})

engine.on('evaluated', (info) => {
    process.stdout.write(`\r  Evaluated ${info.index}/${info.total} | batch avg = ${(info.avgFitness || 0).toFixed(2)}     `)
})

engine.on('generation_complete', (info) => {
    console.log(`\n  Best: ${info.bestFitness.toFixed(2)} | Avg: ${info.avgFitness.toFixed(2)}`)
    
    // Show key genes from best
    const g = info.bestGenes
    console.log(`  Genes: upFlag=${g.useUpFlag}, vertCol=${g.useVerticalCollision}, ` +
                `deltaX=${g.deltaMultiplierX.toFixed(3)}, deltaZ=${g.deltaMultiplierZ.toFixed(3)}, ` +
                `moveZ=${g.moveVectorZ.toFixed(2)}`)
})

engine.on('new_best', (info) => {
    console.log(`\n  🏆 NEW BEST: fitness = ${info.fitness.toFixed(2)} (generation ${info.generation})`)
})

engine.on('target_reached', (info) => {
    console.log(`\n🎯 TARGET REACHED! Fitness = ${info.fitness.toFixed(2)}`)
})

engine.on('evolution_complete', (info) => {
    console.log('\n' + '='.repeat(60))
    console.log('Evolution Complete!')
    console.log('='.repeat(60))
    console.log(`Generations: ${info.generations}`)
    console.log(`Best Fitness: ${info.bestFitness.toFixed(2)}`)
    
    if (info.bestGenome) {
        console.log('\nBest Genome:')
        console.log(JSON.stringify(info.bestGenome.genes, null, 2))
        
        // Save best genome
        const filename = path.join(__dirname, '..', 'recordings', `best_genome_${Date.now()}.json`)
        engine.saveBest(filename)
        console.log(`\nSaved to: ${filename}`)
    }
})

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\nStopping evolution...')
    engine.stop()
})

// Run!
console.log('\nStarting evolution...\n')
engine.run().then(() => {
    console.log('\nDone!')
    process.exit(0)
}).catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
