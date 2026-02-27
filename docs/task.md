# Project: MineBot - "Vibe Coding" Style

## Development History

### Tools Evolution
| Date | Platform | AI Model | Notes |
|------|----------|----------|-------|
| Feb 2026 (start) | Google Antigravity | Gemini | Initial architecture, proxy setup |
| Feb 14, 2026 | VS Code + Copilot | Claude Opus 4.5 | Migration, refactoring, autonomous movement |

### Key Learnings from Antigravity Phase
- Gateway/Proxy architecture working
- Packet recording functional
- Replay bot works with real recordings
- **False conclusion corrected**: Server DOES accept generated packets (not rejected as previously assumed)

---

## Phase 1: Robust Proxy (Gateway)
- [x] **Create `gateway.js`**:
  - [x] Setup `bedrock-protocol` Relay.
  - [x] Implement error handling.
  - [x] Add detailed logging.
- [x] **Solve Connection Issues**:
  - [x] Handle `BigInt` serialization crash.
  - [x] Fix "Port already in use" errors.
  - [x] Verify UWP Loopback exemption.
- [x] **Verify "Passthrough"**:
  - [x] Connect actual game client to proxy.
  - [x] Ensure gameplay works without crashes.

## Phase 2: Observer (Data Collection)
- [x] **Implement Packet Logger**:
  - [x] Filter relevant packets.
  - [x] Write packets to `recording.jsonl`.
- [x] **Verify Data Recording**:
  - [x] Inspect `recording.jsonl` for valid data items.

## Phase 3: Imitator (Playback) - PAUSED
- [/] **Develop Imitator Script (`imitator.js`)**:
  - [x] Read and parse `recording.jsonl`.
  - [x] Connect as a bot client.
  - [x] Replay packets with coordinate offsets.
  - [ ] **Problem**: Server validation/desync makes replay brittle. User pivoted to autonomous approach.

## Phase 4: Autonomous Agent (Learning)
- [/] **Build Movement Engine (`walker.js`)**:
  - [x] **Step 1: The "Baby Step"**: Create a script that generates legitimate `player_auth_input` packets in real-time (template).
  - [/] **Step 2: Physics Loop**: Implement a basic loop (20 ticks/s) that updates position (gravity, velocity).
  - [ ] **Step 3: Verification**: Ensure server accepts the generated movement (no rubber-banding).
- [ ] **Implement Evolutionary Algorithm**:
  - [ ] **Genome**: Define parameters (stride length, jump timing, yaw change).
  - [ ] **Fitness Function**: Distance traveled from spawn point.
  - [ ] **Evaluation**: Run short episodes (e.g., 10s), measure distance, reset.
  - [ ] **Selection/Mutation**: Select best performers, mutate parameters, repeat.
