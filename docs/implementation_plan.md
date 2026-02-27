# Goal Description
Create `walker.js` to enable the bot to move autonomously without relying on pre-recorded data. This solves the "coordinate desync" and "tick mismatch" issues encountered with the imitation approach.

The bot will:
1.  Connect to the server.
2.  Determine its spawn location.
3.  Enter a physics loop (20 ticks/second).
4.  Generate `player_auth_input` packets with updated positions (e.g., moving forward +Z).
5.  Send these packets to the server.

This foundational "Movement Engine" is the first step towards an AI that "learns to move".

## User Review Required
> [!IMPORTANT]
> The bot will attempt to move blindly in one direction. Ensure the bot is spawned in a safe area (flat ground, no cliffs/lava) to prevent immediate death or entrapment.

## Proposed Changes

### [New Script] walker.js
- **Dependencies**: `bedrock-protocol`
- **Logic**:
    - **Connection**: Same as `imitator.js`.
    - **Spawn Handling**: Listen for `start_game` to set `currentPos`.
    - **Physics Loop**:
        - `setInterval` at 50ms (20Hz).
        - Update `currentPos.z += 0.1` (Walk speed).
        - Construct `player_auth_input` packet with:
            - `position`: Updated X/Y/Z.
            - `pitch/yaw`: Fixed orientation.
            - `input_data`: `{ up: true }` (simulate pressing 'W').
            - `tick`: Incrementing counter.
        - Send packet.
    - **Feedback**: Log position updates to console.

## Verification Plan

### Automated Verification
- Run `node walker.js`.
- Observe logs for "Bot spawned" and "Sending packet...".

### Manual Verification
- Join the server as a player.
- Observe the bot "ImitatorBot" (or "WalkerBot").
- **Success Criteria**:
    - Bot spawns.
    - Bot moves smoothly in one direction.
    - Server does not kick the bot for "invalid movement".
    - Bot does not "rubber-band" (snap back to start) frequently.
