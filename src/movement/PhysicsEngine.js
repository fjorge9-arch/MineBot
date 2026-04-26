/**
 * PhysicsEngine - Client-side physics prediction for Minecraft Bedrock
 *
 * Matches real Bedrock physics observed from packet recordings:
 * - Velocity accumulates with friction (momentum), not set directly
 * - Gravity is applied every tick, even on ground (position clamped by collision)
 * - Ground level is derived from spawn position, not hardcoded to y=64
 */

const PHYSICS = {
    TICK_RATE: 20,
    TICK_DURATION: 50,

    // Movement speeds (blocks/tick) — actual Bedrock values
    WALK_SPEED: 0.1,
    SPRINT_SPEED: 0.13,
    SNEAK_SPEED: 0.03,

    // Vertical physics
    GRAVITY: 0.08,
    TERMINAL_VELOCITY: 3.92,
    JUMP_VELOCITY: 0.42,

    // Real Bedrock formula: velocity = (velocity + input_speed) * friction
    // Measured from packet recordings: ground friction ≈ 0.535
    GROUND_FRICTION: 0.535,
    AIR_FRICTION: 0.91,
    // Vertical (Y) air drag applied every tick: (0 - 0.08) * 0.98 = -0.0784 on ground
    VERTICAL_DRAG: 0.98,

    PLAYER_HEIGHT: 1.8,
    PLAYER_WIDTH: 0.6
}

class PhysicsEngine {
    constructor() {
        this.position  = { x: 0, y: 64, z: 0 }
        this.velocity  = { x: 0, y: 0, z: 0 }
        this.isOnGround = true
        this.isSprinting = false
        this.isSneaking  = false
        this.hadVerticalCollision = false

        // Actual ground Y derived from spawn; updated via setGroundY()
        this._groundY = 64
    }

    setPosition(pos) {
        this.position = { ...pos }
    }

    setGroundY(y) {
        this._groundY = y
    }

    correctPosition(pos) {
        this.position = { ...pos }
        // Reset horizontal momentum on server correction to prevent drift
        this.velocity.x = 0
        this.velocity.z = 0
        // Keep vertical velocity so jumps aren't cancelled mid-air
    }

    /**
     * Simulate one game tick.
     * Returns the delta {x,y,z} that should be sent in player_auth_input.
     *
     * Key insight from recordings: delta.y is negative even on flat ground because
     * gravity is applied before the ground-collision clamp.
     */
    tick(yaw, input = {}) {
        const radYaw = (yaw * Math.PI) / 180

        // --- Determine target speed ---
        let speed = PHYSICS.WALK_SPEED
        if (input.sprint) {
            speed = PHYSICS.SPRINT_SPEED
            this.isSprinting = true
            this.isSneaking  = false
        } else if (input.sneak) {
            speed = PHYSICS.SNEAK_SPEED
            this.isSprinting = false
            this.isSneaking  = true
        } else {
            this.isSprinting = false
            this.isSneaking  = false
        }

        // --- Calculate desired horizontal movement from input ---
        let moveX = 0
        let moveZ = 0

        if (input.forward)   { moveX -= Math.sin(radYaw); moveZ += Math.cos(radYaw) }
        if (input.backward)  { moveX += Math.sin(radYaw); moveZ -= Math.cos(radYaw) }
        if (input.left)      { moveX -= Math.cos(radYaw); moveZ -= Math.sin(radYaw) }
        if (input.right)     { moveX += Math.cos(radYaw); moveZ += Math.sin(radYaw) }

        // Normalize diagonal movement
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
        if (len > 0) { moveX = (moveX / len) * speed; moveZ = (moveZ / len) * speed }

        // --- Apply acceleration then friction (real Bedrock formula) ---
        // Measured from recordings: velocity = (velocity + input_speed) * friction
        const friction = this.isOnGround ? PHYSICS.GROUND_FRICTION : PHYSICS.AIR_FRICTION
        this.velocity.x = (this.velocity.x + moveX) * friction
        this.velocity.z = (this.velocity.z + moveZ) * friction

        // --- Vertical physics ---
        if (input.jump && this.isOnGround) {
            this.velocity.y = PHYSICS.JUMP_VELOCITY
            this.isOnGround = false
        }

        // Gravity + vertical drag applied every tick — even on ground.
        // On ground: (0 - 0.08) * 0.98 = -0.0784 (matches real recordings)
        this.velocity.y = (this.velocity.y - PHYSICS.GRAVITY) * PHYSICS.VERTICAL_DRAG
        if (this.velocity.y < -PHYSICS.TERMINAL_VELOCITY) {
            this.velocity.y = -PHYSICS.TERMINAL_VELOCITY
        }

        // --- Record delta BEFORE position clamp ---
        const delta = {
            x: this.velocity.x,
            y: this.velocity.y,
            z: this.velocity.z
        }

        // --- Update position ---
        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.position.z += this.velocity.z

        // --- Ground collision: clamp and mark grounded ---
        // hadVerticalCollision: set whenever we are on (or touching) the ground.
        // Matches the real client behaviour — true when isOnGround after physics.
        this.hadVerticalCollision = false
        if (this.position.y <= this._groundY) {
            this.hadVerticalCollision = true
            this.position.y = this._groundY
            this.velocity.y = 0
            this.isOnGround = true
        } else {
            this.isOnGround = false
        }

        return delta
    }

    getState() {
        return {
            position:             { ...this.position },
            velocity:             { ...this.velocity },
            isOnGround:           this.isOnGround,
            hadVerticalCollision: this.hadVerticalCollision,
            isSprinting:          this.isSprinting,
            isSneaking:           this.isSneaking
        }
    }
}

module.exports = { PhysicsEngine, PHYSICS }
