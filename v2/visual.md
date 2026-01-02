# Visual Design Document – Quiet Quadrant v2

## 1. Art Direction

### 1.1 Core Aesthetic

**Style:** Minimalist vector with selective glow effects

**Mood:** Clean, focused, readable chaos

**Inspiration:**

-   Geometry Wars (glow, particle density)
-   Downwell (limited palette, high contrast)
-   Nuclear Throne (screen shake, impact feel)

**Guiding Principle:** Every visual element serves gameplay. No decoration without function.

### 1.2 Color Philosophy

**Primary Palette (5 colors):**

| Role   | Color   | Hex       | Usage                                 |
| ------ | ------- | --------- | ------------------------------------- |
| Player | White   | `#FFFFFF` | Player ship, player UI elements       |
| Safe   | Cyan    | `#00FFFF` | Player bullets, XP, positive feedback |
| Danger | Orange  | `#FF8800` | Enemy bullets, damage indicators      |
| Enemy  | Gray    | `#888888` | Enemy bodies, neutral threats         |
| Boss   | Magenta | `#FF00FF` | Boss attacks, phase transitions       |

**Accent Colors:**

| Role      | Color      | Hex       | Usage                       |
| --------- | ---------- | --------- | --------------------------- |
| Elite     | Light Gray | `#AAAAAA` | Elite enemy glow            |
| Health    | Red        | `#FF4444` | Health bar, damage flash    |
| Rare      | Gold       | `#FFD700` | Rare upgrades, achievements |
| Legendary | Purple     | `#AA00FF` | Legendary upgrades          |
| Synergy   | Teal       | `#00FFAA` | Synergy unlock notification |

**Background:** Near-black with subtle blue tint `#0A0E14`

### 1.3 Contrast Rules

-   Player must be visible against any background state
-   Threats (enemy bullets) must contrast with non-threats (player bullets)
-   No red/green only distinctions (colorblind safety)
-   Minimum 4.5:1 contrast ratio for UI text

---

## 2. Entity Visuals

### 2.1 Player Ship

**Shape:** Asymmetric triangle (pointed nose, wider tail)

**Size:** 24×24 px collision box, 32×32 px visual

**States:**

| State        | Visual                                |
| ------------ | ------------------------------------- |
| Normal       | Solid white, subtle engine glow       |
| Invulnerable | 50% alpha, rapid blink (100ms on/off) |
| Dashing      | Motion blur trail, cyan streak        |
| Low Health   | Red tint pulse (1Hz)                  |
| Charging     | Glow intensifies at nose              |

**Customization (unlockable):**

-   Color variants: Blue, Gold, Purple, Red
-   Trail effects: None, Spark, Flame, Rainbow
-   Outline: None, Thin, Golden

### 2.2 Enemies

**Design Language:** Each enemy type has a unique silhouette recognizable at a glance.

| Enemy    | Shape               | Size  | Color            | Elite Modifier              |
| -------- | ------------------- | ----- | ---------------- | --------------------------- |
| Drifter  | Circle              | 16×16 | Gray             | Thicker outline, pulse glow |
| Watcher  | Diamond             | 20×20 | Gray             | Eye glow, aim laser         |
| Mass     | Hexagon             | 32×32 | Dark Gray        | Red core glow               |
| Phantom  | Faded Circle        | 16×16 | Translucent Gray | Stronger flicker            |
| Orbiter  | Ring                | 18×18 | Gray             | Orbit trail                 |
| Splitter | Cluster (3 circles) | 24×24 | Gray             | Glow connections            |

**Elite Indicators:**

-   2px white outline (vs 1px for normal)
-   Subtle particle aura
-   20% larger visual (same hitbox)

**Death Animation:**

-   Quick scale-up (1.2x over 100ms)
-   Fade to white
-   Burst into 8-12 particles
-   Particles inherit enemy color

### 2.3 Bosses

**Shared Traits:**

-   64×64 px base size
-   Pulsing core
-   Phase-dependent color shifts
-   Telegraph indicators for attacks

| Boss          | Shape                    | Phase 1 | Phase 2       | Phase 3        |
| ------------- | ------------------------ | ------- | ------------- | -------------- |
| Sentinel Core | Rotating square with eye | Gray    | Orange tint   | Red core       |
| Swarm Core    | Organic cluster          | Gray    | Spawning glow | Pulsing red    |
| Obelisk       | Tall rectangle           | Gray    | Crack lines   | Glowing cracks |

