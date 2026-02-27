/**
 * InputGenerator - Build input_data flags for player_auth_input packets
 * 
 * Based on analysis of real Minecraft Bedrock client packets.
 * input_data is a BigInt with bit flags indicating pressed buttons/directions.
 * 
 * @module src/movement/InputGenerator
 */

// Base input value when idle (no buttons pressed)
// Bit 48 = block_breaking_delay_enabled (always on)
const INPUT_BASE = 281474976710656n

// Individual input flags (bit positions)
const InputFlags = {
    ASCEND: 1n << 0n,          // Jump/Fly up (bit 0)
    DESCEND: 1n << 1n,           // Sneak/Fly down (bit 1)
    NORTH_JUMP: 1n << 2n,        // Forward + Jump combo
    JUMP_DOWN: 1n << 3n,         // Jump release
    SPRINT_DOWN: 1n << 4n,       // Sprint start
    CHANGE_HEIGHT: 1n << 5n,     // Height change (flying)
    JUMPING: 1n << 6n,           // Currently jumping
    AUTO_JUMPING_IN_WATER: 1n << 7n,
    SNEAKING: 1n << 8n,          // Holding sneak
    SNEAK_DOWN: 1n << 9n,        // Sneak press
    UP: 1n << 10n,               // W key - Forward (bit 10 = 1024)
    DOWN: 2048n,         // S key - Backward
    LEFT: 4096n,         // A key - Strafe left
    RIGHT: 8192n,        // D key - Strafe right
    UP_LEFT: 16384n,     // W+A
    UP_RIGHT: 32768n,    // W+D
    WANT_UP: 65536n,     // Wants to go up
    WANT_DOWN: 131072n,  // Wants to go down
    WANT_DOWN_SLOW: 262144n,
    WANT_UP_SLOW: 524288n,
    SPRINTING: 1048576n, // Currently sprinting
    ASCEND_BLOCK: 2097152n,
    DESCEND_BLOCK: 4194304n,
    SNEAK_TOGGLE_DOWN: 8388608n,
    PERSIST_SNEAK: 16777216n,
    START_SPRINTING: 33554432n,
    STOP_SPRINTING: 67108864n,
    START_SNEAKING: 134217728n,
    STOP_SNEAKING: 268435456n,
    START_SWIMMING: 536870912n,
    STOP_SWIMMING: 1073741824n,
    START_JUMPING: 2147483648n,
    START_GLIDING: 4294967296n,
    STOP_GLIDING: 8589934592n,
    PERFORM_ITEM_INTERACTION: 17179869184n,
    PERFORM_BLOCK_ACTIONS: 34359738368n,
    PERFORM_ITEM_STACK_REQUEST: 68719476736n,
    // Collision flags (critical for movement!)
    HORIZONTAL_COLLISION: 1n << 49n,  // bit 49
    VERTICAL_COLLISION: 1n << 50n,    // bit 50 - SET WHEN ON GROUND!
}

class InputGenerator {
    constructor() {
        this.currentFlags = 0n
    }

    /**
     * Reset to idle state
     */
    reset() {
        this.currentFlags = 0n
        return this
    }

    /**
     * Add a movement direction
     * @param {'forward'|'backward'|'left'|'right'} direction
     */
    move(direction) {
        switch (direction) {
            case 'forward':
                this.currentFlags |= InputFlags.UP
                break
            case 'backward':
                this.currentFlags |= InputFlags.DOWN
                break
            case 'left':
                this.currentFlags |= InputFlags.LEFT
                break
            case 'right':
                this.currentFlags |= InputFlags.RIGHT
                break
        }
        return this
    }

    /**
     * Add jump input
     */
    jump() {
        this.currentFlags |= InputFlags.ASCEND | InputFlags.JUMPING | InputFlags.START_JUMPING
        return this
    }

    /**
     * Add sneak/crouch input
     */
    sneak() {
        this.currentFlags |= InputFlags.SNEAKING | InputFlags.SNEAK_DOWN
        return this
    }

    /**
     * Add sprint input
     */
    sprint() {
        this.currentFlags |= InputFlags.SPRINTING | InputFlags.START_SPRINTING
        return this
    }

    /**
     * Set on-ground flag (vertical collision)
     * CRITICAL: Must be set when player is standing on ground!
     */
    onGround() {
        this.currentFlags |= InputFlags.VERTICAL_COLLISION
        return this
    }

    /**
     * Build the final input_data BigInt
     * @returns {bigint}
     */
    build() {
        return INPUT_BASE | this.currentFlags
    }

    /**
     * Quick builder for forward movement
     * @returns {bigint}
     */
    static forward() {
        return INPUT_BASE | InputFlags.UP
    }

    /**
     * Quick builder for idle
     * @returns {bigint}
     */
    static idle() {
        return INPUT_BASE
    }

    /**
     * Quick builder for forward + sprint
     * @returns {bigint}
     */
    static sprint() {
        return INPUT_BASE | InputFlags.UP | InputFlags.SPRINTING
    }
}

// Export both the class and the flags for advanced usage
module.exports = { InputGenerator, InputFlags, INPUT_BASE }
