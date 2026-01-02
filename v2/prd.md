# Product Requirements Document – Quiet Quadrant v2

## 1. Overview

**Working Title:** Quiet Quadrant v2

**High-Level Concept:**  
A compact roguelike space shooter with seamless P2P multiplayer. Players pilot fragile ships in a bounded arena, surviving escalating waves and a bullet-hell boss. The game prioritizes clean UX, readable visuals, and smooth online co-op without dedicated servers.

**One-Liner:**  
"A minimalist void where clean lines, tight movement, and small choices decide survival—now with a friend."

**Platform & Input:**

-   Primary: Desktop browser (WebGL)
-   Secondary: Mobile browser (touch controls)
-   Native: iOS/Android (Capacitor), Windows/macOS/Linux (Electron)
-   Input: Keyboard + mouse, gamepad, virtual touch sticks

**Target Run Length:** 12–18 minutes for a successful full run

---

## 2. Core Experience Goals

### 2.1 Player Experience Pillars

1. **Instant Playability**

    - Game loads and starts within 3 seconds
    - Controls understood within 10 seconds
    - First meaningful gameplay within 30 seconds

2. **Readable Chaos**

    - Even at peak intensity, players can track their ship, threats, and safe zones
    - Color and shape language is consistent and learnable
    - No visual noise without gameplay meaning

3. **Meaningful Choices**

    - Every upgrade noticeably changes how the run feels
    - No "trap" upgrades that feel bad to pick
    - Build diversity emerges naturally from upgrade combinations

4. **Seamless Multiplayer**
    - Join a friend's game with a 6-character code
    - No perceptible desync or rubber-banding
    - Both players feel equally capable and important

---

## 3. User Flows

### 3.1 Solo Play Flow

```
Title Screen → [Play] → Run Starts → Waves → Level Up → Upgrade Selection →
More Waves → Boss → Victory/Defeat → Summary → [Play Again]
```

### 3.2 Multiplayer Host Flow

```
Title Screen → [Multiplayer] → [Host Game] → Room Code Displayed →
Wait for Friend → [Start] → Synchronized Run → Summary → [Play Again]
```

### 3.3 Multiplayer Join Flow

```
Title Screen → [Multiplayer] → [Join Game] → Enter Code →
Connected → Wait for Host Start → Synchronized Run → Summary → [Play Again]
```

---

## 4. Core Gameplay Features

### 4.1 Player Ship

**Movement:**

-   8-directional movement with smooth acceleration/deceleration
-   Bounded to arena edges with clear visual feedback
-   Movement speed upgradeable

**Primary Weapon:**

-   Auto-fire when aiming (hold to shoot)
-   Base: single forward projectile
-   Upgradeable: damage, fire rate, projectile count, spread, pierce, bounce

**Active Ability (Dash):**

-   Short invulnerable dash on cooldown
-   Clear visual trail during dash
-   Cooldown indicator always visible

**Health:**

-   5 HP base (upgradeable)
-   Brief invulnerability after taking damage
-   Clear damage feedback (flash, sound, screen shake)
-   No passive regeneration (healing via upgrades only)

### 4.2 Enemies

**Seven Enemy Types:**

1. **Drifter (Chaser)** - Moves toward player, low HP, moderate speed, spawns in groups

2. **Watcher (Shooter)** - Maintains distance, fires aimed projectiles, medium HP

3. **Mass (Tank)** - Slow, high HP, telegraphed radial burst attacks

4. **Phantom (Teleporter)** - Low HP, teleports unpredictably, hard to track

5. **Orbiter (Circler)** - Circles around player while shooting, medium HP

6. **Splitter (Divider)** - Medium HP, splits into smaller enemies on death

7. **Boss** - End-wave encounter with multiple attack patterns

**Elite Variants:**

-   +70% health, +25% speed, +20% damage
-   Thicker outlines, distinct visual glow
-   Special behaviors per type:
    -   Drifter Elite: Burst movement (sudden dashes)
    -   Watcher Elite: Rapid fire mode
    -   Mass Elite: Burst movement + death explosion
    -   Phantom Elite: More frequent teleports
    -   Orbiter Elite: Faster firing while circling
    -   Splitter Elite: Explodes on death

### 4.3 Boss Encounters

**Three Boss Types (randomly selected per run):**

