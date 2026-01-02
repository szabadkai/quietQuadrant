# Implementation Plan – Quiet Quadrant v2

## Overview

This plan breaks v2 development into 8 phases, each building on the previous. Each phase produces a playable milestone. Estimated total: 4-6 weeks for a solo developer or AI agent.

**Key Principles:**

-   Each phase is independently testable
-   Core simulation before presentation
-   Multiplayer-ready architecture from day one
-   300-line file limit enforced throughout

---

## Phase 1: Project Setup & Core Simulation (Days 1-3)

### Goal

Establish project structure, build tooling, and create the deterministic simulation core that runs headless (no rendering).

### Tasks

**1.1 Project Scaffolding**

-   [ ] Initialize Vite + React project with JavaScript
-   [ ] Configure ESLint with max-lines rule (300)
-   [ ] Set up Vitest for testing
-   [ ] Create folder structure per architecture.md
-   [ ] Add JSDoc configuration

**1.2 Utility Layer**

```
src/utils/
├── math.js          # clamp, lerp, distance, normalize
├── random.js        # SeededRandom class (deterministic RNG)
└── constants.js     # TICK_RATE, ARENA_WIDTH, ARENA_HEIGHT
```

**1.3 Configuration Layer**

```
src/config/
├── player.js        # Player base stats
├── enemies.js       # All 7 enemy types + elite configs
├── upgrades.js      # All 30 upgrades with effects
├── waves.js         # Wave definitions
└── bosses.js        # 3 boss types with patterns
```

**1.4 Core Simulation**

```
src/simulation/
├── GameState.js     # createInitialState(), state structure
├── GameSimulation.js # Main loop: tick(), getState(), getSnapshot()
├── PlayerSystem.js  # Movement, shooting, dash, invuln frames
├── BulletSystem.js  # Bullet movement, TTL, bounds check
└── CollisionSystem.js # Player bullets vs enemies, enemy bullets vs player
```

**1.5 Tests**

-   [ ] Determinism test: same seed + inputs = same state
-   [ ] Player movement respects bounds
-   [ ] Bullet spawning and TTL
-   [ ] Basic collision detection

### Deliverable

Simulation runs in Node.js, passes determinism tests, no visual output yet.

---

## Phase 2: Basic Rendering & Game Loop (Days 4-6)

### Goal

Connect Phaser renderer to simulation, see player and bullets on screen.

### Tasks

**2.1 Phaser Setup**

```
src/rendering/
├── GameRenderer.js      # Phaser scene setup, main render loop
├── PlayerRenderer.js    # Player sprite, interpolation
├── BulletRenderer.js    # Bullet pool, render from state
└── BackgroundRenderer.js # Starfield, arena bounds
```

**2.2 Input Handling**

```
src/input/
├── InputManager.js      # Keyboard/mouse input capture
└── InputBuffer.js       # Buffer inputs for tick processing
```

**2.3 Game Loop Integration**

```
src/core/
└── GameLoop.js          # Fixed timestep loop, interpolation
```

**2.4 React Shell**

```
src/ui/
├── App.jsx              # Root component, screen routing
└── screens/
    └── GameScreen.jsx   # Phaser container + HUD placeholder
```

**2.5 Zustand Stores**

```
src/state/
├── useGameStore.js      # Game state, simulation instance
└── useUIStore.js        # Screen state, pause state
```

### Deliverable

Player moves on screen, shoots bullets, bullets disappear at bounds.

---

## Phase 3: Enemies & Combat (Days 7-10)

### Goal

Add all enemy types, combat, XP, and level-up flow.

### Tasks

**3.1 Enemy Systems**

```
src/simulation/
├── EnemySystem.js       # Spawn queue, AI update dispatcher
├── enemies/
│   ├── DrifterAI.js     # Chase behavior
│   ├── WatcherAI.js     # Ranged, maintain distance
│   ├── MassAI.js        # Slow + burst attack
│   ├── PhantomAI.js     # Teleport behavior
│   ├── OrbiterAI.js     # Circle + shoot
│   └── SplitterAI.js    # Split on death
└── EliteBehaviors.js    # burst_movement, rapid_fire, death_explosion
```

**3.2 Enemy Rendering**

```
src/rendering/
└── EnemyRenderer.js     # Sprite pool, elite visuals
```

**3.3 Combat & XP**

```
src/simulation/
├── DamageSystem.js      # Apply damage, handle deaths, spawn XP
├── PickupSystem.js      # XP orbs, magnet behavior
└── LevelSystem.js       # XP thresholds, level up trigger
```

**3.4 Wave Management**

