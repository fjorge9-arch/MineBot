# Minecraft Bedrock Mining Bot - Walkthrough

I have created a basic mining bot for Minecraft Bedrock Edition. Since this bot does not use a physics engine or pathfinding, it is a "blind" bot that performs a repetitive action (Strip Mining) in a straight line.

## Prerequisites
1. **Minecraft Bedrock Server**: You need to be running a local server or have access to one that allows bots.
   - If hosting a LAN game, ensure "Visible to LAN Players" is on.
2. **Node.js**: You already have this installed.

## Architecture Reset (Vibe Coding Edition)
> [!NOTE]
> In February 2026, we performed a "Hard Reset" of the project to align with new research on Imitation Learning.
> - **Legacy Code**: The initial "blind bot" code has been moved to the `archive/` folder.
> - **New Approach**: We are building a `gateway.js` that acts as a Man-in-the-Middle to record player actions and learn from them.

## Configuration (Gateway)
The new `gateway.js` (coming soon) will require:
```json
{
  "host": "localhost", // IP of the server
  "port": 19132,       // Port (default 19132)
  "username": "MineBot",
  "offline": false     // Set to true if server is in offline mode (no Xbox Auth)
}
```

## Running the Bot
1. Open a terminal in `C:\Projetos\MineBot`.
2. Run the bot:
   ```cmd
   npm start
   ```
3. The bot should connect to the server and spawn.

## Using the Bot
1. **Join the game** with your main account.
2. **Locate the bot**.
3. **Position the bot**:
   - Push the bot to a safe starting location (e.g., facing a wall you want to mine).
   - Ensure there is a floor under the path it will take (it won't jump gaps).
4. **Start Mining**:
   - Type `!mine` in the in-game chat.
   - The bot will start breaking the block in front (at head level) and moving forward.
5. **Stop Mining**:
   - Type `!stop` in the in-game chat.

## Troubleshooting
- **Connection Refused**: Check if the server is running and the IP/Port is correct in `config.json`.
- **Authentication Failed**: If using an online server, you might need to authenticate via the terminal prompts (Microsoft Account).
- **Bot spins/doesn't mine**: The `action` IDs might be different for your specific server version. The bot uses standard Bedrock protocol values.

## Safety Warning
The bot is blind. It will walk into lava, fall off cliffs, or suffocate if gravel falls on it. Use with caution!