1. **Sentinel Core** - Tracks player, alternates beam spins with aimed bursts

    - Patterns: beam-spin, aimed-burst, ring-with-gap
    - +40% health, +10% speed

2. **Swarm Core** - Spawns escort minions, fires cone volleys

    - Patterns: summon-minions, cone-volley, pulse-ring
    - +30% health, +15% speed, +10% fire rate

3. **Obelisk** - Telegraphs slams, ricochets shards, locks lanes with beams
    - Patterns: slam, ricochet-shards, lane-beams
    - +50% health, +15% projectile speed

**Structure:**

-   Appears on final wave (wave 11)
-   3 distinct phases at health thresholds (100%, 66%, 33%)
-   Each phase adds/modifies bullet patterns

**Fairness:**

-   All attacks have 0.5-1s readable tells
-   Patterns are learnable, not random
-   No instant-kill mechanics

### 4.4 Upgrade System

**Trigger:** XP bar fills → Level up → Choose 1 of 3 upgrades

**Rarity Distribution:**

-   65% Common, 30% Rare, 5% Legendary

**Common Upgrades (14 total):**

-   Power Shot: +15% damage, +5% crit
-   Rapid Fire: +15% fire rate
-   Swift Projectiles: +20% projectile speed
-   Engine Tune: +10% movement speed
-   Light Plating: +1 HP, -8% incoming damage
-   Sidecar Shot: +1 projectile with spread
-   Piercing Rounds: +1 pierce
-   Heavy Barrel: +25% size, +20% damage, -10% fire rate
-   Rebound: +2 ricochets, -5% speed
-   Dash Sparks: Dash detonates shrapnel burst
-   Held Charge: Hold fire for +80% damage charged shot
-   XP Shield: Collecting XP grants 1-hit shield
-   Magnet Coil: +50% XP pickup radius
-   Stabilizers: Reduce collision damage/knockback

**Rare Upgrades (12 total):**

-   Shrapnel: Kills spray forward fragments
-   Kinetic Siphon: Heal on kill (cooldown)
-   Prism Spread: Tighter multi-shot, +crit chance
-   Momentum Feed: Moving builds +25% fire rate
-   Split Shot: First hit splits into two shards
-   Explosive Impact: AoE on hit
-   Chain Arc: Kill arcs lightning to nearest enemy
-   Heatseeker Rounds: Gentle homing
-   Blood Fuel: Kills heal, firing costs HP
-   Volatile Compounds: Enemies explode on death
-   Quantum Tunneling: Projectiles through walls
-   Berserk Module: Lower HP = faster fire

**Legendary Upgrades (4 total):**

-   Neutron Core: Heavy spheres block enemy shots, -40% speed
-   Glass Cannon: +150% damage, +8% crit, max HP capped at 1
-   Singularity Rounds: Pull enemies into impact point
-   Bullet Hell: +200% fire rate, -80% accuracy, -30% damage

**Balance Constraints:**

-   Diminishing returns after 3-4 stacks
-   Max stacks vary per upgrade (1-6)
-   Max damage reduction: 50%

### 4.5 Synergy System

**Concept:** Certain upgrade combinations unlock special bonuses

**Example Synergies (13 total):**

-   **Black Hole Sun:** Singularity + Volatile Compounds = clump + chain explosion
-   **Railgun:** Held Charge + Quantum Tunneling + Swift = pierce everything
-   **Meat Grinder:** Neutron Core + Shrapnel = bullet-plow with crits
-   **Tesla Coil:** Chain Arc + Explosive = devastating chain reactions
-   **Vampire:** Blood Fuel + Berserk = health-as-ammo frenzy
-   **Gravity Well:** Singularity + Explosive = pull into explosions
-   **Immortal Engine:** XP Shield + Kinetic Siphon = near-invulnerability

**Discovery:**

-   Synergies unlock automatically when requirements met
-   Toast notification announces new synergy
-   Synergy icon appears in HUD

### 4.6 Wave Progression

**Wave Count:** 10 waves + boss

**Pacing:**

-   Waves 1-4: Tutorial (Drifters, then Watchers, Phantoms, Orbiters)
-   Waves 5-7: Core game (mixed enemies, first elites, Mass, Splitters)
-   Waves 8-10: Challenge (high density, all types, many elites)
-   Wave 11: Boss

**Intermission:**