```
src/simulation/
└── WaveSystem.js        # Wave progression, spawn timing, intermission
```

**3.5 Collision Expansion**

-   [ ] Enemy bullets vs player
-   [ ] Player vs enemy (contact damage)
-   [ ] Player vs pickups

### Deliverable

Full combat loop: enemies spawn, player kills them, gains XP, levels up (no upgrades yet).

---

## Phase 4: Upgrades & Synergies (Days 11-14)

### Goal

Implement upgrade selection, stat application, and synergy detection.

### Tasks

**4.1 Upgrade System**

```
src/simulation/
├── UpgradeSystem.js     # Apply upgrade effects to player stats
└── UpgradeRoller.js     # Roll 3 upgrades based on rarity odds
```

**4.2 Synergy System**

```
src/config/
└── synergies.js         # 13 synergy definitions

src/simulation/
└── SynergyChecker.js    # Check unlocked synergies, apply bonuses
```

**4.3 Upgrade UI**

```
src/ui/components/
├── UpgradeModal.jsx     # 3-card selection UI
└── UpgradeCard.jsx      # Individual upgrade display
```

**4.4 Player Stats Calculation**

```
src/simulation/
└── PlayerStats.js       # Calculate final stats from base + upgrades + synergies
```

**4.5 Special Upgrade Effects**

