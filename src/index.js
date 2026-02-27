/**
 * MineBot - Core modules
 * 
 * @module src/index
 */

const BaseBot = require('./client/BaseBot')
const MovementController = require('./movement/MovementController')
const { PhysicsEngine, PHYSICS } = require('./movement/PhysicsEngine')
const { InputGenerator, InputFlags, INPUT_BASE } = require('./movement/InputGenerator')

module.exports = {
    BaseBot,
    MovementController,
    PhysicsEngine,
    InputGenerator,
    InputFlags,
    INPUT_BASE,
    PHYSICS
}
