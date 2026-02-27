/**
 * Evolution Engine - Manages evolutionary optimization
 * 
 * Handles population management, selection, crossover, and mutation
 * to evolve genomes that produce movement in the bot.
 * 
 * @module src/evolution/EvolutionEngine
 */

const Genome = require('./Genome')
const Episode = require('./Episode')
const EventEmitter = require('events')

class EvolutionEngine extends EventEmitter {
    constructor(config = {}) {
        super()
        this.config = {
            populationSize: config.populationSize || 20,
            eliteCount: config.eliteCount || 2,
            mutationRate: config.mutationRate || 0.3,
            episodeDuration: config.episodeDuration || 5000,
            serverHost: config.serverHost || '127.0.0.1',
            serverPort: config.serverPort || 19132,
            maxGenerations: config.maxGenerations || 50,
            targetFitness: config.targetFitness || 20,  // Stop if we reach this
            parallelEpisodes: config.parallelEpisodes || 1,  // How many bots at once
            delayBetweenEpisodes: config.delayBetweenEpisodes || 2000,
            ...config
        }

        this.population = []
        this.generation = 0
        this.bestGenome = null
        this.bestFitness = 0
        this.isRunning = false
        
        // Statistics
        this.stats = {
            avgFitness: [],
            maxFitness: [],
            generations: []
        }
    }

    /**
     * Initialize population with random genomes
     */
    initializePopulation() {
        this.population = []
        for (let i = 0; i < this.config.populationSize; i++) {
            this.population.push(new Genome())
        }
        this.emit('population_initialized', this.population.length)
    }

    /**
     * Run evolutionary optimization
     */
    async run() {
        this.isRunning = true
        this.initializePopulation()
        
        this.emit('evolution_started', {
            populationSize: this.config.populationSize,
            maxGenerations: this.config.maxGenerations
        })

        while (this.isRunning && this.generation < this.config.maxGenerations) {
            this.generation++
            this.emit('generation_started', this.generation)
            
            // Evaluate all genomes
            await this._evaluatePopulation()
            
            // Sort by fitness (descending)
            this.population.sort((a, b) => b.fitness - a.fitness)
            
            // Track best
            if (this.population[0].fitness > this.bestFitness) {
                this.bestFitness = this.population[0].fitness
                this.bestGenome = this.population[0].clone()
                this.emit('new_best', {
                    fitness: this.bestFitness,
                    genome: this.bestGenome,
                    generation: this.generation
                })
            }
            
            // Statistics
            const avgFitness = this.population.reduce((s, g) => s + g.fitness, 0) / this.population.length
            this.stats.avgFitness.push(avgFitness)
            this.stats.maxFitness.push(this.population[0].fitness)
            this.stats.generations.push(this.generation)
            
            this.emit('generation_complete', {
                generation: this.generation,
                bestFitness: this.population[0].fitness,
                avgFitness,
                bestGenes: this.population[0].genes
            })
            
            // Check if target reached
            if (this.bestFitness >= this.config.targetFitness) {
                this.emit('target_reached', {
                    fitness: this.bestFitness,
                    generation: this.generation
                })
                break
            }
            
            // Create next generation
            this._evolvePopulation()
        }
        
        this.isRunning = false
        this.emit('evolution_complete', {
            generations: this.generation,
            bestFitness: this.bestFitness,
            bestGenome: this.bestGenome
        })
        
        return this.bestGenome
    }

    /**
     * Stop evolution
     */
    stop() {
        this.isRunning = false
    }

    /**
     * Evaluate all genomes in population (parallel batches)
     * @private
     */
    async _evaluatePopulation() {
        const batchSize = this.config.parallelEpisodes
        
        // Process in batches
        for (let batchStart = 0; batchStart < this.population.length; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, this.population.length)
            const batch = this.population.slice(batchStart, batchEnd)
            
            this.emit('evaluating', {
                index: batchEnd,
                total: this.population.length,
                batchSize: batch.length
            })
            
            // Run batch in parallel
            const promises = batch.map((genome, i) => {
                const episode = new Episode(genome, {
                    host: this.config.serverHost,
                    port: this.config.serverPort,
                    duration: this.config.episodeDuration,
                    username: `EvoBot_G${this.generation}_${batchStart + i}`
                })
                return episode.run().then(fitness => {
                    genome.fitness = fitness
                    return fitness
                })
            })
            
            const results = await Promise.all(promises)
            const avgBatchFitness = results.reduce((a, b) => a + b, 0) / results.length
            
            this.emit('evaluated', {
                index: batchEnd,
                total: this.population.length,
                avgFitness: avgBatchFitness
            })
            
            // Delay between batches
            if (batchEnd < this.population.length) {
                await this._delay(this.config.delayBetweenEpisodes)
            }
        }
    }

    /**
     * Evolve population to next generation
     * @private
     */
    _evolvePopulation() {
        const newPopulation = []
        
        // Keep elite (best N unchanged)
        for (let i = 0; i < this.config.eliteCount; i++) {
            newPopulation.push(this.population[i].clone())
        }
        
        // Fill rest with offspring
        while (newPopulation.length < this.config.populationSize) {
            // Tournament selection
            const parent1 = this._tournamentSelect()
            const parent2 = this._tournamentSelect()
            
            // Crossover
            const child = parent1.crossover(parent2)
            
            // Mutate
            if (Math.random() < this.config.mutationRate) {
                child.mutate()
            }
            
            newPopulation.push(child)
        }
        
        this.population = newPopulation
    }

    /**
     * Tournament selection
     * @private
     */
    _tournamentSelect(tournamentSize = 3) {
        const tournament = []
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * this.population.length)
            tournament.push(this.population[idx])
        }
        tournament.sort((a, b) => b.fitness - a.fitness)
        return tournament[0]
    }

    /**
     * Delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            generation: this.generation,
            bestFitness: this.bestFitness,
            population: this.population.length,
            avgFitness: this.stats.avgFitness,
            maxFitness: this.stats.maxFitness
        }
    }

    /**
     * Save best genome to file
     * @param {string} filename 
     */
    saveBest(filename) {
        if (this.bestGenome) {
            const fs = require('fs')
            fs.writeFileSync(filename, JSON.stringify({
                fitness: this.bestFitness,
                generation: this.generation,
                genes: this.bestGenome.genes
            }, null, 2))
        }
    }

    /**
     * Load genome from file
     * @param {string} filename 
     */
    loadGenome(filename) {
        const fs = require('fs')
        const data = JSON.parse(fs.readFileSync(filename))
        const genome = new Genome()
        genome.genes = data.genes
        genome.fitness = data.fitness || 0
        return genome
    }
}

module.exports = EvolutionEngine