-   3-second countdown between waves
-   Visual dimming during countdown
-   Clear "Wave X" announcement

### 4.7 Weekly Affixes

**Concept:** Weekly modifiers that change gameplay for variety

**Example Affixes (18 total):**

-   **Nimble Foes:** +12% enemy speed, -10% enemy health
-   **Ironclad:** +18% enemy health, -8% enemy speed
-   **Volatile Finds:** +15% rare upgrade odds
-   **Overclocked:** +20% player damage, +15% enemy damage
-   **Adrenaline Rush:** +15% player speed, -20% dash cooldown
-   **Fast Learner:** +30% XP gain, -10% player damage
-   **Golden Age:** +5% legendary odds, +10% rare odds
-   **Tough Choices:** Only 2 upgrade choices, +20% XP
-   **Abundance:** 4 upgrade choices, -15% XP
-   **Bullet Storm:** +25% enemy projectile speed
-   **Swarm Tactics:** +20% enemy count, -15% enemy health
-   **Elite Forces:** +25% elite spawn chance
-   **Enraged Boss:** +20% boss health, +15% boss projectile speed
-   **Chaos Mode:** +15% everything (enemy speed, damage, player damage)

**Rotation:**

-   New affix each week (seeded by date)
-   Affix displayed on title screen
-   Stats track wins per affix

### 4.8 Game Modes

**Standard Mode:** 10 waves + boss, default experience

**Infinite Mode:** Endless waves with scaling difficulty

-   No boss, waves repeat with increasing stats
-   Leaderboard tracks highest wave reached
-   XP and upgrades continue indefinitely

**Twin Mode (Local Co-op):** Two players on same device

-   Split controls (WASD + arrows, or two gamepads)
-   Shared screen, shared health pool
-   Both players must survive

**Online Mode:** P2P multiplayer with friend

-   6-character room codes
-   Shared health pool
-   Independent upgrade choices

---

## 5. Multiplayer Features

### 5.1 Connection

**Technology:** WebRTC peer-to-peer via Trystero

**Room System:**

-   6-character alphanumeric codes
-   No account required
-   Rooms auto-close when empty

**Connection States:**

-   Disconnected → Connecting → Connected → In Game
-   Clear UI feedback for each state
-   Graceful handling of disconnects

### 5.2 Synchronization

**Authority Model:**

-   Host authoritative for: enemies, enemy bullets, waves, pickups, RNG
-   Each player authoritative for: their ship, their bullets

**Sync Method:**

-   Input-based sync (not position sync)
-   20Hz input broadcast
-   5Hz correction snapshots from host
-   Fire-and-forget projectile spawns

**Latency Handling:**

-   Client-side prediction for local player
-   Interpolation for remote entities
-   Correction threshold: 50px (snap if exceeded)

### 5.3 Shared Experience

**Upgrades:**

-   Both players level up independently
-   Upgrade choices are private
-   Both players see each other's current upgrades in HUD

**Health:**

-   Shared health pool (both players contribute to survival)
-   Either player taking damage hurts the team
-   Clear indication of who took damage

**Victory/Defeat:**

-   Both players must survive for victory
-   If one player dies, they respawn after 10 seconds (once per run)
-   If both die, run ends

---

## 6. Visual Design

### 6.1 Aesthetic

**Style:** Minimalist vector, mostly monochrome

**Color Usage:**

-   White/gray: Player, UI, neutral elements
-   Cyan accent: XP, pickups, positive feedback
-   Orange/red: Danger, damage, enemy attacks
-   Gold: Rare upgrades, special moments

**Shape Language:**

-   Player: Distinct triangle silhouette
-   Enemies: Unique shapes per type (circle, diamond, hexagon)
-   Bullets: Small, high-contrast dots/lines

### 6.2 Feedback

**Hits:**

-   Enemy flash on damage
-   Damage numbers (optional, off by default)

**Kills:**

-   Brief particle burst
-   XP orb spawn

**Player Damage:**

-   Screen flash
-   Ship blink
-   Subtle screen shake

**Level Up:**

-   Distinct audio cue
-   Brief time slow
-   Radial pulse from player

**Boss Phase Change:**

-   Screen tint shift
-   Boss visual transformation
-   Audio cue

### 6.3 UI Elements

**HUD (Always Visible):**