**Phase Transition:**

-   500ms invulnerability
-   Screen flash (white, 100ms)
-   Boss color shift tween (300ms)
-   Particle burst from boss center

### 2.4 Bullets

**Player Bullets:**

| Type      | Shape              | Size  | Color              |
| --------- | ------------------ | ----- | ------------------ |
| Normal    | Elongated oval     | 8×4   | Cyan               |
| Charged   | Larger oval + glow | 12×6  | Bright cyan        |
| Explosive | Circle + ring      | 10×10 | Cyan + orange ring |
| Homing    | Oval + trail       | 8×4   | Cyan + white trail |

**Enemy Bullets:**

| Source         | Shape         | Size    | Color          |
| -------------- | ------------- | ------- | -------------- |
| Watcher        | Small circle  | 6×6     | Orange         |
| Mass           | Medium circle | 8×8     | Orange         |
| Orbiter        | Small circle  | 5×5     | Orange         |
| Boss           | Large circle  | 10×10   | Magenta        |
| Boss (special) | Various       | Various | Magenta + glow |

**Bullet Trails:**

-   Player: 3-frame cyan fade trail
-   Enemy: 2-frame orange fade trail
-   Boss: 4-frame magenta trail with glow

### 2.5 Pickups

| Pickup | Shape  | Size  | Color | Animation                          |
| ------ | ------ | ----- | ----- | ---------------------------------- |
| XP Orb | Circle | 8×8   | Green | Gentle pulse, magnet toward player |
| Health | Cross  | 12×12 | Red   | Slow rotation                      |

---

## 3. Effects & Juice

### 3.1 Screen Effects

**Screen Shake:**

| Trigger           | Magnitude | Duration |
| ----------------- | --------- | -------- |
| Player hit        | 4px       | 150ms    |
| Enemy kill        | 1px       | 50ms     |
| Boss hit          | 2px       | 100ms    |
| Boss phase change | 6px       | 300ms    |
| Dash              | 2px       | 100ms    |
| Explosion         | 3px       | 150ms    |

**Screen Flash:**

| Trigger    | Color | Alpha | Duration |
| ---------- | ----- | ----- | -------- |
| Player hit | Red   | 0.3   | 100ms    |
| Level up   | White | 0.2   | 150ms    |
| Boss phase | White | 0.4   | 100ms    |
| Victory    | Gold  | 0.3   | 500ms    |

**Slow Motion:**

| Trigger      | Time Scale | Duration |
| ------------ | ---------- | -------- |
| Level up     | 0.3x       | 300ms    |
| Boss death   | 0.2x       | 500ms    |
| Player death | 0.1x       | 800ms    |

### 3.2 Particle Systems

**Particle Budgets:**

| System       | Max Particles | Spawn Rate  |
| ------------ | ------------- | ----------- |
| Starfield    | 100           | Static      |
| Dust         | 30            | 2/sec       |
| Engine trail | 20            | Speed-based |
| Bullet trail | 50            | Per bullet  |
| Death burst  | 12 per death  | On death    |
| XP collect   | 8 per pickup  | On collect  |
| Level up     | 30            | Burst       |

**Total Budget:** 200 active particles max

**Particle Configs:**

```javascript
// Engine trail
{
  lifespan: 200,
  speed: { min: 10, max: 30 },
  scale: { start: 0.5, end: 0 },
  alpha: { start: 0.6, end: 0 },
  tint: 0x00FFFF,
  blendMode: 'ADD'
}

// Death burst
{
  lifespan: 300,
  speed: { min: 50, max: 150 },
  scale: { start: 0.8, end: 0 },
  alpha: { start: 1, end: 0 },
  tint: [enemy color],
  blendMode: 'ADD'
}

// XP collect
{
  lifespan: 150,
  speed: { min: 20, max: 60 },
  scale: { start: 0.4, end: 0 },
  alpha: { start: 0.8, end: 0 },
  tint: 0x00FF00,
  blendMode: 'ADD'
}
```

### 3.3 Impact Feedback

**Hit Confirmation:**

-   Enemy flash white for 50ms on hit
-   Floating damage number (optional, off by default)
-   Small particle burst at impact point
-   Brief knockback visual (enemy pushed 2-4px)

**Kill Confirmation:**

-   Death burst particles
-   XP orb spawn with pop animation
-   Subtle screen shake
-   Kill sound

