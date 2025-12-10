# Product Requirements Document – Quiet Quadrant

## 1. Overview

**Working Title**  
Quiet Quadrant

**High‑Level Concept**  
Quiet Quadrant is a compact roguelike space shooter set in a minimalist, vector‑style arena. The player pilots a fragile ship within a single, bounded “quadrant,” surviving escalating waves of enemies and culminating in a bullet‑hell boss fight. Within each 15–20 minute run, the player builds a distinctive loadout by choosing from a small but meaningful set of common and rare upgrades.

**One‑Liner**  
“A calm, monochrome void where clean lines, tight movement, and small choices decide whether your ship survives the Quiet Quadrant.”

**Platform & Input**

-   Primary: Desktop (browser)
-   Input: Keyboard + mouse; optional gamepad support

**Target Run Length**

-   15–20 minutes for a successful full run (wave 1 → boss defeat).

---

## 2. Objectives & Success Criteria

### Product Objectives

1. Deliver a **complete, finishable game** with a clear start, midgame, and finale.
2. Showcase **systems design and balancing** through a focused upgrade system and enemy ecosystem.
3. Establish a **distinct visual identity**: mostly monochrome, vector‑inspired, with color reserved for emphasis.
4. Ensure the game is **small enough to ship**, but polished enough to feel intentional and “portfolio‑ready.”

### Success Criteria (Qualitative)

-   New players understand:
    -   Controls and goal within 15 seconds of starting.
    -   Basic enemy behaviors and upgrade choices by wave 3.
-   Most players:
    -   Reach midgame (around wave 5–7) within their first few attempts.
    -   Can complete at least one run within 3–6 attempts.
-   Feedback from players/reviewers:
    -   “Small but complete,” “clear to read,” and “each run feels a bit different” are common reactions.

---

## 3. Target Audience

**Primary Audience**

-   Players who enjoy:
    -   Short, replayable arcade experiences.
    -   Roguelite runs without heavy meta‑grind.
    -   Minimalist visuals and clean game feel.

**Secondary Audience**

-   Recruiters, peers, and collaborators evaluating:
    -   Game design clarity and systems thinking.
    -   Ability to scope, finish, and polish a project.
    -   Aesthetic direction and UX sensibility.

Players should be comfortable with:

-   Real‑time movement and aiming.
-   Dying and retrying as part of the core experience.

---

## 4. Game Pillars

1. **Quiet, Clear, Contained**

    - One small arena, one clear objective.
    - Minimal clutter both visually and mechanically; focus on readability.

2. **Small Choices, Big Impact**

    - Compact set of upgrades where each choice is noticeable and shapes the run.
    - Rare upgrades provide spikes of excitement and new behaviors.

3. **Short, Replayable Runs**

    - 15–20 minute runs that feel complete on their own.
    - Enough variability from upgrades to justify “one more run.”

4. **Retro Lines, Modern Feedback**
    - Vector‑like, mostly monochrome aesthetic.
    - Modern feedback (hits, explosions, telegraphs) while staying restrained and legible.

---

## 5. Core Game Loop

1. **Enter the Quadrant**

    - Player spawns in a fixed‑size, bounded 2D arena.

2. **Survive the Wave**

    - Enemies spawn according to the current wave’s pattern.
    - Player moves, aims, and fires to eliminate them and avoid damage.

3. **Collect & Level Up**

    - Destroyed enemies drop XP pickups.
    - Collect XP to fill the XP bar and gain a level.

4. **Choose an Upgrade**

    - On level‑up, action pauses or slows.
    - The player chooses 1 of 3 upgrade options (mostly common, sometimes rare).

5. **Escalation**

    - Each new wave increases difficulty via enemy types, counts, and patterns.
    - Player’s build becomes more defined and powerful as upgrades stack.

6. **Boss & Resolution**
    - After a defined number of waves, a single bullet‑hell boss spawns.
    - Run ends with:
        - **Victory** if the boss is defeated.
        - **Defeat** if player health reaches zero.
    - Show summary; offer immediate restart.

---

## 6. Core Systems

### 6.1 Player

**Role**  
A single, agile but fragile ship in a closed arena, relying on movement, aim, and upgrades to survive escalating threats.

**Capabilities (What, not how)**

-   **Movement**

    -   Free 2D movement within the boundaries of the quadrant.
    -   No leaving the arena; walls or edges clearly defined.