-   Health bar (top-left)
-   XP bar (bottom)
-   Wave indicator (top-center)
-   Dash cooldown (near player or corner)
-   Multiplayer: Partner health indicator

**Menus:**

-   Centered, modal overlays
-   Large touch targets for mobile
-   Keyboard navigation support

---

## 7. Audio Design

### 7.1 Music

-   Ambient electronic soundtrack
-   Intensity increases with wave progression
-   Boss has distinct theme
-   Seamless loops

### 7.2 Sound Effects

-   Shoot: Soft, non-fatiguing
-   Hit: Satisfying impact
-   Kill: Brief, rewarding
-   Damage taken: Alarming but not harsh
-   Level up: Celebratory chime
-   Dash: Whoosh
-   Boss attacks: Distinct per pattern type

### 7.3 Settings

-   Master volume
-   Music volume
-   SFX volume
-   All persist across sessions

---

## 8. Platform Considerations

### 8.1 Desktop Browser

-   Keyboard + mouse primary
-   Gamepad support (Xbox/PlayStation layouts)
-   60fps target
-   Works in Chrome, Firefox, Safari, Edge

### 8.2 Mobile Browser

-   Virtual dual-stick controls
-   Left stick: movement
-   Right stick: aim + auto-fire
-   Responsive layout for various screen sizes
-   Touch-friendly UI elements

### 8.3 Native Mobile (Capacitor)

-   iOS App Store and Google Play distribution
-   Haptic feedback on damage, kills, achievements
-   Safe area handling for notches and home indicators
-   Background/foreground state management
-   Push notifications for multiplayer invites (future)

### 8.4 Desktop App (Electron)

-   Windows, macOS, Linux builds
-   Native window controls and menus
-   F11 fullscreen toggle
-   Splash screen on launch
-   Auto-updater support
-   Steam distribution ready (future)

### 8.5 Performance

-   Target: 60fps on mid-range devices
-   Graceful degradation for low-end
-   Particle count limits
-   Object pooling for bullets/enemies

---

## 9. Accessibility

### 9.1 Visual

-   High contrast mode option
-   Colorblind-friendly palette (no red/green only distinctions)
-   Screen shake can be disabled
-   UI scale options

### 9.2 Input

-   Fully rebindable controls
-   One-handed play mode (auto-aim option)
-   Adjustable sensitivity

### 9.3 Audio

-   Visual indicators for all audio cues
-   Subtitles for any voice/text

---

## 10. Success Metrics

### 10.1 Engagement

-   Average session length: 15+ minutes
-   Return rate: 30%+ play again immediately
-   Multiplayer adoption: 20%+ of sessions

### 10.2 Quality

-   First-run completion rate: 10-20% (challenging but fair)
-   Crash rate: <0.1%
-   Multiplayer desync reports: <1%

### 10.3 Feedback

-   "Easy to understand" in player feedback
-   "Satisfying to play" in player feedback
-   "Multiplayer works smoothly" in player feedback

---

## 11. Out of Scope (v2)

-   Multiple ship types
-   Endless mode
-   Replays
-   More than 2 players
-   Voice chat

---

## 12. Meta-Progression System

### 12.1 Overview

Light meta-progression that rewards play without gating content. Core gameplay is available from the start - meta unlocks expand options and provide bragging rights.

### 12.2 Pilot Rank

**XP System:**

-   Earn Pilot XP from completed runs (win or lose)
-   XP scales with: waves cleared, enemies killed, boss damage dealt
-   Ranks 1-20 with increasing XP thresholds

**Rank Rewards:**

-   Rank 2: Unlock ship color palette #2
-   Rank 5: Unlock "Veteran" title
-   Rank 10: Unlock ship trail effect
-   Rank 15: Unlock "Elite" title
-   Rank 20: Unlock golden ship outline

### 12.3 Card Collection System

**Concept:** Unlock and boost upgrades through play

**Mechanics:**

-   Start with 10 core upgrades unlocked
-   Defeating boss triggers card reward selection
-   Choose 1 of 3 cards: unlock new upgrade OR boost existing (+drop weight)
-   Max 5 boosts per upgrade
-   Locked upgrades won't appear in runs

**Progression Feel:**

-   Early runs: Limited but focused upgrade pool
-   Mid progression: More variety, synergy options open up
-   Late progression: Full catalog, boosted favorites appear more often