**Player Damage:**

-   Screen flash red
-   Ship blinks
-   Screen shake
-   Health bar flash
-   Damage sound (alarming but not harsh)

### 3.4 Dash Effect

**Visual Sequence:**

1. Ship becomes semi-transparent
2. Cyan motion blur trail (5 frames)
3. Afterimage at start position (fades 200ms)
4. Small particle burst at end position
5. Brief invulnerability glow

---

## 4. Background & Environment

### 4.1 Starfield

**Layers (back to front):**

| Layer | Star Count | Speed       | Size | Alpha |
| ----- | ---------- | ----------- | ---- | ----- |
| Far   | 50         | 0.1x player | 1px  | 0.3   |
| Mid   | 30         | 0.3x player | 2px  | 0.5   |
| Near  | 20         | 0.5x player | 3px  | 0.7   |

**Implementation:** TileSprite with parallax scroll based on player position.

### 4.2 Arena Bounds

**Visual Treatment:**

-   Subtle grid lines (10% alpha) every 100px
-   Soft vignette at edges (darker corners)
-   Faint glow line at boundary (cyan, 20% alpha)
-   Bounce feedback when player hits edge

### 4.3 Wave States

**Active Wave:**

-   Full brightness
-   Starfield scrolling
-   Dust particles active

**Intermission:**

-   30% brightness reduction
-   Starfield slows
-   Dust particles pause
-   Subtle pulse overlay (2Hz)
-   "Wave X" text fade in/out

**Boss Entrance:**

-   Screen darkens to 50%
-   Red/magenta tint
-   Dramatic pause (500ms)
-   Boss spawns with flash
-   Music intensity increases

---

## 5. UI Design

### 5.1 HUD Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [♥♥♥♥♥]                    WAVE 7                    [⚡]   │
│  Health                                              Dash   │
│                                                             │
│                                                             │
│                                                             │
│                         [GAME]                              │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│ ════════════════════════════════════════════════════════════│
│                        XP BAR                         Lv.5  │
└─────────────────────────────────────────────────────────────┘
```

**Element Specs:**

| Element  | Position    | Size       | Style                      |
| -------- | ----------- | ---------- | -------------------------- |
| Health   | Top-left    | 120×20     | Segmented hearts or bar    |
| Wave     | Top-center  | Auto       | "WAVE X" text              |
| Dash     | Top-right   | 32×32      | Circular cooldown          |
| XP Bar   | Bottom      | Full width | Thin bar with level number |
| Upgrades | Bottom-left | Icons      | Active upgrade indicators  |

### 5.2 Health Display

**Style Options:**

Option A - Hearts:

```
♥ ♥ ♥ ♥ ♥  (full)
♥ ♥ ♥ ♡ ♡  (3/5)
♥ ♡ ♡ ♡ ♡  (1/5, pulsing red)
```

Option B - Bar:

```
[████████████████████] 5/5
[████████████░░░░░░░░] 3/5
[████░░░░░░░░░░░░░░░░] 1/5 (pulsing)
```

### 5.3 Dash Cooldown

**Visual:** Circular indicator near player or in corner

**States:**

-   Ready: Full cyan circle, subtle glow
-   Cooling: Clockwise fill animation
-   Almost ready: Pulse when 90% charged

### 5.4 XP Bar

**Style:** Thin bar at bottom of screen

**Animation:**

-   Smooth fill on XP gain
-   Flash on level up
-   Number increment animation

### 5.5 Notifications

**Toast Style:**

```
┌──────────────────────────┐
│ 🏆 Achievement Unlocked! │
│    First Blood           │
└──────────────────────────┘
```

**Animation:**

-   Slide in from right (200ms ease-out)
-   Hold for duration
-   Fade out (300ms)

**Stack:** Max 3 visible, newest at bottom

### 5.6 Upgrade Selection

**Card Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│                      LEVEL UP!                              │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  ⚔️      │    │  🛡️      │    │  ⚡      │              │
│  │          │    │          │    │          │              │
│  │ Power    │    │ Plating  │    │ Rapid    │              │
│  │ Shot     │    │          │    │ Fire     │              │
│  │          │    │          │    │          │              │
│  │ +15% dmg │    │ +1 HP    │    │ +15%     │              │
│  │ +5% crit │    │ -8% dmg  │    │ fire rate│              │
│  │          │    │          │    │          │              │
│  │ [COMMON] │    │ [COMMON] │    │ [RARE]   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       [1]             [2]             [3]                   │
└─────────────────────────────────────────────────────────────┘
```

