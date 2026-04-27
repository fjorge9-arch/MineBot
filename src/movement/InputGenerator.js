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
     * Build input_data as the object format expected by protodef's bitflags serializer.
     * Sending a raw BigInt produces input_data=0 server-side because writeBitflags
     * reads named boolean fields, not the BigInt itself.
     * @returns {object}
     */
    build() {
        const value = INPUT_BASE | this.currentFlags
        return InputGenerator.toPacketFormat(value)
    }

    /**
     * Convert a BigInt flag value to the object format required by bedrock-protocol.
     * protodef's writeBitflags reads value._value (raw) + named booleans.
     * @param {bigint} value
     * @returns {object}
     */
    static toPacketFormat(value) {
        return {
            _value: value,
            ascend:                     (value & (1n << 0n))  !== 0n,
            descend:                    (value & (1n << 1n))  !== 0n,
            north_jump:                 (value & (1n << 2n))  !== 0n,
            jump_down:                  (value & (1n << 3n))  !== 0n,
            sprint_down:                (value & (1n << 4n))  !== 0n,
            change_height:              (value & (1n << 5n))  !== 0n,
            jumping:                    (value & (1n << 6n))  !== 0n,
            auto_jumping_in_water:      (value & (1n << 7n))  !== 0n,
            sneaking:                   (value & (1n << 8n))  !== 0n,
            sneak_down:                 (value & (1n << 9n))  !== 0n,
            up:                         (value & (1n << 10n)) !== 0n,
            down:                       (value & (1n << 11n)) !== 0n,
            left:                       (value & (1n << 12n)) !== 0n,
            right:                      (value & (1n << 13n)) !== 0n,
            up_left:                    (value & (1n << 14n)) !== 0n,
            up_right:                   (value & (1n << 15n)) !== 0n,
            want_up:                    (value & (1n << 16n)) !== 0n,
            want_down:                  (value & (1n << 17n)) !== 0n,
            want_down_slow:             (value & (1n << 18n)) !== 0n,
            want_up_slow:               (value & (1n << 19n)) !== 0n,
            sprinting:                  (value & (1n << 20n)) !== 0n,
            ascend_block:               (value & (1n << 21n)) !== 0n,
            descend_block:              (value & (1n << 22n)) !== 0n,
            sneak_toggle_down:          (value & (1n << 23n)) !== 0n,
            persist_sneak:              (value & (1n << 24n)) !== 0n,
            start_sprinting:            (value & (1n << 25n)) !== 0n,
            stop_sprinting:             (value & (1n << 26n)) !== 0n,
            start_sneaking:             (value & (1n << 27n)) !== 0n,
            stop_sneaking:              (value & (1n << 28n)) !== 0n,
            start_swimming:             (value & (1n << 29n)) !== 0n,
            stop_swimming:              (value & (1n << 30n)) !== 0n,
            start_jumping:              (value & (1n << 31n)) !== 0n,
            start_gliding:              (value & (1n << 32n)) !== 0n,
            stop_gliding:               (value & (1n << 33n)) !== 0n,
            item_interact:              (value & (1n << 34n)) !== 0n,
            block_action:               (value & (1n << 35n)) !== 0n,
            item_stack_request:         (value & (1n << 36n)) !== 0n,
            handled_teleport:           (value & (1n << 37n)) !== 0n,
            emoting:                    (value & (1n << 38n)) !== 0n,
            missed_swing:               (value & (1n << 39n)) !== 0n,
            start_crawling:             (value & (1n << 40n)) !== 0n,
            stop_crawling:              (value & (1n << 41n)) !== 0n,
            start_flying:               (value & (1n << 42n)) !== 0n,
            stop_flying:                (value & (1n << 43n)) !== 0n,
            received_server_data:       (value & (1n << 44n)) !== 0n,
            client_predicted_vehicle:   (value & (1n << 45n)) !== 0n,
            paddling_left:              (value & (1n << 46n)) !== 0n,
            paddling_right:             (value & (1n << 47n)) !== 0n,
            block_breaking_delay_enabled: (value & (1n << 48n)) !== 0n,
            horizontal_collision:       (value & (1n << 49n)) !== 0n,
            vertical_collision:         (value & (1n << 50n)) !== 0n,
        }
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
