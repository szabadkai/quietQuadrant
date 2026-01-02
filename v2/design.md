# Design Document – Quiet Quadrant v2

## 1. Lessons Learned from v1

### 1.1 Code Architecture Issues

**Problem: Monolithic MainScene (4800+ lines)**

-   Single file handling: player logic, enemies, bullets, upgrades, networking, UI, audio, visual effects
-   Impossible to reason about, test, or modify safely
-   Changes in one system frequently broke others

**Solution for v2:**

-   Maximum file length: **300 lines** (hard limit)
-   Single responsibility per file
-   Systems communicate via events, not direct coupling

**Problem: State Scattered Everywhere**

-   Game state split between Phaser objects, Zustand stores, and local variables
-   Difficult to serialize for networking
-   Race conditions between React and Phaser updates

**Solution for v2:**

-   Single source of truth: compact simulation state
-   Phaser is purely a renderer (reads state, doesn't own it)
-   All game logic operates on the simulation state

**Problem: Networking Bolted On**

-   Multiplayer added after core game was complete
-   Required extensive refactoring of game loop
-   Multiple sync strategies attempted (state sync, input sync, hybrid)
-   Interpolation and prediction added complexity

**Solution for v2:**

-   Design for multiplayer from day one
-   Deterministic simulation with input-only sync
-   Simple, predictable networking model

### 1.2 Gameplay Issues

**Problem: Upgrade Balance Complexity**

-   Many interdependent upgrades created exponential balance space
-   Required extensive validation systems to prevent broken builds
-   Diminishing returns and caps felt arbitrary to players

**Solution for v2:**

-   Fewer upgrades with clearer effects
-   Additive stacking (not multiplicative) where possible
-   Natural caps through design, not artificial limits

**Problem: Visual Noise at High Intensity**

-   Late-game bullet counts overwhelmed the minimalist aesthetic
-   Hard to distinguish threats from effects
-   Performance degradation on lower-end devices

**Solution for v2:**

-   Strict particle/bullet budgets
-   Threat hierarchy through visual design
-   Performance-first visual effects

### 1.3 UX Issues

**Problem: Multiplayer Flow Friction**

-   Too many steps to start a game with a friend
-   Connection state unclear
-   No graceful handling of disconnects

**Solution for v2:**

-   Streamlined flow: 3 clicks to play together
-   Clear connection status at all times
-   Automatic reconnection attempts

---

## 2. Core Design Principles

### 2.1 Simplicity Over Features

Every feature must justify its complexity cost. If a feature requires more than 200 lines of code, it needs to be split or simplified.

### 2.2 Determinism First

The game simulation must be fully deterministic given the same inputs and seed. This enables:

-   Reliable multiplayer sync
-   Replay capability (future)
-   Easier debugging and testing

### 2.3 Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Phaser    │  │    React    │  │       Audio         │  │
│  │  Renderer   │  │     UI      │  │      Manager        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │ reads                             │
├──────────────────────────┼──────────────────────────────────┤
│                          ▼                                   │
│                   Game State Store                           │
│              (Single Source of Truth)                        │
│                          ▲                                   │
├──────────────────────────┼──────────────────────────────────┤
│                          │ updates                           │
│  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────┐  │
│  │   Input     │  │ Simulation  │  │      Network        │  │
│  │  Handler    │──▶│   Engine    │◀─│      Manager        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                      Logic Layer                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Data-Driven Design

Game content (enemies, upgrades, waves) defined in configuration files, not code. This enables:

-   Easy balancing without code changes
-   Clear separation of design and implementation
-   Potential for modding (future)

---

## 3. Simulation Design

### 3.1 State Structure

The entire game state fits in a compact, serializable structure:

```typescript
interface GameState {
    tick: number; // Current simulation tick
    seed: number; // RNG seed for determinism
    phase: "pregame" | "wave" | "intermission" | "boss" | "ended";

    players: {
        p1: PlayerState;
        p2: PlayerState | null; // null in solo mode
    };

    enemies: EnemyState[]; // Max 50 active
    bullets: BulletState[]; // Max 200 active (player + enemy)
    pickups: PickupState[]; // Max 30 active

    wave: {
        current: number;
        enemiesRemaining: number;
        spawnQueue: SpawnEvent[];
    };

    boss: BossState | null;
}

interface PlayerState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    maxHealth: number;
    xp: number;
    level: number;
    upgrades: string[]; // Upgrade IDs
    dashCooldown: number;
    invulnFrames: number;
    alive: boolean;
}

interface EnemyState {
    id: number;
    type: "drifter" | "watcher" | "mass";
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    elite: boolean;
    aiState: number; // Type-specific AI state
}

interface BulletState {
    id: number;
    owner: "p1" | "p2" | "enemy" | "boss";
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    pierce: number;
    ttl: number; // Time to live (frames)
}
```

### 3.2 Tick-Based Simulation

-   Fixed timestep: 60 ticks per second
-   Each tick processes: inputs → physics → collisions → spawns → cleanup
-   Deterministic RNG using seeded PRNG (same seed = same game)

### 3.3 Entity Limits

Hard caps to ensure performance and network efficiency:

-   Players: 2
-   Enemies: 50 active
-   Player bullets: 100 active
-   Enemy bullets: 100 active
-   Pickups: 30 active
-   Particles: 200 active (visual only, not synced)

---

## 4. Networking Design

### 4.1 Authority Model

**Host is authoritative for:**

-   RNG seed and all random decisions
-   Enemy spawning and AI
-   Enemy bullets
-   Pickup spawning
-   Wave progression
-   Boss behavior

**Each player is authoritative for:**

-   Their own movement
-   Their own bullets
-   Their own upgrade choices

### 4.2 Sync Protocol

**Input Packets (20Hz, ~20 bytes each):**

```typescript
interface InputPacket {
    tick: number; // 4 bytes
    moveX: int8; // 1 byte (-127 to 127, normalized)
    moveY: int8; // 1 byte
    aimX: int8; // 1 byte
    aimY: int8; // 1 byte
    flags: uint8; // 1 byte (fire, dash, etc.)
}
```

**Correction Snapshots (5Hz, ~500 bytes max):**

```typescript
interface CorrectionSnapshot {
    tick: number;
    players: { id: string; x: number; y: number }[];
    enemies: { id: number; x: number; y: number; health: number }[];
    // Only positions that have drifted beyond threshold
}
```

**Event Messages (as needed, variable size):**

```typescript
interface GameEvent {
    tick: number;
    type: "spawn" | "death" | "upgrade" | "wave" | "boss_phase";
    data: any;
}
```

### 4.3 Latency Handling

**For local player:**

-   Immediate response (no prediction needed, we're authoritative)

**For remote player:**

-   Interpolate between last two known positions
-   Extrapolate briefly if packets delayed
-   Snap to correction if drift > 50px

**For enemies (guest side):**

-   Run local simulation using same deterministic logic
-   Apply corrections from host when received
-   Smooth corrections over 100ms unless drift is large

### 4.4 Disconnect Handling

-   3-second timeout before declaring disconnect
-   Pause game on disconnect (both players)
-   30-second reconnection window
-   If reconnection fails, end run gracefully

---

## 5. Upgrade Design

### 5.1 Design Philosophy

**Additive over Multiplicative:**

-   "+15% damage" not "1.15x damage"
-   Prevents exponential scaling
-   Easier to balance and understand

**Immediate Feedback:**

-   Every upgrade should be noticeable within 5 seconds
-   Visual or audio change accompanies stat change

**No Trap Choices:**

-   Every upgrade should feel good to pick
-   Situationally better/worse is fine, never bad

**Three Rarity Tiers:**

-   Common (65%): Reliable stat boosts, stackable
-   Rare (30%): Powerful effects, limited stacks
-   Legendary (5%): Build-defining, max 1 stack

### 5.2 Upgrade Categories

**Offense (14 common, 8 rare, 4 legendary):**

Common:

1. **Power Shot** - +15% damage, +5% crit per stack (max 6)
2. **Rapid Fire** - +15% fire rate per stack (max 6)
3. **Swift Projectiles** - +20% projectile speed (max 6)
4. **Sidecar Shot** - +1 projectile with spread (max 3)
5. **Piercing Rounds** - +1 pierce (max 3)
6. **Heavy Barrel** - +25% size, +20% damage, -10% fire rate (max 3)
7. **Rebound** - +2 ricochets, -5% speed (max 3)
8. **Held Charge** - Hold fire for +80% charged shot (max 3)

Rare:

1. **Shrapnel** - Kills spray forward fragments (max 2)
2. **Prism Spread** - Tighter multi-shot, +crit (max 2)
3. **Split Shot** - First hit splits into two shards (max 2)
4. **Explosive Impact** - AoE on hit (max 3)
5. **Chain Arc** - Kill arcs lightning to nearest (max 2)
6. **Heatseeker** - Gentle homing (max 3)
7. **Volatile Compounds** - Enemies explode on death (max 5)
8. **Berserk Module** - Lower HP = faster fire (max 3)

Legendary:

1. **Glass Cannon** - +150% damage, +8% crit, max HP = 1
2. **Bullet Hell** - +200% fire rate, -80% accuracy, -30% damage
3. **Singularity Rounds** - Pull enemies into impact
4. **Neutron Core** - Heavy spheres block shots, -40% speed

**Defense (4 common, 2 rare):**

1. **Light Plating** - +1 HP, -8% damage taken (max 4)
2. **XP Shield** - XP grants 1-hit shield (max 3)
3. **Kinetic Siphon** - Heal on kill, cooldown (max 3)
4. **Stabilizers** - Reduce collision damage (max 3)
5. **Blood Fuel** (rare) - Kills heal, firing costs HP (max 1)
6. **Quantum Tunneling** (rare) - Projectiles through walls (max 1)

**Utility (4 common, 2 rare):**

1. **Engine Tune** - +10% move speed (max 6)
2. **Dash Sparks** - Dash detonates shrapnel (max 3)
3. **Magnet Coil** - +50% XP radius (max 3)
4. **Momentum Feed** (rare) - Moving builds fire rate (max 2)

### 5.3 Synergy System

Certain upgrade combinations unlock special bonuses:

| Synergy           | Requirements                   | Bonus                                      |
| ----------------- | ------------------------------ | ------------------------------------------ |
| Black Hole Sun    | Singularity + Volatile         | Clump + chain explosion                    |
| Railgun           | Held Charge + Quantum + Swift  | Pierce everything, +5% crit, +25% crit dmg |
| Meat Grinder      | Neutron + Shrapnel             | Bullet-plow, +3% crit, +15% crit dmg       |
| Frame Rate Killer | Bullet Hell + Rebound + Split  | Arena flood                                |
| Vampire           | Blood Fuel + Berserk           | Health-as-ammo frenzy, +3% crit            |
| Tesla Coil        | Chain Arc + Explosive          | Chain reactions, +15% arc dmg              |
| Glass Storm       | Glass Cannon + Bullet Hell     | Accuracy penalty -50%                      |
| Phantom Striker   | Dash Sparks + Shrapnel         | Dash cooldown -25%                         |
| Gravity Well      | Singularity + Explosive        | Explosion radius +30%                      |
| Sniper Elite      | Held Charge + Heatseeker       | Homing 2x on charged, +10% crit dmg        |
| Immortal Engine   | XP Shield + Kinetic Siphon     | Shield duration +50%                       |
| Prism Cannon      | Prism + Heavy Barrel + Sidecar | Focused beam, +8% crit                     |

### 5.4 Balance Constraints

-   Max total damage bonus: +90% (6 stacks × 15%)
-   Max total fire rate bonus: +90% (6 stacks × 15%)
-   Max damage reduction: 32% (4 stacks × 8%)
-   Max projectiles: 4 (base 1 + 3 stacks)
-   Diminishing returns kick in after 3-4 stacks

---

## 6. Enemy Design

### 6.1 Drifter

**Behavior:**

-   Accelerates toward nearest player
-   Max speed: 100 px/s
-   Turns slowly (can be kited)

**Stats:**

-   Health: 22 (base), 37 (elite)
-   Damage: 1 (contact)
-   XP: 10

**Elite Behavior:** Burst movement (sudden dashes toward player)

**Visual:**

-   Small circle
-   Pulsing glow when close to player

### 6.2 Watcher

**Behavior:**

-   Maintains 200-300px distance from nearest player
-   Fires aimed shot every 1.8 seconds
-   Retreats if player gets too close

**Stats:**

-   Health: 35 (base), 60 (elite)
-   Bullet damage: 1
-   Bullet speed: 145 px/s
-   XP: 25

**Elite Behavior:** Rapid fire (faster shooting)

**Visual:**

-   Diamond shape
-   "Eye" indicator shows aim direction
-   Brief charge-up before firing

### 6.3 Mass

**Behavior:**

-   Slow pursuit of nearest player
-   Every 2.8 seconds: stops, telegraphs, releases radial burst
-   Burst has 8 bullets in a circle

**Stats:**

-   Health: 85 (base), 145 (elite)
-   Bullet damage: 1
-   Bullet speed: 110 px/s
-   Contact damage: 2
-   XP: 50

**Elite Behavior:** Burst movement + death explosion

**Visual:**

-   Large hexagon
-   Pulses/grows during telegraph
-   Distinct color during attack

### 6.4 Phantom

**Behavior:**

-   Teleports to random position near player every 3-4 seconds
-   Brief vulnerability window after teleport
-   Contact damage only

**Stats:**

-   Health: 18 (base), 31 (elite)
-   Damage: 1 (contact)
-   Speed: 80 px/s
-   XP: 20

**Elite Behavior:** More frequent teleports

**Visual:**

-   Translucent, flickering sprite
-   Fade-out/fade-in on teleport

### 6.5 Orbiter

**Behavior:**

-   Circles around player at fixed distance
-   Fires while orbiting every 2.2 seconds
-   Changes orbit direction randomly

**Stats:**

-   Health: 28 (base), 48 (elite)
-   Bullet damage: 1
-   Bullet speed: 130 px/s
-   Speed: 120 px/s
-   XP: 30

**Elite Behavior:** Rapid fire while circling

**Visual:**

-   Ring shape
-   Orbit trail effect

### 6.6 Splitter

**Behavior:**

-   Moves toward player slowly
-   On death, splits into 2-3 smaller versions
-   Smaller versions have reduced stats

**Stats:**

-   Health: 50 (base), 85 (elite)
-   Damage: 1 (contact)
-   Speed: 55 px/s
-   XP: 35 (+ XP from splits)

**Elite Behavior:** Death explosion

**Visual:**

-   Cluster of connected circles
-   Visually "breaks apart" on death

---

## 7. Boss Design

### 7.1 Overview

Three boss types, randomly selected per run. Each has unique patterns and tuning.

### 7.2 Sentinel Core

**Description:** Tracks the player and alternates beam spins with aimed bursts.

**Tuning:** +40% health, +10% speed

**Patterns:**

-   **Beam Spin:** Rotating beam sweeps arena
-   **Aimed Burst:** 5 bullets toward each player
-   **Ring with Gap:** Radial burst with safe zone

**Phases:**

-   Phase 1 (100-66%): Beam spin + aimed burst
-   Phase 2 (66-33%): Faster patterns, adds ring
-   Phase 3 (33-0%): All patterns, highest intensity

### 7.3 Swarm Core

**Description:** Spawns escort minions, fires cone volleys, drops radial pulses.

**Tuning:** +30% health, +15% speed, +10% fire rate

**Patterns:**

-   **Summon Minions:** Spawns 3-5 drifters
-   **Cone Volley:** Wide spread toward player
-   **Pulse Ring:** Expanding ring of bullets

**Phases:**

-   Phase 1: Summon + cone volley
-   Phase 2: More minions, adds pulse ring
-   Phase 3: Constant minion spawns, all patterns

### 7.4 Obelisk

**Description:** Telegraphs slams, ricochets shards, locks lanes with beams.

**Tuning:** +50% health, +15% projectile speed

**Patterns:**

-   **Slam:** Telegraphed area damage
-   **Ricochet Shards:** Bouncing projectiles
-   **Lane Beams:** Horizontal/vertical danger zones

**Phases:**

-   Phase 1: Slam + ricochet
-   Phase 2: Adds lane beams
-   Phase 3: Overlapping patterns, faster slams

### 7.5 Telegraphing

Every attack has a 0.5-1 second telegraph:

-   Visual: Boss glows/pulses in attack color
-   Audio: Distinct charge-up sound
-   Pattern indicator: Faint preview of bullet paths

---

## 8. Wave Design

### 8.1 Wave Structure

| Wave | Enemies | Composition                                                                          | Notes                  |
| ---- | ------- | ------------------------------------------------------------------------------------ | ---------------------- |
| 1    | 3       | 3 Drifters                                                                           | Tutorial               |
| 2    | 4       | 3 Drifters, 1 Watcher                                                                | Introduce Watchers     |
| 3    | 6       | 4 Drifters, 1 Watcher, 1 Phantom                                                     | Introduce Phantom      |
| 4    | 7       | 4 Drifters, 2 Watchers, 1 Orbiter                                                    | Introduce Orbiter      |
| 5    | 9       | 5 Drifters, 2 Watchers, 1 Phantom, 1 Mass                                            | Introduce Mass         |
| 6    | 10      | 5 Drifters, 2 Elite Watchers, 2 Orbiters, 1 Splitter                                 | First elites, Splitter |
| 7    | 12      | 6 Drifters, 2 Elite Watchers, 2 Phantoms, 1 Orbiter, 1 Mass                          | Ramp up                |
| 8    | 15      | 6 Drifters, 3 Elite Watchers, 2 Phantoms, 2 Orbiters, 1 Splitter, 1 Mass             | Challenge              |
| 9    | 17      | 7 Elite Drifters, 3 Elite Watchers, 2 Elite Phantoms, 2 Orbiters, 1 Splitter, 2 Mass | Pre-boss               |
| 10   | 19      | All elite: 8 Drifters, 3 Watchers, 2 Phantoms, 2 Orbiters, 2 Splitters, 2 Mass       | Final wave             |
| 11   | Boss    | Random boss type                                                                     | Boss fight             |

### 8.2 Spawn Timing

-   Enemies spawn in groups of 3-5
-   2-second delay between spawn groups
-   Spawn positions: edges of arena, away from players
-   Visual cue: spawn point indicator 1 second before spawn

### 8.3 Intermission

-   3 seconds between waves
-   Screen dims slightly
-   "Wave X" text appears
-   Players can still move (no shooting)

### 8.4 Infinite Mode Scaling

After wave 10, waves repeat with scaling:

-   +10% enemy health per cycle
-   +5% enemy speed per cycle
-   +1 elite per wave per cycle
-   Boss appears every 10 waves

---

## 9. Progression & Pacing

### 9.1 XP Curve

| Level | XP Required | Cumulative | Typical Wave |
| ----- | ----------- | ---------- | ------------ |
| 2     | 50          | 50         | 1            |
| 3     | 75          | 125        | 2            |
| 4     | 100         | 225        | 3            |
| 5     | 125         | 350        | 4            |
| 6     | 150         | 500        | 5            |
| 7     | 175         | 675        | 6            |
| 8     | 200         | 875        | 7            |
| 9     | 225         | 1100       | 8            |
| 10    | 250         | 1350       | 9            |

Players should reach level 8-10 by boss fight.

### 9.2 XP Sources

-   Drifter: 10 XP
-   Watcher: 25 XP
-   Mass: 50 XP
-   Elite bonus: +50%
-   Boss: 500 XP (for summary stats)

### 9.3 Difficulty Scaling

In multiplayer:

-   Enemy health: +30%
-   Enemy count: +20%
-   XP drops: +50% (split between players)

---

## 10. Visual Hierarchy

### 10.1 Depth Layers (back to front)

1. Background (starfield)
2. Arena bounds
3. Spawn indicators
4. Pickups
5. Enemy bullets
6. Enemies
7. Player bullets
8. Players
9. Effects (explosions, particles)
10. UI

### 10.2 Color Coding

| Element          | Color             | Hex       |
| ---------------- | ----------------- | --------- |
| Player           | White             | #FFFFFF   |
| Player bullets   | Cyan              | #00FFFF   |
| Enemies          | Gray              | #888888   |
| Elite enemies    | Light gray        | #AAAAAA   |
| Enemy bullets    | Orange            | #FF8800   |
| Boss             | Purple            | #AA00FF   |
| Boss bullets     | Magenta           | #FF00FF   |
| XP pickups       | Green             | #00FF00   |
| Health pickups   | Red               | #FF0000   |
| Danger telegraph | Red (transparent) | #FF000044 |

### 10.3 Size Guidelines

-   Player ship: 24x24 px
-   Drifter: 16x16 px
-   Watcher: 20x20 px
-   Mass: 32x32 px
-   Boss: 64x64 px
-   Player bullet: 8x4 px
-   Enemy bullet: 6x6 px
-   XP pickup: 8x8 px

---

## 11. Audio Design

### 11.1 Sound Budget

-   Simultaneous sounds: max 8
-   Priority: Player damage > Boss attacks > Player shots > Enemy deaths > Ambient

### 11.2 Sound List

| Event             | Sound             | Duration | Priority |
| ----------------- | ----------------- | -------- | -------- |
| Player shoot      | Soft pew          | 100ms    | 3        |
| Player hit        | Impact + alarm    | 300ms    | 1        |
| Player dash       | Whoosh            | 200ms    | 2        |
| Enemy hit         | Thud              | 50ms     | 4        |
| Enemy death       | Pop               | 150ms    | 4        |
| XP pickup         | Chime             | 100ms    | 5        |
| Level up          | Fanfare           | 500ms    | 2        |
| Boss attack       | Charge + release  | 500ms    | 1        |
| Boss phase change | Dramatic sting    | 1000ms   | 1        |
| Wave start        | Announcement tone | 300ms    | 2        |

---

## 12. Performance Budgets

### 12.1 Frame Budget (16.67ms for 60fps)

| System              | Budget |
| ------------------- | ------ |
| Simulation tick     | 2ms    |
| Collision detection | 2ms    |
| Rendering           | 8ms    |
| Network processing  | 1ms    |
| Audio               | 1ms    |
| Headroom            | 2.67ms |

### 12.2 Memory Budget

| Category   | Budget |
| ---------- | ------ |
| Game state | 50KB   |
| Textures   | 5MB    |
| Audio      | 10MB   |
| Code       | 500KB  |
| Total      | <20MB  |

### 12.3 Network Budget

| Direction             | Budget          |
| --------------------- | --------------- |
| Upload (per player)   | 2KB/s           |
| Download (per player) | 5KB/s           |
| Packet rate           | 20-25 packets/s |

---

## 13. Meta-Progression Design

### 13.1 Design Philosophy

**Reward, Don't Gate:**

-   Core gameplay available from first run
-   Meta-progression expands options, not power
-   Cosmetics and bragging rights, not gameplay advantages

**Respect Player Time:**

-   Every run contributes to progression (win or lose)
-   No grinding required for core experience
-   Achievements celebrate skill, not time investment

### 13.2 Pilot Rank System

**Purpose:** Give players a sense of long-term progression without affecting gameplay balance.

**XP Sources:**

-   Base XP for completing a run: 50
-   Per wave cleared: 10
-   Per enemy killed: 1
-   Boss defeated bonus: 100
-   Multiplayer bonus: +25%

**Rank Rewards (cosmetic only):**
| Rank | XP Required | Reward |
|------|-------------|--------|
| 2 | 100 | Ship color: Blue |
| 5 | 600 | Title: "Veteran" |
| 8 | 1500 | Ship trail effect |
| 10 | 2800 | Ship color: Gold |
| 15 | 6600 | Title: "Elite" |
| 20 | 19000 | Golden ship outline |

### 13.3 Card Collection System

**Purpose:** Gradual unlock of upgrade variety, creating progression feel without power creep.

**Starting State:**

-   10 core upgrades unlocked (balanced starter set)
-   Includes synergy-enabling pairs (e.g., XP Shield + Kinetic Siphon)

**Unlock Mechanics:**

-   Defeating boss triggers card reward
-   Choose 1 of 3 options:
    -   Unlock a new upgrade (if locked)
    -   Boost an existing upgrade (+drop weight, max 5)
-   Weighted selection favors legendaries for excitement

**Progression Curve:**

-   ~15-20 boss kills to unlock full catalog
-   Boosts provide long-term engagement after unlocks
-   Locked upgrades never appear in runs

### 13.4 Daily Streak System

**Tracking:**

-   Consecutive days with at least one run
-   Streak increments on first run of new day
-   Streak resets if day is skipped

**UI:**

-   Popup on day 2+ showing streak count
-   Best streak tracked in lifetime stats

### 13.5 Weekly Affix System

**Purpose:** Add variety and challenge to repeat play.

**Mechanics:**

-   New affix each week (seeded by date)
-   Affects enemy stats, player stats, upgrade odds
-   Displayed on title screen before run

**Example Affixes:**

| Affix         | Effect                                       |
| ------------- | -------------------------------------------- |
| Nimble Foes   | +12% enemy speed, -10% enemy health          |
| Ironclad      | +18% enemy health, -8% enemy speed           |
| Overclocked   | +20% player damage, +15% enemy damage        |
| Golden Age    | +5% legendary odds, +10% rare odds           |
| Tough Choices | Only 2 upgrade choices, +20% XP              |
| Elite Forces  | +25% elite spawn chance                      |
| Enraged Boss  | +20% boss health, +15% boss projectile speed |

**Stats Tracking:**

-   Play count per affix
-   Win count per affix
-   Enables "beat every affix" achievement

### 13.6 Achievement Design

**Categories:**

**Progression (natural milestones):**

-   First kill, first wave 5, first boss kill
-   Designed to be unlocked through normal play

**Skill (challenge goals):**

-   No-damage boss, speed runs, accuracy challenges
-   Require intentional effort and mastery

**Build (playstyle exploration):**

-   Encourage trying different upgrade paths
-   "Win with X" achievements

**Synergy (discovery):**

-   Unlock each synergy at least once
-   Encourages experimentation

**Multiplayer (social):**

-   Reward playing with friends
-   Encourage cooperation

**Secret (discovery):**

-   Hidden until unlocked
-   Reward experimentation and edge cases

### 13.7 Notification Timing

**During Gameplay:**

-   Notifications appear but don't interrupt
-   Small, non-blocking toasts in corner
-   Sound cue draws attention without distraction

**End of Run:**

-   Full achievement display with fanfare
-   XP gain and rank progress shown
-   Personal bests highlighted
-   Card reward selection (if boss defeated)

### 13.8 Statistics Philosophy

**Track What Matters:**

-   Stats that players care about comparing
-   Stats that help players improve
-   Stats that tell the story of their journey

**Comprehensive Tracking:**

-   Per-upgrade pick counts
-   Per-synergy unlock counts
-   Per-boss encounter/kill counts
-   Per-affix play/win counts
-   Per-mode play/win counts

**Avoid Vanity Metrics:**

-   Don't track things that encourage unhealthy play
-   Focus on skill indicators, not time sinks