-   **Primary Weapon**

    -   A continuously usable, directional weapon.
    -   Starts simple (single stream or projectile line).
    -   Scales and mutates via upgrades (damage, rate, pattern, special effects).

-   **Active Ability (Single Slot)**
    -   One core defensive or mobility ability, always available on a cooldown.
    -   Intended candidates (one chosen for v1; final choice is a design decision):
        -   Short dash to reposition through danger.
        -   Brief directional or radial shield that absorbs or deflects bullets.
    -   Gives the player a way to correct mistakes or take calculated risks.

**Health & Failure**

-   Player has a finite health or shield pool.
-   Damage from enemies and bullets reduces health.
-   Limited ways to recover health:
    -   Specific upgrades and/or rare pickups.
-   When health reaches zero, the run ends immediately in Defeat.

---

### 6.2 Enemies

Goal: a small roster of clearly differentiated enemies whose combinations, not individual complexity, create challenge.

**Base Enemy Archetypes (MVP)**

1. **Drifter (Chaser)**

    - Moves directly or almost directly toward the player.
    - Low health, moderate speed.
    - Constant “background” pressure, punishes staying still.

2. **Watcher (Shooter)**

    - Prefers medium distance from the player; attempts to maintain range.
    - Periodically fires projectiles toward the player or along simple patterns.
    - Medium health, slower movement.
    - Forces repositioning and target prioritization.

3. **Mass (Bruiser/Tank)**
    - Slow but high health.
    - Telegraphs powerful, infrequent attacks:
        - Either dangerous close‑range contact, or
        - Large but slow projectiles / area attacks.
    - Poses positional constraints: must be managed, kited, or avoided.

**Behavior Principles**

-   Each enemy should:

    -   Be identifiable at a glance by shape and motion.
    -   Have a clear, simple behavior (“runs at you”, “keeps distance and shoots”, “slow but dangerous”).

-   Difficulty increase via:
    -   More instances of existing enemies.
    -   Slight stat boosts and/or visual “elite” variants (e.g., thicker lines).
    -   More aggressive patterns, not entirely new mechanics, for MVP.

---

### 6.3 Bullet‑Hell Boss (Final Encounter)

The run culminates in a single, named boss with bullet‑hell style patterns.

**Encounter Structure**

-   **Timing**

    -   Boss appears on the final wave (e.g., wave 10–12, depending on final pacing).
    -   No more waves after the boss: it is the hard endpoint of the run.

-   **Core Experience**
    -   Player fights a large, visually distinct boss entity within the same arena.
    -   The boss primarily threatens the player through bullet patterns and area control, not through many adds.

**Phases**

-   2–3 distinct phases, triggered at health thresholds (e.g., at ~66% and ~33%).
-   Each phase:
    -   Introduces at least one new bullet pattern or significantly modifies an existing one.
    -   Increases intensity (faster projectiles, denser patterns, or more overlapping attacks).

**Bullet Patterns (Conceptual Examples)**

-   Radial spreads the player must weave through.
-   Sweeping cones or “fans” that slowly rotate, forcing circular movement.
-   Slower, larger “zone control” bullets that restrict space and combine with faster shots.
-   Occasional, clearly telegraphed high‑impact attacks (e.g., a large beam or burst).

**Telegraphing & Fairness**

-   Each major attack has:
    -   A readable pre‑attack tell (shape change, charging animation, slight color accent, or brief pause).
-   Bullet patterns are:
    -   Learnable with repetition.
    -   Difficult but not random or unfair.

**Adds**

-   MVP: boss uses bullets as its main form of pressure.
-   Limited or no additional regular enemies during the boss fight to preserve clarity.
-   If adds exist, they are introduced sparingly and in predictable moments.

**Outcome**

-   **On Defeat (player dies)**:
    -   Show Defeat screen, including boss remaining health percentage.
-   **On Victory (boss dies)**:
    -   Visually distinct destruction sequence.
    -   Victory screen and run summary; encourage replay.

---

### 6.4 Weapons & Upgrades

**Base Weapon**

-   Single primary weapon at start of run:
    -   Linear, easy‑to‑understand pattern (e.g., forward shots in aim direction).
    -   Modest damage and rate of fire.

**Upgrade System – Core Rules**

-   Player gains XP by collecting drops from defeated enemies.
-   On filling the XP bar, the player levels up.
-   On level‑up:
    -   Game pauses or slows.
    -   Present **3 upgrade choices** to the player.
    -   Player selects 1; others disappear.
