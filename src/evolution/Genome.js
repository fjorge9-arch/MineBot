/**
 * Genome - Genetic representation for bot movement behaviour
 *
 * Now that PhysicsEngine correctly simulates Bedrock physics, the genome
 * focuses on BEHAVIOURAL parameters (when to walk, sprint, jump, turn)
 * rather than low-level packet-structure discovery.
 *
 * A small set of protocol-override genes is kept so the algorithm can
 * still explore flag combinations if the behavioural solution plateaus.
 */

class Genome {
    constructor(genes = null) {
        this.genes      = genes ? { ...genes } : Genome.randomGenes()
        this.fitness    = 0
        this.generation = 0
    }

    static randomGenes() {
        return {
            // === BEHAVIOURAL GENES ===

            walkProbability:            0.7 + Math.random() * 0.3,
            sprintProbability:          Math.random() * 0.4,
            sneakProbability:           Math.random() * 0.1,
            jumpProbability:            Math.random() * 0.05,
            jumpInterval:               20 + Math.floor(Math.random() * 80),
            turnRate:                   (Math.random() - 0.5) * 10,
            turnPeriod:                 20 + Math.floor(Math.random() * 80),
            directionChangeProbability: Math.random() * 0.03,
            preferredDirection:         Math.random() * 360,

            // === PROTOCOL OVERRIDE GENES ===
            useUpFlag:            Math.random() > 0.2,
            useVerticalCollision: Math.random() > 0.1,
            useWantUp:            Math.random() > 0.7,
        }
    }

    crossover(other) {
        const child = {}
        for (const key in this.genes) {
            child[key] = Math.random() < 0.5 ? this.genes[key] : other.genes[key]
        }
        return new Genome(child)
    }

    mutate(rate = 0.1) {
        for (const key in this.genes) {
            if (Math.random() >= rate) continue

            if (typeof this.genes[key] === 'boolean') {
                this.genes[key] = !this.genes[key]
            } else {
                const strength = MUTATION_STRENGTH[key] ?? 0.1
                const delta    = (Math.random() - 0.5) * 2 * strength
                this.genes[key] = clamp(key, this.genes[key] + delta)
            }
        }
        return this
    }

    clone() {
        const g = new Genome({ ...this.genes })
        g.fitness    = this.fitness
        g.generation = this.generation
        return g
    }

    toJSON() {
        return { fitness: this.fitness, generation: this.generation, genes: this.genes }
    }

    static fromJSON(json) {
        const g = new Genome(json.genes)
        g.fitness    = json.fitness    || 0
        g.generation = json.generation || 0
        return g
    }

    toString() {
        return `Genome(fitness=${this.fitness.toFixed(2)}, gen=${this.generation})`
    }
}

// Per-gene mutation magnitudes (tuned to each gene's natural scale)
const MUTATION_STRENGTH = {
    walkProbability:              0.1,
    sprintProbability:            0.1,
    sneakProbability:             0.05,
    jumpProbability:              0.02,
    jumpInterval:                 15,
    turnRate:                     2,
    turnPeriod:                   20,
    directionChangeProbability:   0.01,
    preferredDirection:           30,
}

// Valid ranges for each numeric gene
const GENE_RANGES = {
    walkProbability:              [0.1, 1.0],
    sprintProbability:            [0.0, 0.5],
    sneakProbability:             [0.0, 0.3],
    jumpProbability:              [0.0, 0.15],
    jumpInterval:                 [10, 200],
    turnRate:                     [-10, 10],
    turnPeriod:                   [5, 200],
    directionChangeProbability:   [0.0, 0.1],
    preferredDirection:           [0, 360],
}

function clamp(key, value) {
    const range = GENE_RANGES[key]
    if (!range) return value
    return Math.max(range[0], Math.min(range[1], value))
}

module.exports = Genome
