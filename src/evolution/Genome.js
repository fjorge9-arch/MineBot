/**
 * Genome - Genetic representation for bot movement parameters
 * 
 * Each genome encodes parameters that control how the bot moves.
 * This includes TECHNICAL parameters (packet structure) and BEHAVIORAL parameters.
 * The evolution will discover what combination actually works!
 * 
 * @module src/evolution/Genome
 */

class Genome {
    constructor(genes = null) {
        if (genes) {
            this.genes = { ...genes }
        } else {
            this.genes = Genome.randomGenes()
        }
        this.fitness = 0
        this.generation = 0
    }

    /**
     * Generate random genes for a new genome
     * @returns {object}
     */
    static randomGenes() {
        return {
            // === TECHNICAL PARAMETERS (packet structure) ===
            // These control HOW packets are constructed
            
            // Input flags - which bits to set when moving forward
            useUpFlag: Math.random() > 0.5,           // bit 10 (W key)
            useVerticalCollision: Math.random() > 0.5, // bit 50 (on ground)
            useWantUp: Math.random() > 0.5,            // bit 16
            
            // Delta multipliers - how much movement per tick
            deltaMultiplierX: Math.random() * 0.2,    // 0-0.2
            deltaMultiplierZ: Math.random() * 0.2,    // 0-0.2
            deltaY: -0.08 + Math.random() * 0.1,      // gravity adjustment
            
            // Position update strategy
            updatePositionFromDelta: Math.random() > 0.5,  // true = calculate pos from delta
            positionLerpFactor: Math.random(),             // 0-1 how much to trust our calculation
            
            // Tick sync
            tickIncrement: Math.floor(Math.random() * 3),  // 0, 1, or 2 ticks per packet
            
            // Move vector values
            moveVectorZ: Math.random() > 0.5 ? 1 : 0,      // 0 or 1
            rawMoveVectorZ: Math.random() > 0.5 ? 1 : 0,   // 0 or 1
            
            // === BEHAVIORAL PARAMETERS ===
            // These control WHAT the bot tries to do
            
            turnRate: Math.random() * 10 - 5,        // Degrees per tick (-5 to 5)
            turnPeriod: Math.floor(Math.random() * 100) + 20, // Ticks between turns
            
            walkProbability: Math.random() * 0.5 + 0.5, // 0.5-1.0
            sprintProbability: Math.random() * 0.3,     // 0-0.3
            
            jumpProbability: Math.random() * 0.1,       // 0-0.1
            jumpInterval: Math.floor(Math.random() * 200) + 50,
            
            directionChangeProbability: Math.random() * 0.05,
            preferredDirection: Math.random() * 360,
        }
    }

    /**
     * Create offspring by crossing with another genome
     * @param {Genome} other - Partner genome
     * @returns {Genome}
     */
    crossover(other) {
        const childGenes = {}
        
        for (const key in this.genes) {
            // 50% chance to inherit from each parent
            if (Math.random() < 0.5) {
                childGenes[key] = this.genes[key]
            } else {
                childGenes[key] = other.genes[key]
            }
        }
        
        return new Genome(childGenes)
    }

    /**
     * Mutate genes with given probability
     * @param {number} mutationRate - Probability of mutation per gene (0-1)
     * @returns {Genome} - Returns self for chaining
     */
    mutate(mutationRate = 0.1) {
        for (const key in this.genes) {
            if (Math.random() < mutationRate) {
                const currentValue = this.genes[key]
                
                // Handle boolean genes differently
                if (typeof currentValue === 'boolean') {
                    this.genes[key] = !currentValue
                } else {
                    // Apply gaussian mutation for numeric genes
                    const mutation = (Math.random() - 0.5) * 2 * this._getMutationStrength(key)
                    this.genes[key] = this._clampGene(key, currentValue + mutation)
                }
            }
        }
        return this
    }

    /**
     * Get mutation strength for a specific gene
     * @private
     */
    _getMutationStrength(key) {
        const strengths = {
            // Technical parameters
            deltaMultiplierX: 0.05,
            deltaMultiplierZ: 0.05,
            deltaY: 0.02,
            positionLerpFactor: 0.2,
            tickIncrement: 1,
            moveVectorZ: 1,
            rawMoveVectorZ: 1,
            
            // Behavioral parameters
            turnRate: 2,
            turnPeriod: 30,
            walkProbability: 0.2,
            sprintProbability: 0.1,
            jumpProbability: 0.05,
            jumpInterval: 50,
            directionChangeProbability: 0.02,
            preferredDirection: 45,
        }
        return strengths[key] || 0.1
    }

    /**
     * Clamp gene value to valid range
     * @private
     */
    _clampGene(key, value) {
        const ranges = {
            // Technical parameters
            deltaMultiplierX: [0, 0.3],
            deltaMultiplierZ: [0, 0.3],
            deltaY: [-0.15, 0.05],
            positionLerpFactor: [0, 1],
            tickIncrement: [0, 3],
            moveVectorZ: [0, 1],
            rawMoveVectorZ: [0, 1],
            
            // Behavioral parameters
            turnRate: [-10, 10],
            turnPeriod: [10, 200],
            walkProbability: [0.1, 1.0],
            sprintProbability: [0, 0.5],
            jumpProbability: [0, 0.3],
            jumpInterval: [20, 300],
            directionChangeProbability: [0, 0.2],
            preferredDirection: [0, 360],
        }
        
        const [min, max] = ranges[key] || [0, 1]
        return Math.max(min, Math.min(max, value))
    }

    /**
     * Clone this genome
     * @returns {Genome}
     */
    clone() {
        const clone = new Genome({ ...this.genes })
        clone.fitness = this.fitness
        clone.generation = this.generation
        return clone
    }

    /**
     * Serialize to JSON
     * @returns {object}
     */
    toJSON() {
        return {
            genes: this.genes,
            fitness: this.fitness,
            generation: this.generation
        }
    }

    /**
     * Create from JSON
     * @param {object} json
     * @returns {Genome}
     */
    static fromJSON(json) {
        const genome = new Genome(json.genes)
        genome.fitness = json.fitness || 0
        genome.generation = json.generation || 0
        return genome
    }

    /**
     * String representation
     * @returns {string}
     */
    toString() {
        return `Genome(fitness=${this.fitness.toFixed(2)}, gen=${this.generation})`
    }
}

module.exports = Genome