-   Upgrades stack and define the run’s “build.”

#### Rarity Tiers

Two rarity tiers exist:

1. **Common Upgrades**

    - Backbone of progression.
    - Primarily straightforward stat and behavior improvements.
    - Appear frequently in upgrade choices.

2. **Rare Upgrades**
    - Less frequent, more impactful, and more “special.”
    - Often provide new behaviors, synergies, or large spikes in power.
    - Designed to make level‑ups occasionally feel like a high‑value moment.

**Rarity Behavior (What)**

-   Most level‑ups:
    -   Offer three commons, or two commons + one rare, depending on RNG.
-   In a successful full run:
    -   The player should see multiple rares but not at every level.
-   Some rare upgrades:
    -   Are unique per run (can only be selected once).
    -   Others may stack, but with clear caps or diminishing returns.

#### Upgrade Types (Conceptual Examples)

**Common Upgrades**

-   Core stat boosts:

    -   Increase weapon damage.
    -   Increase fire rate.
    -   Increase projectile speed.
    -   Increase movement speed.
    -   Increase maximum health or shields.

-   Simple behavior tweaks:
    -   +1 projectile per shot (small spread).
    -   Projectiles can pierce a limited number of enemies.
    -   Slightly larger XP pickup radius.

**Rare Upgrades**

-   Build‑defining or highly synergistic:

    -   Strong on‑hit explosions that scale with projectile count or damage.
    -   Occasional life steal on kill or on hit (with limits to avoid trivializing damage).
    -   Significant changes to firing behavior (e.g., charged shots, orbiting projectiles before release, limited homing).

-   Strong survivability tools:
    -   Automatic brief shield when reaching low health (with a cooldown).
    -   Large, one‑time heal or a strong regenerative effect with constraints.

**Design Principles**

-   Every upgrade should:
    -   Be immediately understandable by its description.
    -   Have a noticeable impact on playstyle or feel.
-   Rares should:
    -   Create memorable builds and synergies with commons.
    -   Not be required to win, but make wins more likely and more interesting.

---

## 7. Progression & Pacing

### 7.1 Wave Structure

**Target Wave Count for Full Run**  
Approximately 10–15 waves, with the final wave reserved for the boss.

**Phases of a Run**

1. **Early (Waves 1–3)** – Onboarding

    - Primarily Drifters, then introducing a small number of Watchers.
    - Low enemy density, slower projectiles.
    - Purpose: teach movement, aiming, and basic threat evaluation.

2. **Mid (Waves 4–8)** – Core Game

    - Mix of Drifters, Watchers, and Masses.
    - Gradual increases in:
        - Enemy counts.
        - Projectile density.
        - Introduction of “elite” enemies (visually variant, slightly tougher).
    - Purpose: showcase player builds, encourage meaningful upgrade decisions.

3. **Late (Waves 9–X‑1)** – Build Check

    - High density mixed waves, emphasizing combined threats (e.g., Watchers protected by Drifters, Masses constraining space).
    - Difficulty ramps to “boss‑ready” level.
    - Purpose: stress‑test builds before the final encounter.

4. **Final (Wave X)** – Boss
    - Bullet‑hell style boss fight.
    - No additional standard waves afterwards.

### 7.2 Difficulty Curve

-   Early waves are intentionally forgiving; deaths here should feel like learning errors.
-   Mid waves are where the majority of early runs will end; this is where players experiment with upgrades.
-   Late waves and boss are designed to be challenging but beatable with a solid build and pattern recognition.

---

## 8. Aesthetic & UX

### 8.1 Visual Identity

**Style**

-   Mostly monochrome, inspired by early vector space games.
-   Dark background with a simple starfield or subtle texture.
-   Ships, enemies, bullets, and UI elements primarily rendered as line art and simple geometric shapes.

**Shape Language & Hierarchy**

-   Player:
    -   Most visually prominent entity (distinct silhouette, thicker lines).
-   Enemies:
    -   Different silhouettes and line weights for each archetype.
-   Projectiles:
    -   Thin, high‑contrast lines or small shapes.
-   UI:
    -   Matches the line‑based, minimal aesthetic (bars, frames, text).

**Color Usage**

-   Defaults:
    -   Monochrome/near‑monochrome for most entities.
-   Color reserved for:
    -   XP pickups and powerups.
    -   Rare upgrades and special UI elements.
    -   Danger telegraphs (e.g., red/orange hints before big attacks).
    -   Global events (level‑up, low‑health state, victory/defeat overlays).

