/**
 * PhysicsEngine - Client-side physics prediction for Minecraft Bedrock
 * 
 * This module simulates player physics locally to predict position changes.
 * The server is authoritative, but we need to send predicted positions.
 * 
 * @module src/movement/PhysicsEngine
 */

// Physics constants from Minecraft Bedrock
const PHYSICS = {
    TICK_RATE: 20,           // Ticks per second
    TICK_DURATION: 50,       // Milliseconds per tick (1000/20)
    
    // Movement speeds (blocks per tick)
    WALK_SPEED: 0.1,
    SPRINT_SPEED: 0.13,
    SNEAK_SPEED: 0.03,
    
    // Vertical physics
    GRAVITY: 0.08,           // Blocks per tick^2 (downward)
    TERMINAL_VELOCITY: 3.92, // Max fall speed
    JUMP_VELOCITY: 0.42,     // Initial upward velocity on jump
    
    // Friction/drag
    GROUND_FRICTION: 0.6,
    AIR_FRICTION: 0.98,
    
    // Collision
    PLAYER_HEIGHT: 1.8,
    PLAYER_WIDTH: 0.6
}

class PhysicsEngine {
    constructor() {
        this.position = { x: 0, y: 64, z: 0 }
        this.velocity = { x: 0, y: 0, z: 0 }
        this.isOnGround = true
        this.isSprinting = false
        this.isSneaking = false
    }

    /**
     * Initialize position (call after receiving start_game)
     * @param {object} pos - Starting position {x, y, z}
     */
    setPosition(pos) {
        this.position = { ...pos }
    }

    /**
     * Apply server correction (call when receiving correction packet)
     * @param {object} pos - Corrected position
     */
    correctPosition(pos) {
        this.position = { ...pos }
        // Reset velocity on correction to prevent drift
        this.velocity = { x: 0, y: 0, z: 0 }
    }

    /**
     * Calculate movement for a single tick
     * @param {number} yaw - Current yaw angle in degrees
     * @param {object} input - Movement input
     * @param {boolean} input.forward
     * @param {boolean} input.backward
     * @param {boolean} input.left
     * @param {boolean} input.right
     * @param {boolean} input.jump
     * @param {boolean} input.sneak
     * @param {boolean} input.sprint
     * @returns {object} Delta movement for this tick
     */
    tick(yaw, input = {}) {
        const radYaw = (yaw * Math.PI) / 180
        
        // Determine movement speed
        let speed = PHYSICS.WALK_SPEED
        if (input.sprint) {
            speed = PHYSICS.SPRINT_SPEED
            this.isSprinting = true
        } else if (input.sneak) {
            speed = PHYSICS.SNEAK_SPEED
            this.isSneaking = true
        } else {
            this.isSprinting = false
            this.isSneaking = false
        }

        // Calculate movement direction relative to yaw
        let moveX = 0
        let moveZ = 0

        if (input.forward) {
            moveX -= Math.sin(radYaw)
            moveZ += Math.cos(radYaw)
        }
        if (input.backward) {
            moveX += Math.sin(radYaw)
            moveZ -= Math.cos(radYaw)
        }
        if (input.left) {
            moveX -= Math.cos(radYaw)
            moveZ -= Math.sin(radYaw)
        }
        if (input.right) {
            moveX += Math.cos(radYaw)
            moveZ += Math.sin(radYaw)
        }

        // Normalize diagonal movement
        const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
        if (length > 0) {
            moveX = (moveX / length) * speed
            moveZ = (moveZ / length) * speed
        }

        // Apply horizontal movement
        this.velocity.x = moveX
        this.velocity.z = moveZ

        // Apply gravity
        if (!this.isOnGround) {
            this.velocity.y -= PHYSICS.GRAVITY
            // Clamp to terminal velocity
            if (this.velocity.y < -PHYSICS.TERMINAL_VELOCITY) {
                this.velocity.y = -PHYSICS.TERMINAL_VELOCITY
            }
        } else {
            this.velocity.y = 0
        }

        // Handle jumping
        if (input.jump && this.isOnGround) {
            this.velocity.y = PHYSICS.JUMP_VELOCITY
            this.isOnGround = false
        }

        // Update position
        const delta = {
            x: this.velocity.x,
            y: this.velocity.y,
            z: this.velocity.z
        }

        this.position.x += delta.x
        this.position.y += delta.y
        this.position.z += delta.z

        // Simple ground detection (assumes flat world at y=64)
        // In real implementation, would need world collision data
        if (this.position.y < 64) {
            this.position.y = 64
            this.velocity.y = 0
            this.isOnGround = true
        }

        return delta
    }

    /**
     * Get current state
     * @returns {object}
     */
    getState() {
        return {
            position: { ...this.position },
            velocity: { ...this.velocity },
            isOnGround: this.isOnGround,
            isSprinting: this.isSprinting,
            isSneaking: this.isSneaking
        }
    }
}

module.exports = { PhysicsEngine, PHYSICS }
