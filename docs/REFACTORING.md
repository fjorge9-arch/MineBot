# MineBot Refactoring Plan

**Date**: February 14, 2026  
**Tool Transition**: Google Antigravity (Gemini) → VS Code (Claude Opus 4.5)

---

## Current State Analysis

### ✅ What's Working

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Gateway/Proxy | `gateway.js` | ✅ Working | MITM proxy, records packets to JSONL |
| Packet Recording | `gateway.js` | ✅ Working | Filters `player_auth_input`, `inventory_transaction` |
| Replay Bot | `replay_bot.js` | ✅ Working | Replays real recordings with offset |
| Analysis Tools | `analyze_*.js` | ✅ Working | Packet inspection utilities |

### ❌ What's Not Working

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Autonomous Walker | `walker.js` | ❌ Broken | Packets send but no visual movement |
| Imitator | `imitator.js` | ⚠️ Paused | Desync issues, brittle |

### 🤔 Key Insight

`replay_bot.js` works because it uses **real recorded packets** with all the correct `input_data` flags, `input_mode`, timing, etc.

`walker.js` fails because it **generates packets from scratch** with potentially wrong or incomplete fields.

---

## Root Cause Analysis

Looking at replay_bot.js line 91-93:
```javascript
if (params.input_data && params.input_data._value) {
    params.input_data = BigInt(params.input_data._value)
}
```

The recording stores `input_data` as a complex object `{ _value: "1407374883553281" }` which is converted back to BigInt for sending.

In `walker.js`, we send `input_data: 1407374883553281n` directly - this **should** work, but we're missing other state that the server may expect.

### Hypothesis: Missing Server State Sync

The server sends packets we're not handling:
- `correct_player_move_prediction` - Server corrections
- `set_actor_motion` - Velocity sync  
- `move_actor_absolute` - Position sync
- Other entity state packets

The bot may be moving server-side but we're not updating our client state, causing visual desync.

---

## Proposed Architecture Refactoring

### New Directory Structure

```
MineBot/
├── src/                          # Core modules
│   ├── client/
│   │   ├── BaseBot.js           # Shared bot logic (connect, state, events)
│   │   └── AutonomousBot.js     # Extends BaseBot with movement generation
│   ├── movement/
│   │   ├── PhysicsEngine.js     # Client-side physics simulation
│   │   ├── InputGenerator.js    # Generate input_data flags
│   │   └── MovementController.js # High-level movement API
│   └── recording/
│       ├── PacketRecorder.js    # Gateway recording logic
│       └── PacketReplayer.js    # Replay logic
├── tools/                        # Standalone utilities
│   ├── gateway.js               # Proxy server
│   └── analyze.js               # Unified packet analyzer
├── bots/                         # Ready-to-run bots
│   ├── walker.js                # Autonomous walker
│   ├── replay.js                # Replay bot
│   └── follower.js              # Future: Follow player
├── docs/                         # Documentation
├── recordings/                   # Session recordings
└── archive/                      # Old experiments (keep for reference)
```

### Phase 1: Fix walker.js (Minimal Change)

Before big refactor, let's make it work first:

1. **Listen to server position corrections**:
```javascript
client.on('correct_player_move_prediction', (packet) => {
    position = { ...packet.position }
    console.log('Server correction:', position)
})
```

2. **Send a complete packet** (mimic real recording structure more closely)

3. **Don't calculate physics server-side** - just send input, let server do physics

### Phase 2: Clean Refactoring

Once walking works, extract into modules as shown above.

### Phase 3: Evolutionary Learning

With clean architecture, implement:
- Genome definition
- Fitness function
- Episode runner
- Selection/mutation

---

## Immediate Action Plan

### Option A: Minimal Fix (Try First)

1. Update `walker.js` to:
   - Listen to server corrections
   - Not predict position (let server handle it)
   - Just send `input_data` with forward flag
   - Log server feedback packets

### Option B: Full Refactor

1. Create `src/` directory with modular code
2. Extract shared logic to BaseBot
3. Use composition over copy-paste

---

## Recommendation

**Start with Option A** (minimal fix) to understand what the server actually expects.

Once working, do Option B (refactor) with confidence that the core logic is correct.

---

## Next Steps

1. [ ] Test: Add listeners for server feedback packets
2. [ ] Test: Remove client-side physics prediction  
3. [ ] Test: Just send input flags, let server calculate position
4. [ ] Once working: Refactor into clean modules