Color is always tied to semantic meaning (reward, danger, special), not decoration.

---

### 8.2 Tone & Feedback

**Overall Tone**

-   Quiet, focused, almost “clinical” void.
-   Limited visual and audio clutter; events feel intentional.

**Feedback**

-   Hits:
    -   Subtle flashes or pulses on the enemy outline.
-   Kills:
    -   Brief, clean explosions or bursts.
-   Taking Damage:
    -   Clear indication (e.g., brief ship flash, concise sound).
-   Major Moments:
    -   Level‑up: distinct audio cue and visual emphasis around the player/UI.
    -   Boss phase changes: noticeable but not overwhelming visual change.

Screen shake and high‑intensity effects are:

-   Reserved for major events (big explosions, boss attacks, near‑death),
-   Tuned to not compromise readability.

---

### 8.3 UI & Flow

**HUD**

-   Minimal, immediately readable:
    -   Health / shield indicator.
    -   XP bar or meter.
    -   Wave / boss indicator (e.g., “Wave 7 / 11” or “Boss”).

**Menus & Flow**

-   Title Screen:

    -   Game title, a primary “Play” call‑to‑action.
    -   Optional small “How to Play” text (controls + objective in a few lines).

-   In‑Run:

    -   Level‑up / upgrade UI overlay:
        -   Centralized, clear choice cards.
        -   Distinct styling for rare vs common upgrades.
    -   Pause menu:
        -   Resume, Restart, Quit to Title.

-   End‑of‑Run Screen:
    -   Outcome (Victory / Defeat).
    -   Time survived.
    -   Wave reached.
    -   Enemies destroyed.
    -   List of chosen upgrades (ideally in order acquired).
    -   Option to replay immediately.

---

## 9. Content Scope (MVP)

To ensure the game is finishable and polished within a limited timeframe.

-   **Player**

    -   1 playable ship archetype with a single base weapon and one active ability.

-   **Enemies**

    -   3 standard enemy types:
        -   Drifter (Chaser)
        -   Watcher (Shooter)
        -   Mass (Bruiser/Tank)
    -   1 bullet‑hell boss encounter (multi‑phase).

-   **Upgrades**

    -   ~8–12 total upgrade definitions:
        -   Majority common.
        -   A meaningful subset rare (e.g., 3–5).

-   **Arena**

    -   1 arena layout (same size and basic shape each run).
    -   Visual variation, if any, is purely cosmetic.

-   **Mode**
    -   Single mode: start at wave 1, progress to boss, then game ends.

---

## 10. Out of Scope (v1)

Deliberately excluded to protect scope and timeline:

-   Online multiplayer or co‑op.
-   Persistent meta‑progression (currencies, unlock trees, permanent upgrades).
-   Multiple playable ships with unique starting loadouts.
-   Narrative or story elements beyond minimal flavor text.
-   Alternate modes (endless mode, challenge modifiers, daily runs).
-   Extensive cosmetic customization or skins.
-   Detailed accessibility options beyond reasonable core defaults.

These can be considered stretch or post‑v1 features if capacity and interest remain.

---

## 11. Risks & Open Questions

### Key Risks

1. **Upgrade Balance & Complexity**

    - Too many or overly complex upgrades could make builds confusing and hard to tune.
    - Mitigation: favor fewer, clearer upgrades with strong, visible effects.

2. **Visual Noise in Late Game & Boss**

    - High bullet and enemy counts risk overwhelming the minimalist aesthetic and readability.
    - Mitigation: cap densities, prioritize clarity in bullet and enemy design, keep palette restrained.

3. **Run Length Drift**
    - Poor tuning can cause runs to exceed 25–30 minutes (fatigue) or be too short (unsatisfying).
    - Mitigation: iterative balancing with a hard target around 15–20 minutes per successful run.

### Open Design Questions

1. **Final Choice of Active Ability**

    - Dash vs shield (or a similar concept) should be locked early:
        - Dash = mobility‑first, “thread the needle” gameplay.
        - Shield = timing‑first, short windows of safety.

2. **Exact Wave Count & Boss Timing**

    - Final number of pre‑boss waves (e.g., 9 waves + 1 boss) should be set during tuning.

3. **Number & Nature of Rare Upgrades**
    - Exact count of rares and how transformative they are.
    - Design target: each rare should be memorable, not just a bigger number.

Once these are decided at a design level, they can guide detailed content and balancing work during implementation.