**Card Styling by Rarity:**

| Rarity    | Border | Background  | Glow   |
| --------- | ------ | ----------- | ------ |
| Common    | Gray   | Dark gray   | None   |
| Rare      | Gold   | Dark gold   | Subtle |
| Legendary | Purple | Dark purple | Strong |

**Hover/Select:**

-   Scale up 1.05x
-   Border brightens
-   Glow intensifies

---

## 6. Animation Timing

### 6.1 Standard Durations

| Animation          | Duration | Easing      |
| ------------------ | -------- | ----------- |
| Button hover       | 100ms    | ease-out    |
| Modal open         | 200ms    | ease-out    |
| Modal close        | 150ms    | ease-in     |
| Card flip          | 300ms    | ease-in-out |
| Notification slide | 200ms    | ease-out    |
| Screen transition  | 300ms    | ease-in-out |
| Health bar change  | 200ms    | ease-out    |
| XP bar fill        | 300ms    | ease-out    |

### 6.2 Game Feel Timing

| Action      | Feedback Delay           |
| ----------- | ------------------------ |
| Shoot       | 0ms (instant)            |
| Hit enemy   | 0ms (instant flash)      |
| Kill enemy  | 0ms (instant burst)      |
| Take damage | 0ms (instant shake)      |
| Level up    | 50ms (brief pause first) |
| Dash        | 0ms (instant trail)      |

---

## 7. Sprite Specifications

### 7.1 Sprite Sheet Layout

**Player Sheet (128×32):**

```
[Normal][Thrust][Dash1][Dash2]
  32×32   32×32  32×32  32×32
```

**Enemy Sheet (256×64):**

```
[Drifter][Watcher][Mass][Phantom][Orbiter][Splitter][Elite1][Elite2]
  32×32    32×32  32×32   32×32    32×32    32×32    32×32   32×32
```

**Boss Sheet (256×128):**

```
[Sentinel P1][Sentinel P2][Sentinel P3][Sentinel P4]
    64×64       64×64        64×64        64×64
[SwarmCore P1][SwarmCore P2][SwarmCore P3][SwarmCore P4]
    64×64        64×64         64×64         64×64
```

**Bullets Sheet (128×32):**

```
[PlayerNorm][PlayerCharge][EnemySmall][EnemyMed][BossNorm][BossSpecial]
    16×8        24×12        8×8        12×12     16×16      24×24
```

**UI Sheet (256×256):**

```
[Heart Full][Heart Empty][Dash Ready][Dash Cool][XP Orb][Health Pickup]
    16×16       16×16        32×32      32×32     16×16      16×16
[Upgrade Icons... 32×32 each]
```

### 7.2 Generation Approach

**Option A: Procedural (Recommended for v2)**

-   Generate sprites at runtime using Canvas/Graphics
-   Smaller bundle size
-   Easy to adjust colors/sizes
-   Consistent with minimalist aesthetic

**Option B: Pre-rendered**

-   Load sprite sheets
-   Better for complex visuals
-   Larger bundle size

### 7.3 Procedural Sprite Examples

```javascript
// Player ship (triangle)
function drawPlayer(graphics, color = 0xffffff) {
    graphics.clear();
    graphics.fillStyle(color);
    graphics.beginPath();
    graphics.moveTo(16, 0); // Nose
    graphics.lineTo(0, 24); // Left tail
    graphics.lineTo(16, 18); // Center notch
    graphics.lineTo(32, 24); // Right tail
    graphics.closePath();
    graphics.fill();
}

// Drifter (circle with inner ring)
function drawDrifter(graphics, elite = false) {
    graphics.clear();
    graphics.fillStyle(0x888888);
    graphics.fillCircle(8, 8, 8);
    graphics.fillStyle(0x666666);
    graphics.fillCircle(8, 8, 4);
    if (elite) {
        graphics.lineStyle(2, 0xffffff);
        graphics.strokeCircle(8, 8, 9);
    }
}

// Watcher (diamond with eye)
function drawWatcher(graphics, elite = false) {
    graphics.clear();
    graphics.fillStyle(0x888888);
    graphics.beginPath();
    graphics.moveTo(10, 0);
    graphics.lineTo(20, 10);
    graphics.lineTo(10, 20);
    graphics.lineTo(0, 10);
    graphics.closePath();
    graphics.fill();
    // Eye
    graphics.fillStyle(0xff8800);
    graphics.fillCircle(10, 10, 3);
}
```