-   [ ] Explosive rounds (AoE spawning)
-   [ ] Pierce (bullet doesn't die on hit)
-   [ ] Homing (gentle steering)
-   [ ] Charged shot (hold-to-charge)
-   [ ] Split shot (spawn child bullets)

### Deliverable

Full upgrade loop: level up → choose upgrade → stats change → synergies unlock.

---

## Phase 5: Boss Fights (Days 15-17)

### Goal

Implement all 3 boss types with phase transitions and attack patterns.

### Tasks

**5.1 Boss System**

```
src/simulation/
├── BossSystem.js        # Boss state machine, phase transitions
└── bosses/
    ├── SentinelAI.js    # Beam spin, aimed burst, ring with gap
    ├── SwarmCoreAI.js   # Summon minions, cone volley, pulse ring
    └── ObeliskAI.js     # Slam, ricochet shards, lane beams
```

**5.2 Boss Patterns**

```
src/simulation/bosses/patterns/
├── BeamSpin.js
├── AimedBurst.js
├── RingWithGap.js
├── SummonMinions.js
├── ConeVolley.js
├── PulseRing.js
├── Slam.js
├── RicochetShards.js
└── LaneBeams.js
```

**5.3 Boss Rendering**

```
src/rendering/
└── BossRenderer.js      # Boss sprite, phase visuals, telegraph indicators
```

**5.4 Victory/Defeat Flow**

```
src/simulation/
└── GameEndSystem.js     # Victory/defeat detection, run summary generation
```

### Deliverable

Complete standard run: 10 waves → boss → victory/defeat.

---

## Phase 6: Meta-Progression & UI Polish (Days 18-22)

### Goal

Add persistence, achievements, card collection, and polished UI.

### Tasks

**6.1 Meta Store**

```
src/state/
└── useMetaStore.js      # Pilot rank, stats, achievements, card collection
```

**6.2 Card Collection**

```
src/ui/components/
├── CardRewardModal.jsx  # Post-boss card selection
└── CardDisplay.jsx      # Upgrade card with unlock/boost state
```

**6.3 Achievement System**

```
src/config/
└── achievements.js      # 31 achievement definitions

src/systems/
└── AchievementChecker.js # Check and unlock achievements
```

**6.4 Notification System**

```
src/state/
└── useNotificationStore.js

src/ui/components/
└── NotificationToast.jsx
```

**6.5 UI Screens**

```
src/ui/screens/
├── TitleScreen.jsx      # Mode selection, settings
├── SummaryScreen.jsx    # Run results, achievements, XP gain
└── StatsScreen.jsx      # Lifetime stats, leaderboard
```

**6.6 HUD**

```
src/ui/components/
├── HUD.jsx              # Health, XP, wave, dash cooldown
├── HealthBar.jsx
├── XPBar.jsx
└── WaveIndicator.jsx
```

**6.7 Weekly Affixes**

```
src/config/
└── affixes.js           # 18 affix definitions

src/simulation/
└── AffixSystem.js       # Apply affix modifiers
```

### Deliverable

Full meta loop: play → earn XP → rank up → unlock cards → achievements.

---

## Phase 7: Multiplayer (Days 23-28)

### Goal

Implement P2P networking with input sync and correction snapshots.

### Tasks

**7.1 Network Core**

```
src/network/
├── NetworkManager.js    # Trystero connection, room management
├── PeerConnection.js    # Individual peer handling
└── RoomCodeGenerator.js # 6-char alphanumeric codes
```

**7.2 Input Sync**

```
src/network/
├── InputSync.js         # Input packet encoding/decoding, buffer
└── InputPacket.js       # Compact 9-byte packet structure
```

**7.3 State Sync**

```
src/network/
├── StateSync.js         # Correction snapshots, drift detection
└── CorrectionPacket.js  # Snapshot structure
```

**7.4 Multiplayer Simulation**

```
src/simulation/
└── MultiplayerSimulation.js # Host/guest authority, dual player handling
```

**7.5 Multiplayer UI**

```
src/ui/components/
├── MultiplayerLobby.jsx # Host/join flow
├── RoomCodeDisplay.jsx  # Show code for host
└── RoomCodeInput.jsx    # Enter code for guest
```

**7.6 Disconnect Handling**

-   [ ] Pause on disconnect
-   [ ] Reconnection window (30s)
-   [ ] Graceful end if reconnect fails

**7.7 Twin Mode (Local Co-op)**

```
src/input/
└── TwinInputManager.js  # Split keyboard controls for 2 players
```

### Deliverable

Two players can play together via room code, sync stays tight.

---

## Phase 8: Native Builds & Polish (Days 29-35)

### Goal

Capacitor/Electron builds, audio, visual polish, performance optimization.

### Tasks

**8.1 Capacitor Setup**

```
capacitor.config.js
ios/
android/
```

-   [ ] Touch controls (virtual sticks)
-   [ ] Safe area handling
-   [ ] Haptic feedback
-   [ ] App icons and splash screens

**8.2 Electron Setup**

```
electron/
├── main.cjs
├── preload.cjs
└── package.json
```

-   [ ] Window management
-   [ ] F11 fullscreen
-   [ ] Native menus
-   [ ] Auto-updater config

**8.3 Audio System**

```
src/audio/
├── SoundManager.js      # Playback, pooling, priority
└── MusicManager.js      # Ambient tracks, intensity scaling
```

**8.4 Visual Effects**

```
src/rendering/
├── EffectsRenderer.js   # Particles, explosions
├── ScreenEffects.js     # Shake, flash, slow-mo
└── TelegraphRenderer.js # Boss attack previews
```

**8.5 Performance Optimization**

-   [ ] Object pooling audit
-   [ ] Spatial partitioning for collisions
-   [ ] Particle budget enforcement
-   [ ] Bundle size optimization

**8.6 Accessibility**

-   [ ] High contrast mode
-   [ ] Screen shake toggle
-   [ ] Rebindable controls
-   [ ] UI scale options

**8.7 Infinite Mode**

```
src/simulation/
└── InfiniteScaling.js   # Wave cycling, difficulty scaling
```

### Deliverable

Shippable game on web, iOS, Android, Windows, macOS, Linux.

---

## File Checklist

### Phase 1 (15 files)

```
src/utils/math.js
src/utils/random.js
src/utils/constants.js
src/config/player.js
src/config/enemies.js
src/config/upgrades.js
src/config/waves.js
src/config/bosses.js
src/simulation/GameState.js
src/simulation/GameSimulation.js
src/simulation/PlayerSystem.js
src/simulation/BulletSystem.js
src/simulation/CollisionSystem.js
tests/simulation/determinism.test.js
tests/simulation/player.test.js
```

### Phase 2 (12 files)

```
src/rendering/GameRenderer.js
src/rendering/PlayerRenderer.js
src/rendering/BulletRenderer.js
src/rendering/BackgroundRenderer.js
src/input/InputManager.js
src/input/InputBuffer.js
src/core/GameLoop.js
src/ui/App.jsx
src/ui/screens/GameScreen.jsx
src/state/useGameStore.js
src/state/useUIStore.js
src/main.jsx
```

### Phase 3 (14 files)

```
src/simulation/EnemySystem.js
src/simulation/enemies/DrifterAI.js
src/simulation/enemies/WatcherAI.js
src/simulation/enemies/MassAI.js
src/simulation/enemies/PhantomAI.js
src/simulation/enemies/OrbiterAI.js
src/simulation/enemies/SplitterAI.js
src/simulation/EliteBehaviors.js
src/simulation/DamageSystem.js
src/simulation/PickupSystem.js
src/simulation/LevelSystem.js
src/simulation/WaveSystem.js
src/rendering/EnemyRenderer.js
src/rendering/PickupRenderer.js
```

### Phase 4 (8 files)

```
src/simulation/UpgradeSystem.js
src/simulation/UpgradeRoller.js
src/simulation/SynergyChecker.js
src/simulation/PlayerStats.js
src/config/synergies.js
src/ui/components/UpgradeModal.jsx
src/ui/components/UpgradeCard.jsx
tests/simulation/upgrades.test.js
```

### Phase 5 (14 files)

```
src/simulation/BossSystem.js
src/simulation/bosses/SentinelAI.js
src/simulation/bosses/SwarmCoreAI.js
src/simulation/bosses/ObeliskAI.js
src/simulation/bosses/patterns/BeamSpin.js
src/simulation/bosses/patterns/AimedBurst.js
src/simulation/bosses/patterns/RingWithGap.js
src/simulation/bosses/patterns/SummonMinions.js
src/simulation/bosses/patterns/ConeVolley.js
src/simulation/bosses/patterns/PulseRing.js
src/simulation/bosses/patterns/Slam.js
src/simulation/bosses/patterns/RicochetShards.js
src/simulation/bosses/patterns/LaneBeams.js
src/simulation/GameEndSystem.js
src/rendering/BossRenderer.js
```

### Phase 6 (16 files)

```
src/state/useMetaStore.js
src/state/useNotificationStore.js
src/config/achievements.js
src/config/affixes.js
src/systems/AchievementChecker.js
src/simulation/AffixSystem.js
src/ui/screens/TitleScreen.jsx
src/ui/screens/SummaryScreen.jsx
src/ui/screens/StatsScreen.jsx
src/ui/components/HUD.jsx
src/ui/components/HealthBar.jsx
src/ui/components/XPBar.jsx
src/ui/components/WaveIndicator.jsx
src/ui/components/CardRewardModal.jsx
src/ui/components/NotificationToast.jsx
src/ui/components/SettingsPanel.jsx
```

### Phase 7 (12 files)

```
src/network/NetworkManager.js
src/network/PeerConnection.js
src/network/RoomCodeGenerator.js
src/network/InputSync.js
src/network/InputPacket.js
src/network/StateSync.js
src/network/CorrectionPacket.js
src/simulation/MultiplayerSimulation.js
src/input/TwinInputManager.js
src/ui/components/MultiplayerLobby.jsx
src/ui/components/RoomCodeDisplay.jsx
src/ui/components/RoomCodeInput.jsx
```

### Phase 8 (12 files)

```
capacitor.config.js
electron/main.cjs
electron/preload.cjs
src/audio/SoundManager.js
src/audio/MusicManager.js
src/rendering/EffectsRenderer.js
src/rendering/ScreenEffects.js
src/rendering/TelegraphRenderer.js
src/simulation/InfiniteScaling.js
src/ui/input/VirtualSticks.jsx
src/utils/platform.js
src/utils/device.js
```

**Total: ~103 files**

---

## Testing Strategy

### Unit Tests (Per Phase)

-   Phase 1: Determinism, math utils, RNG
-   Phase 3: Enemy AI behaviors, collision detection
-   Phase 4: Upgrade stat calculations, synergy detection
-   Phase 5: Boss phase transitions, pattern timing
-   Phase 7: Input packet encoding, correction application

### Integration Tests

-   Full run simulation (no rendering)
-   Multiplayer sync under simulated latency
-   Save/load meta progression

### Manual Testing Checkpoints

-   Phase 2: Movement feels good
-   Phase 3: Combat is satisfying
-   Phase 4: Upgrades are noticeable
-   Phase 5: Boss is challenging but fair
-   Phase 6: Progression feels rewarding
-   Phase 7: Multiplayer is smooth
-   Phase 8: Native builds work

---

## Risk Mitigation

| Risk               | Mitigation                         |
| ------------------ | ---------------------------------- |
| Determinism breaks | Test after every simulation change |
| File size creep    | ESLint enforces 300-line limit     |
| Network desync     | Correction snapshots every 200ms   |
| Performance issues | Profile early, pool objects        |
| Scope creep        | Stick to v1 feature parity first   |

---

## Success Criteria

### MVP (Phase 5 Complete)

-   [ ] Solo play works end-to-end
-   [ ] All 7 enemy types functional
-   [ ] All 30 upgrades implemented
-   [ ] All 3 bosses beatable
-   [ ] Deterministic simulation verified

### Full Release (Phase 8 Complete)

-   [ ] Multiplayer stable
-   [ ] Meta-progression complete
-   [ ] Native builds functional
-   [ ] Performance targets met
-   [ ] Accessibility options available