### 12.4 Daily Streaks

**Tracking:**

-   Consecutive days played
-   Streak popup on day 2+
-   Best streak recorded in lifetime stats

**Rewards (future):**

-   Streak milestones could unlock cosmetics
-   No gameplay advantages

### 12.5 Statistics Tracking

**Per-Run Stats:**

-   Time survived
-   Waves cleared
-   Enemies destroyed (by type)
-   Damage dealt / taken
-   Upgrades collected
-   Synergies unlocked
-   Accuracy percentage
-   Dash uses

**Lifetime Stats:**

-   Total runs, playtime, enemies destroyed
-   Boss kills (per boss type)
-   Best wave reached
-   Fastest victory
-   Win/loss streaks
-   Upgrade pick counts
-   Synergy unlock counts
-   Affix play/win counts
-   Mode play/win counts

### 12.6 Achievements

**Categories:**

**Progression (10 achievements):**

-   First Blood: Kill your first enemy
-   Wave Rider: Clear wave 5
-   Boss Slayer: Defeat the boss
-   Perfectionist: Beat the boss without taking damage
-   Speed Demon: Beat the boss in under 8 minutes
-   Marathon: Survive for 20 minutes

**Combat (8 achievements):**

-   Sharpshooter: 90% accuracy in a run
-   Overkill: Deal 500 damage in one shot
-   Chain Reaction: Kill 5 enemies with one explosive
-   Untouchable: Clear 3 waves without taking damage
-   Close Call: Kill boss with 1 HP remaining

**Builds (6 achievements):**

-   Glass Cannon: Win with 1 max HP
-   Tank: Win with 8+ max HP
-   Bullet Hell: Have 5+ projectiles
-   Speedster: Reach 400+ move speed
-   Vampire: Heal 10+ HP in one run

**Multiplayer (4 achievements):**

-   Team Player: Complete a multiplayer run
-   Carry: Deal 80% of team damage
-   Reviver: Have partner respawn 3 times in one run
-   Synchronized: Both players pick same upgrade

**Secret (3 achievements):**

-   ??? (Hidden until unlocked)

### 12.7 Persistence

All meta-progression stored in localStorage:

-   Pilot rank and XP
-   Card collection (unlocks + boosts)
-   Lifetime statistics
-   Achievement unlock status
-   Cosmetic selections
-   Best runs per seed
-   Top 20 runs leaderboard

---

## 13. Notification System

### 13.1 In-Game Notifications

**Toast Notifications (top-right, stack up to 3):**

-   Achievement unlocked (with icon and name)
-   New rank reached
-   Personal best (wave, time, damage)
-   Rare upgrade found

**Visual Style:**

-   Slide in from right, fade out after 3 seconds
-   Achievement toasts have golden border
-   Sound cue accompanies each notification

### 13.2 Notification Types

| Type          | Duration | Sound    | Priority |
| ------------- | -------- | -------- | -------- |
| Achievement   | 4s       | Fanfare  | High     |
| Rank Up       | 3s       | Level up | High     |
| Personal Best | 3s       | Chime    | Medium   |
| Rare Upgrade  | 2s       | Sparkle  | Low      |

### 13.3 End-of-Run Summary Enhancements

**New Unlocks Section:**

-   List any achievements earned this run
-   Show XP gained and progress to next rank
-   Highlight new personal bests

**Stats Comparison:**

-   Compare run stats to personal bests
-   Show lifetime stats progression

---

## 14. Open Questions

1. **Shared vs. Separate Health:** Current design uses shared health pool. Alternative: separate health with shared lives.

2. **Upgrade Visibility:** Should players see each other's upgrade choices in real-time, or only after selection?

3. **Respawn Mechanic:** Is 10-second respawn too punishing? Too forgiving? Should it cost something?

4. **Mobile Priority:** How much development time to allocate to mobile optimization vs. desktop polish?

5. **Achievement Difficulty:** Should secret achievements be truly hidden, or show "???" with hints?

6. **Card Collection Pacing:** How many boss kills to unlock full catalog? Current estimate: ~15-20 wins.

7. **Infinite Mode Scaling:** How aggressive should difficulty scaling be? Linear or exponential?

8. **Affix Balance:** Some affixes feel punishing (Enraged Boss). Should there be opt-out?