---

## 8. Performance Considerations

### 8.1 Rendering Budget

| Category     | Budget          |
| ------------ | --------------- |
| Draw calls   | < 100 per frame |
| Particles    | < 200 active    |
| Sprites      | < 300 active    |
| Text updates | < 10 per frame  |

### 8.2 Optimization Techniques

**Object Pooling:**

-   Pre-create bullet sprites (200)
-   Pre-create particle emitters
-   Reuse enemy sprites

**Texture Atlases:**

-   Combine all sprites into single atlas
-   Reduces texture swaps

**Culling:**

-   Don't render off-screen entities
-   Disable particle emitters when not visible

**LOD (Level of Detail):**

-   Reduce particle count on low-end devices
-   Simplify effects on mobile

### 8.3 Mobile Considerations

-   Reduce starfield density by 50%
-   Limit particles to 100
-   Disable motion blur trails
-   Simpler death animations
-   Touch-friendly UI scaling (44px minimum tap targets)

---

## 9. Accessibility

### 9.1 High Contrast Mode

**Changes:**

-   Background: Pure black `#000000`
-   Player: Bright white with outline
-   Enemies: Bright red `#FF0000`
-   Player bullets: Bright green `#00FF00`
-   Enemy bullets: Bright yellow `#FFFF00`

### 9.2 Reduced Motion Mode

**Changes:**

-   Disable screen shake
-   Disable particle trails
-   Disable slow motion
-   Static backgrounds (no parallax)
-   Instant transitions (no tweens)

### 9.3 Colorblind Modes

**Deuteranopia (Red-Green):**

-   Enemy bullets: Yellow instead of orange
-   Health: Blue instead of red

**Protanopia (Red-Green):**

-   Same as deuteranopia

**Tritanopia (Blue-Yellow):**

-   Player bullets: White instead of cyan
-   XP orbs: White instead of green

---

## 10. Asset Checklist

### 10.1 Required Sprites

**Entities:**

-   [ ] Player ship (4 frames)
-   [ ] Drifter (normal + elite)
-   [ ] Watcher (normal + elite)
-   [ ] Mass (normal + elite)
-   [ ] Phantom (normal + elite)
-   [ ] Orbiter (normal + elite)
-   [ ] Splitter (normal + elite)
-   [ ] Sentinel Core (4 phases)
-   [ ] Swarm Core (4 phases)
-   [ ] Obelisk (4 phases)

**Bullets:**

-   [ ] Player bullet (3 types)
-   [ ] Enemy bullet (3 sizes)
-   [ ] Boss bullet (2 types)

**Pickups:**

-   [ ] XP orb
-   [ ] Health pickup

**UI:**

-   [ ] Heart (full/empty)
-   [ ] Dash indicator
-   [ ] Upgrade icons (30)
-   [ ] Achievement icons (31)
-   [ ] Rarity borders (3)

### 10.2 Particle Textures

-   [ ] Circle (soft edge)
-   [ ] Spark (elongated)
-   [ ] Star (4-point)
-   [ ] Dust (tiny dot)

### 10.3 Fonts

-   [ ] Primary: System sans-serif (no custom font needed)
-   [ ] Numbers: Monospace for consistent width
-   [ ] Fallback: Arial, Helvetica

---

## 11. Reference Images

_(To be added: mockups, color swatches, sprite concepts)_

### 11.1 Color Palette Reference

```
Background:  ██ #0A0E14
Player:      ██ #FFFFFF
Player Glow: ██ #00FFFF
Enemy:       ██ #888888
Elite:       ██ #AAAAAA
Danger:      ██ #FF8800
Boss:        ██ #FF00FF
Health:      ██ #FF4444
XP:          ██ #00FF00
Rare:        ██ #FFD700
Legendary:   ██ #AA00FF
```

### 11.2 Shape Language Reference

```
Player:    △  (triangle, pointed)
Drifter:   ●  (circle, simple)
Watcher:   ◆  (diamond, angular)
Mass:      ⬡  (hexagon, heavy)
Phantom:   ○  (faded circle)
Orbiter:   ◎  (ring)
Splitter:  ⁘  (cluster)
Boss:      ■  (large, imposing)
```
