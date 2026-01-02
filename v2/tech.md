# Technical Specification – Quiet Quadrant v2

## 1. Technology Stack

### 1.1 Core Technologies

| Layer         | Technology           | Version | Purpose                    |
| ------------- | -------------------- | ------- | -------------------------- |
| Language      | JavaScript (ES2020+) | -       | Fast iteration, no compile |
| Documentation | JSDoc                | -       | Types when needed          |
| Build         | Vite                 | 5.x     | Fast dev, optimized builds |
| UI Framework  | React                | 18.x    | Menus, HUD, overlays       |
| State         | Zustand              | 5.x     | Global state management    |
| Rendering     | Phaser               | 3.80+   | Game rendering only        |
| Networking    | Trystero             | 0.x     | WebRTC P2P                 |
| Testing       | Vitest               | 1.x     | Unit and integration tests |

### 1.2 Why JavaScript over TypeScript

-   **Faster AI iteration** - No type errors blocking progress
-   **Simpler refactoring** - Move code without fixing imports/types
-   **Runtime flexibility** - Duck typing works well for game dev
-   **JSDoc when needed** - Document complex APIs without enforcement
-   **Smaller bundle** - No TS runtime overhead

### 1.3 Key Constraints

-   **No server required** - Static hosting only (GitHub Pages)
-   **Browser-first** - Must work in Chrome, Firefox, Safari, Edge
-   **Mobile-capable** - Touch controls, responsive layout
-   **Offline-capable** - Single player works without network
-   **Native builds** - Capacitor (iOS/Android) and Electron (Windows/macOS/Linux)

---

## 2. Native Build Targets

### 2.1 Capacitor (Mobile)

**Platforms:** iOS, Android

**Key Considerations:**

-   Touch input via virtual sticks (no hover states)
-   Safe area insets for notches/home indicators
-   Background/foreground lifecycle handling
-   Haptic feedback for hits and achievements
-   App store metadata and screenshots

**Capacitor Config:**

```javascript
// capacitor.config.js
export default {
    appId: "com.quietquadrant.game",
    appName: "Quiet Quadrant",
    webDir: "dist",
    ios: {
        contentInset: "automatic",
        preferredContentMode: "mobile",
        backgroundColor: "#000000",
    },
    android: {
        backgroundColor: "#000000",
        allowMixedContent: true,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: "#000000",
            splashFullScreen: true,
        },
        StatusBar: {
            style: "dark",
            backgroundColor: "#00000000",
            overlaysWebView: true,
        },
        Haptics: {},
    },
};
```

**Platform-Specific Code:**

```javascript
// utils/platform.js
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'

export async function vibrate(style = "medium") {
    if (!isNative) return;
    const styles = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: styles[style] });
}
```

**Build Commands:**

```bash
# Build web assets
npm run build

# Sync to native projects
npx cap sync

# Open in Xcode (iOS)
npx cap open ios

# Open in Android Studio
npx cap open android

# Run on device
npx cap run ios
npx cap run android
```

### 2.2 Electron (Desktop)

**Platforms:** Windows, macOS, Linux

**Key Considerations:**

-   Window management (fullscreen, resize, minimize)
-   Keyboard shortcuts (F11 fullscreen, etc.)
-   Native menus
-   Auto-updater support
-   Splash screen on launch
-   Installer/DMG packaging

**Electron Main Process:**

```javascript
// electron/main.cjs
const { app, BrowserWindow, globalShortcut, Menu } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        title: "Quiet Quadrant",
        icon: path.join(__dirname, "../build-resources/icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: "#0a0e14",
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
}

// F11 fullscreen toggle
globalShortcut.register("F11", () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
```

**Preload Script:**

```javascript
// electron/preload.cjs
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    platform: process.platform,
    isElectron: true,
});
```

**Build Commands:**

```bash
# Development
npm run electron:dev

# Build for current platform
npm run electron:build

# Build for all platforms
npm run electron:build:all
```

**Package.json Scripts:**

```json
{
    "scripts": {
        "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
        "electron:build": "npm run build && electron-builder",
        "electron:build:win": "npm run build && electron-builder --win",
        "electron:build:mac": "npm run build && electron-builder --mac",
        "electron:build:linux": "npm run build && electron-builder --linux"
    }
}
```

### 2.3 Platform Detection

```javascript
// utils/device.js
export function getPlatform() {
    // Electron
    if (window.electronAPI?.isElectron) {
        return { type: "electron", os: window.electronAPI.platform };
    }

    // Capacitor native
    if (window.Capacitor?.isNativePlatform()) {
        return { type: "capacitor", os: window.Capacitor.getPlatform() };
    }

    // Web browser
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return { type: "web", os: "ios" };
    if (/android/.test(ua)) return { type: "web", os: "android" };
    return { type: "web", os: "desktop" };
}

export function isMobile() {
    const { type, os } = getPlatform();
    return type === "capacitor" || os === "ios" || os === "android";
}

export function isDesktopApp() {
    return getPlatform().type === "electron";
}
```

### 2.4 Platform-Specific Features

| Feature              | Web | Capacitor | Electron |
| -------------------- | --- | --------- | -------- |
| Touch controls       | ✓   | ✓         | -        |
| Gamepad              | ✓   | -         | ✓        |
| Keyboard/Mouse       | ✓   | -         | ✓        |
| Haptic feedback      | -   | ✓         | -        |
| Fullscreen API       | ✓   | Auto      | ✓        |
| Local storage        | ✓   | ✓         | ✓        |
| WebRTC (multiplayer) | ✓   | ✓         | ✓        |
| Push notifications   | -   | ✓         | -        |
| Auto-update          | -   | App Store | ✓        |

---

## 2. Project Structure

```
src/
├── main.jsx                 # Entry point
├── App.jsx                  # Root component (<100 lines)
│
├── simulation/              # Pure game logic (NO Phaser imports)
│   ├── GameSimulation.js    # Main simulation loop (<300 lines)
│   ├── PlayerSystem.js      # Player movement, shooting (<200 lines)
│   ├── EnemySystem.js       # Enemy AI, spawning (<250 lines)
│   ├── BulletSystem.js      # Bullet physics, collision (<200 lines)
│   ├── BossSystem.js        # Boss patterns, phases (<250 lines)
│   ├── UpgradeSystem.js     # Upgrade application (<150 lines)
│   └── CollisionSystem.js   # Collision detection (<150 lines)
│
├── rendering/               # Phaser rendering (reads state, no logic)
│   ├── GameRenderer.js      # Main renderer setup (<200 lines)
│   ├── PlayerRenderer.js    # Player sprites, effects (<150 lines)
│   ├── EnemyRenderer.js     # Enemy sprites, animations (<150 lines)
│   ├── BulletRenderer.js    # Bullet sprites (<100 lines)
│   ├── BossRenderer.js      # Boss visuals (<150 lines)
│   ├── EffectsRenderer.js   # Particles, explosions (<150 lines)
│   └── BackgroundRenderer.js # Starfield, arena (<100 lines)
│
├── network/                 # Multiplayer networking
│   ├── NetworkManager.js    # Connection management (<200 lines)
│   ├── InputSync.js         # Input packet handling (<150 lines)
│   └── StateSync.js         # Correction snapshots (<150 lines)
│
├── state/                   # Zustand stores
│   ├── useGameStore.js      # Game state (<150 lines)
│   ├── useUIStore.js        # UI state (<100 lines)
│   ├── useSettingsStore.js  # Settings, persistence (<100 lines)
│   └── useNetworkStore.js   # Network state (<100 lines)
│
├── ui/                      # React components
│   ├── screens/
│   │   ├── TitleScreen.jsx  # (<100 lines)
│   │   ├── GameScreen.jsx   # (<100 lines)
│   │   └── SummaryScreen.jsx # (<100 lines)
│   ├── components/
│   │   ├── HUD.jsx          # (<100 lines)
│   │   ├── UpgradeModal.jsx # (<150 lines)
│   │   ├── PauseMenu.jsx    # (<80 lines)
│   │   └── MultiplayerLobby.jsx # (<150 lines)
│   └── input/
│       └── VirtualSticks.jsx # (<150 lines)
│
├── config/                  # Data-driven configuration
│   ├── enemies.js           # Enemy definitions (<100 lines)
│   ├── upgrades.js          # Upgrade definitions (<100 lines)
│   ├── waves.js             # Wave definitions (<100 lines)
│   ├── boss.js              # Boss patterns (<150 lines)
│   └── constants.js         # Game constants (<50 lines)
│
├── audio/                   # Sound management
│   └── SoundManager.js      # Audio playback (<150 lines)
│
└── utils/                   # Utilities
    ├── math.js              # Math helpers (<50 lines)
    ├── random.js            # Seeded RNG (<50 lines)
    └── device.js            # Device detection (<50 lines)
```

### 2.1 File Length Rules

| Category           | Max Lines | Rationale                        |
| ------------------ | --------- | -------------------------------- |
| Simulation systems | 300       | Core logic, needs room           |
| Renderers          | 200       | Visual code, moderate complexity |
| React components   | 150       | UI should be simple              |
| Stores             | 150       | State management                 |
| Config files       | 150       | Data definitions                 |
| Utilities          | 100       | Small, focused helpers           |

**Enforcement:** ESLint rule `max-lines` set to 300 with warning at 250.

### 2.2 JSDoc Usage

Use JSDoc sparingly - only for:

-   Public API functions that other modules call
-   Complex data structures that need documentation
-   Non-obvious parameters or return values

```javascript
/**
 * Spawn a bullet from a player
 * @param {Object} state - Game state
 * @param {string} playerId - 'p1' or 'p2'
 * @param {number} dirX - Normalized direction X
 * @param {number} dirY - Normalized direction Y
 * @returns {Object} The spawned bullet
 */
function spawnBullet(state, playerId, dirX, dirY) {
    // ...
}

// Don't over-document obvious code
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
```

**Enforcement:** ESLint rule `max-lines` set to 300 with warning at 250.

---

## 3. Simulation Architecture

### 3.1 Core Loop

```javascript
// GameSimulation.js
export class GameSimulation {
    constructor(seed) {
        this.rng = new SeededRandom(seed);
        this.state = createInitialState();
    }

    // Called 60 times per second
    tick(inputs) {
        this.state.tick++;

        // Process in deterministic order
        PlayerSystem.update(this.state, inputs, this.rng);
        EnemySystem.update(this.state, this.rng);
        BulletSystem.update(this.state);
        CollisionSystem.update(this.state);

        if (this.state.boss) {
            BossSystem.update(this.state, this.rng);
        }

        this.cleanupDeadEntities();
        this.checkWaveCompletion();
    }

    // For networking - get minimal state for corrections
    getSnapshot() {
        return {
            tick: this.state.tick,
            players: this.state.players.map((p) => ({
                x: p.x,
                y: p.y,
                health: p.health,
            })),
            enemyCount: this.state.enemies.length,
        };
    }

    // Apply correction from host
    applyCorrection(snapshot) {
        // Only correct if drift exceeds threshold
        // Smooth interpolation for small corrections
    }
}
```

### 3.2 Determinism Requirements

**All randomness must use seeded RNG:**

```javascript
// WRONG - non-deterministic
const angle = Math.random() * Math.PI * 2;

// RIGHT - deterministic
const angle = this.rng.next() * Math.PI * 2;
```

**No floating point accumulation:**

```javascript
// WRONG - accumulates floating point error
position += velocity * dt;

// RIGHT - calculate from tick count
position = initialPosition + velocity * (tick / TICK_RATE);
```

**Fixed timestep only:**

```javascript
// WRONG - variable timestep
update(deltaTime) { ... }

// RIGHT - fixed timestep
tick() { ... } // Always 1/60th of a second
```

### 3.3 State Structure

Game state is a plain object - no classes, easy to serialize:

```javascript
/**
 * @typedef {Object} GameState
 * @property {number} tick
 * @property {Array} players
 * @property {Array} enemies
 * @property {Array} bullets
 * @property {Object} wave
 * @property {Object|null} boss
 */

function createInitialState() {
    return {
        tick: 0,
        players: [],
        enemies: [],
        bullets: [],
        wave: { current: 0, enemiesRemaining: 0 },
        boss: null,
    };
}
```

---

## 4. Rendering Architecture

### 4.1 Renderer Pattern

Renderers read state and update Phaser objects. They never modify game state.

```javascript
// PlayerRenderer.js
export class PlayerRenderer {
    constructor(scene) {
        this.scene = scene;
        this.sprites = new Map();
    }

    // Called every frame (not every tick)
    render(state, interpolation) {
        for (const player of state.players) {
            let sprite = this.sprites.get(player.id);

            if (!sprite) {
                sprite = this.createPlayerSprite(player);
                this.sprites.set(player.id, sprite);
            }

            // Interpolate between ticks for smooth rendering
            sprite.x = lerp(player.prevX, player.x, interpolation);
            sprite.y = lerp(player.prevY, player.y, interpolation);
            sprite.rotation = player.rotation;

            // Visual effects based on state
            sprite.setAlpha(player.invulnFrames > 0 ? 0.5 : 1);
        }
    }

    createPlayerSprite(player) {
        return this.scene.add
            .sprite(player.x, player.y, "player")
            .setScale(0.7)
            .setDepth(DEPTH.PLAYER);
    }
}
```

### 4.2 Frame vs Tick

```
Tick Rate: 60 Hz (fixed)
Frame Rate: Variable (target 60 fps)

Frame 1: Tick 0 ──────────────────────────────────────
Frame 2: Tick 0 (interpolation 0.5) ──────────────────
Frame 3: Tick 1 ──────────────────────────────────────
Frame 4: Tick 1 (interpolation 0.3) ──────────────────
Frame 5: Tick 2 ──────────────────────────────────────
```

Interpolation smooths rendering between simulation ticks.

### 4.3 Object Pooling

```javascript
// BulletRenderer.js
export class BulletRenderer {
    constructor(scene) {
        this.pool = scene.add.group({
            classType: Phaser.GameObjects.Sprite,
            maxSize: 200,
            runChildUpdate: false,
        });

        // Pre-create pool objects
        this.pool.createMultiple({
            key: "bullet",
            quantity: 200,
            active: false,
            visible: false,
        });
    }

    render(bullets) {
        // Deactivate all
        this.pool.getChildren().forEach((b) => {
            b.setActive(false).setVisible(false);
        });

        // Activate needed
        for (const bullet of bullets) {
            const sprite = this.pool.get();
            if (sprite) {
                sprite.setActive(true).setVisible(true);
                sprite.setPosition(bullet.x, bullet.y);
                sprite.setRotation(Math.atan2(bullet.vy, bullet.vx));
            }
        }
    }
}
```

---

## 5. Networking Architecture

### 5.1 Connection Flow

```
Host                              Guest
  │                                 │
  ├─── createRoom() ───────────────►│
  │    returns roomCode             │
  │                                 │
  │◄────────── joinRoom(code) ──────┤
  │                                 │
  ├─── onPeerJoin ─────────────────►│
  │                                 │
  │◄─────────── onPeerJoin ─────────┤
  │                                 │
  ├─── signalGameStart() ──────────►│
  │                                 │
  │         [Game Running]          │
  │                                 │
  ├─── inputs (20Hz) ──────────────►│
  │◄────────── inputs (20Hz) ───────┤
  │                                 │
  ├─── corrections (5Hz) ──────────►│
  │                                 │
  ├─── events (as needed) ─────────►│
  │◄─────── events (as needed) ─────┤
```

### 5.2 Input Sync Implementation

```javascript
// InputSync.js
export class InputSync {
    constructor() {
        this.localBuffer = [];
        this.remoteBuffer = [];
        this.lastSentTick = 0;
    }

    // Called every tick
    processLocalInput(input, tick) {
        const packet = compressInput(input, tick);
        this.localBuffer.push(packet);

        // Send at 20Hz (every 3 ticks at 60Hz)
        if (tick - this.lastSentTick >= 3) {
            this.sendInputs();
            this.lastSentTick = tick;
        }
    }

    // Get remote input for a tick (with prediction if missing)
    getRemoteInput(tick) {
        const packet = this.remoteBuffer.find((p) => p.tick === tick);

        if (packet) {
            return decompressInput(packet);
        }

        // Predict: use last known input
        const lastKnown = this.remoteBuffer[this.remoteBuffer.length - 1];
        return lastKnown ? decompressInput(lastKnown) : EMPTY_INPUT;
    }

    sendInputs() {
        // Send last 3 inputs for redundancy
        const packets = this.localBuffer.slice(-3);
        networkManager.send("input", packets);
    }
}
```

### 5.3 Correction Handling

```javascript
// StateSync.js
export class StateSync {
    constructor() {
        this.correctionThreshold = 50; // pixels
    }

    // Host: generate correction snapshot
    generateSnapshot(state) {
        return {
            tick: state.tick,
            players: state.players.map((p) => ({
                id: p.id,
                x: Math.round(p.x),
                y: Math.round(p.y),
                health: p.health,
            })),
            enemies: state.enemies.slice(0, 20).map((e) => ({
                id: e.id,
                x: Math.round(e.x),
                y: Math.round(e.y),
            })),
        };
    }

    // Guest: apply correction
    applyCorrection(state, snapshot) {
        for (const correction of snapshot.players) {
            const player = state.players.find((p) => p.id === correction.id);
            if (!player) continue;

            const dx = correction.x - player.x;
            const dy = correction.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > this.correctionThreshold) {
                // Snap for large corrections
                player.x = correction.x;
                player.y = correction.y;
            } else if (dist > 5) {
                // Smooth interpolation for small corrections
                player.x += dx * 0.3;
                player.y += dy * 0.3;
            }
        }

        // Similar for enemies...
    }
}
```

---

## 6. State Management

### 6.1 Store Structure

```javascript
// useGameStore.js
import { create } from "zustand";

export const useGameStore = create((set, get) => ({
    state: null,
    simulation: null,

    startGame: (seed, multiplayer) => {
        const simulation = new GameSimulation(seed);
        set({
            simulation,
            state: simulation.getState(),
        });
    },

    tick: (inputs) => {
        const { simulation } = get();
        if (!simulation) return;

        simulation.tick(inputs);
        set({ state: simulation.getState() });
    },

    endGame: () => {
        set({
            simulation: null,
            state: null,
        });
    },

    // Computed getters
    isRunning: () => get().state !== null,
    currentWave: () => get().state?.wave.current ?? 0,
    playerHealth: () => get().state?.players[0]?.health ?? 0,
}));
```

### 6.2 React Integration

```jsx
// GameScreen.jsx
export function GameScreen() {
    const state = useGameStore((s) => s.state);

    // Phaser handles rendering, React handles UI
    return (
        <div className="game-screen">
            <PhaserGame state={state} />
            <HUD state={state} />
            {state?.phase === "upgrade" && <UpgradeModal />}
        </div>
    );
}

// HUD.jsx - Only re-renders when relevant state changes
export function HUD({ state }) {
    if (!state) return null;

    const health = state.players[0]?.health ?? 0;
    const maxHealth = state.players[0]?.maxHealth ?? 5;
    const wave = state.wave.current;

    return (
        <div className="hud">
            <HealthBar current={health} max={maxHealth} />
            <WaveIndicator wave={wave} />
            <XPBar xp={state.players[0]?.xp ?? 0} />
        </div>
    );
}
```

---

## 7. Configuration System

### 7.1 Enemy Configuration

```javascript
// config/enemies.js
export const ENEMIES = {
    drifter: {
        health: 22,
        speed: 100,
        damage: 1,
        xp: 10,
        size: 16,
        behavior: "chase",
        elite: {
            healthMultiplier: 1.7,
            speedMultiplier: 1.25,
            damageMultiplier: 1.2,
            behaviors: ["burst_movement"],
        },
    },
    watcher: {
        health: 35,
        speed: 65,
        damage: 1,
        xp: 25,
        size: 20,
        behavior: "ranged",
        fireCooldown: 1.8,
        projectileSpeed: 145,
        elite: {
            healthMultiplier: 1.7,
            speedMultiplier: 1.25,
            behaviors: ["rapid_fire"],
        },
    },
    mass: {
        health: 85,
        speed: 40,
        damage: 2,
        xp: 50,
        size: 32,
        behavior: "burst",
        fireCooldown: 2.8,
        projectileSpeed: 110,
        elite: {
            healthMultiplier: 1.7,
            behaviors: ["burst_movement", "death_explosion"],
        },
    },
    phantom: {
        health: 18,
        speed: 80,
        damage: 1,
        xp: 20,
        size: 16,
        behavior: "teleport",
        elite: {
            healthMultiplier: 1.7,
            behaviors: ["burst_movement"],
        },
    },
    orbiter: {
        health: 28,
        speed: 120,
        damage: 1,
        xp: 30,
        size: 18,
        behavior: "orbit",
        fireCooldown: 2.2,
        projectileSpeed: 130,
        elite: {
            healthMultiplier: 1.7,
            behaviors: ["rapid_fire"],
        },
    },
    splitter: {
        health: 50,
        speed: 55,
        damage: 1,
        xp: 35,
        size: 24,
        behavior: "split",
        splitCount: 2,
        elite: {
            healthMultiplier: 1.7,
            behaviors: ["death_explosion"],
        },
    },
};
```

### 7.2 Boss Configuration

```javascript
// config/bosses.js
export const BOSSES = [
    {
        id: "sentinel",
        name: "Sentinel Core",
        description: "Tracks player, alternates beam spins with aimed bursts.",
        tuning: {
            healthMultiplier: 1.4,
            speedMultiplier: 1.1,
            fireRateMultiplier: 1.0,
        },
        patterns: ["beam-spin", "aimed-burst", "ring-with-gap"],
    },
    {
        id: "swarm-core",
        name: "Swarm Core",
        description: "Spawns escorts, fires cone volleys, drops radial pulses.",
        tuning: {
            healthMultiplier: 1.3,
            speedMultiplier: 1.15,
            fireRateMultiplier: 1.1,
        },
        patterns: ["summon-minions", "cone-volley", "pulse-ring"],
    },
    {
        id: "obelisk",
        name: "Obelisk",
        description:
            "Telegraphs slams, ricochets shards, locks lanes with beams.",
        tuning: {
            healthMultiplier: 1.5,
            speedMultiplier: 1.0,
            projectileSpeedMultiplier: 1.15,
        },
        patterns: ["slam", "ricochet-shards", "lane-beams"],
    },
];
```

### 7.3 Upgrade Configuration

```javascript
// config/upgrades.js
export const RARITY_ODDS = {
    common: 0.65,
    rare: 0.3,
    legendary: 0.05,
};

export const UPGRADES = {
    // Common - Offense
    "power-shot": {
        name: "Power Shot",
        description: "+15% damage, +5% crit chance",
        rarity: "common",
        category: "offense",
        maxStacks: 6,
        dropWeight: 1.1,
        effect: { damage: 0.15, critChance: 0.05 },
    },
    "rapid-fire": {
        name: "Rapid Fire",
        description: "+15% fire rate",
        rarity: "common",
        category: "offense",
        maxStacks: 6,
        dropWeight: 1.1,
        effect: { fireRate: 0.15 },
    },
    // ... 28 more upgrades following same pattern

    // Legendary
    "glass-cannon": {
        name: "Glass Cannon",
        description: "+150% damage, +8% crit, max HP = 1",
        rarity: "legendary",
        category: "offense",
        maxStacks: 1,
        dropWeight: 0.8,
        effect: { damage: 1.5, critChance: 0.08, special: "glass_cannon" },
    },
    "singularity-rounds": {
        name: "Singularity Rounds",
        description: "Pull enemies into impact point",
        rarity: "legendary",
        category: "utility",
        maxStacks: 1,
        dropWeight: 1.0,
        effect: { special: "singularity" },
    },
};
```

### 7.4 Synergy Configuration

```javascript
// config/synergies.js
export const SYNERGIES = [
    {
        id: "black-hole-sun",
        name: "Black Hole Sun",
        description: "Singularity + chain reactions erase clumped enemies.",
        requires: ["singularity-rounds", "chain-reaction"],
        bonus: { chainDamage: 0.25 },
    },
    {
        id: "railgun",
        name: "Railgun",
        description: "Charged shots pierce through walls.",
        requires: ["held-charge", "quantum-tunneling", "swift-projectiles"],
        bonus: { critChance: 0.05, critDamage: 0.25 },
    },
    {
        id: "immortal-engine",
        name: "Immortal Engine",
        description: "XP shields + healing = near-invulnerability.",
        requires: ["shield-pickup", "kinetic-siphon"],
        bonus: { shieldDuration: 0.5 },
    },
    // ... 10 more synergies
];
```

### 7.5 Affix Configuration

```javascript
// config/affixes.js
export const AFFIXES = [
    {
        id: "nimble-foes",
        name: "Nimble Foes",
        description: "+12% enemy speed, -10% enemy health.",
        enemySpeedMultiplier: 1.12,
        enemyHealthMultiplier: 0.9,
    },
    {
        id: "overclocked",
        name: "Overclocked",
        description: "+20% player damage, +15% enemy damage.",
        playerDamageMultiplier: 1.2,
        enemyDamageMultiplier: 1.15,
    },
    {
        id: "golden-age",
        name: "Golden Age",
        description: "+5% legendary odds, +10% rare odds.",
        legendaryUpgradeBonus: 0.05,
        rareUpgradeBonus: 0.1,
    },
    {
        id: "tough-choices",
        name: "Tough Choices",
        description: "Only 2 upgrade choices, +20% XP.",
        upgradeChoices: 2,
        xpMultiplier: 1.2,
    },
    // ... 14 more affixes
];

// Get current week's affix
export function getWeeklyAffix() {
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return AFFIXES[weekNumber % AFFIXES.length];
}
```

### 7.6 Wave Configuration

```javascript
// config/waves.js
export const WAVES = [
    { id: "wave-1", enemies: [{ kind: "drifter", count: 3 }] },
    {
        id: "wave-2",
        enemies: [
            { kind: "drifter", count: 3 },
            { kind: "watcher", count: 1 },
        ],
    },
    {
        id: "wave-3",
        enemies: [
            { kind: "drifter", count: 4 },
            { kind: "watcher", count: 1 },
            { kind: "phantom", count: 1 },
        ],
    },
    // ... waves 4-10
    { id: "boss", enemies: [{ kind: "boss", count: 1 }] },
];

// Infinite mode scaling
export function getInfiniteWaveScaling(cycle) {
    return {
        healthMultiplier: 1 + cycle * 0.1,
        speedMultiplier: 1 + cycle * 0.05,
        eliteBonus: cycle,
    };
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```javascript
// simulation/__tests__/PlayerSystem.test.js
describe("PlayerSystem", () => {
    it("moves player based on input", () => {
        const state = createTestState();
        const input = { moveX: 1, moveY: 0, fire: false, dash: false };

        PlayerSystem.update(state, { p1: input }, new SeededRandom(1));

        expect(state.players[0].x).toBeGreaterThan(GAME_WIDTH / 2);
    });

    it("respects arena bounds", () => {
        const state = createTestState();
        state.players[0].x = GAME_WIDTH - 10;
        const input = { moveX: 1, moveY: 0, fire: false, dash: false };

        PlayerSystem.update(state, { p1: input }, new SeededRandom(1));

        expect(state.players[0].x).toBeLessThanOrEqual(
            GAME_WIDTH - PLAYER_SIZE / 2
        );
    });
});
```

### 8.2 Determinism Tests

```javascript
// simulation/__tests__/determinism.test.js
describe("Simulation Determinism", () => {
    it("produces identical results with same seed and inputs", () => {
        const seed = 12345;
        const inputs = generateTestInputs(100);

        const sim1 = new GameSimulation(seed);
        const sim2 = new GameSimulation(seed);

        for (const input of inputs) {
            sim1.tick(input);
            sim2.tick(input);
        }

        expect(sim1.getState()).toEqual(sim2.getState());
    });
});
```

### 8.3 Network Tests

```javascript
// network/__tests__/sync.test.js
describe("Network Sync", () => {
    it("corrects drift within threshold", () => {
        const state = createTestState();
        state.players[0].x = 100;

        const correction = { tick: 1, players: [{ id: "p1", x: 120, y: 100 }] };

        StateSync.applyCorrection(state, correction);

        // Should interpolate, not snap
        expect(state.players[0].x).toBeGreaterThan(100);
        expect(state.players[0].x).toBeLessThan(120);
    });
});
```

---

## 9. Build & Deployment

### 9.1 Build Configuration

```javascript
// vite.config.js
export default defineConfig({
    base: "/quiet-quadrant/", // GitHub Pages path
    build: {
        target: "es2020",
        minify: "terser",
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ["phaser"],
                    react: ["react", "react-dom"],
                    network: ["trystero"],
                },
            },
        },
    },
});
```

### 9.2 Bundle Size Targets

| Chunk   | Target | Max   |
| ------- | ------ | ----- |
| Main    | 100KB  | 150KB |
| Phaser  | 800KB  | 1MB   |
| React   | 50KB   | 80KB  |
| Network | 30KB   | 50KB  |
| Total   | ~1MB   | 1.5MB |

### 9.3 Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
            - run: npm ci
            - run: npm run build
            - run: npm test
            - uses: peaceiris/actions-gh-pages@v3
              with:
                  github_token: ${{ secrets.GITHUB_TOKEN }}
                  publish_dir: ./dist
```

---

## 10. Performance Monitoring

### 10.1 Debug Overlay

```javascript
// Available in dev mode via ?debug=1
// Shows: fps, tickTime, renderTime, entity counts, network stats
const debugStats = {
    fps: 0,
    tickTime: 0,
    renderTime: 0,
    entityCounts: { enemies: 0, bullets: 0, particles: 0 },
    networkStats: { rtt: 0, packetLoss: 0, inputDelay: 0 },
};
```

### 10.2 Performance Assertions

```javascript
// In development, warn if budgets exceeded
if (import.meta.env.DEV) {
    const tickStart = performance.now();
    simulation.tick(inputs);
    const tickTime = performance.now() - tickStart;

    if (tickTime > 2) {
        console.warn(`Tick exceeded budget: ${tickTime.toFixed(2)}ms`);
    }
}
```

---

## 11. Meta-Progression Implementation

### 11.1 Meta Store

```javascript
// state/useMetaStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useMetaStore = create(
    persist(
        (set, get) => ({
            // Pilot progression
            pilotXP: 0,
            pilotRank: 1,

            // Lifetime stats
            stats: {
                totalRuns: 0,
                totalPlaytime: 0,
                totalKills: 0,
                bossKills: 0,
                bestWave: 0,
                fastestBossKill: null,
                highestDamage: 0,
                currentWinStreak: 0,
                bestWinStreak: 0,
                currentDailyStreak: 0,
                bestDailyStreak: 0,
                lastPlayedDate: "",
                upgradePickCounts: {},
                synergyUnlockCounts: {},
                bossKillCounts: {},
                affixPlayCounts: {},
                affixWinCounts: {},
                modePlayCounts: {},
                modeWinCounts: {},
            },

            // Card collection system
            cardCollection: {
                unlockedUpgrades: [...INITIAL_UNLOCKED_UPGRADES],
                upgradeBoosts: {}, // { upgradeId: boostLevel (0-5) }
                totalCardsCollected: 0,
            },

            // Achievements
            achievements: {}, // { id: { unlocked: true, unlockedAt: timestamp } }

            // Cosmetics
            selectedShipColor: "default",
            selectedTitle: null,
            unlockedCosmetics: ["default"],

            // Pending card reward (after boss defeat)
            pendingCardReward: {
                active: false,
                options: [], // upgrade ids to choose from
            },

            actions: {
                addXP: (amount) => {
                    const { pilotXP, pilotRank } = get();
                    const newXP = pilotXP + amount;
                    const newRank = calculateRank(newXP);
                    set({ pilotXP: newXP, pilotRank: newRank });
                    return newRank > pilotRank
                        ? { rankUp: true, newRank }
                        : { rankUp: false };
                },

                recordRun: (runStats) => {
                    const { stats } = get();
                    set({
                        stats: {
                            totalRuns: stats.totalRuns + 1,
                            totalPlaytime:
                                stats.totalPlaytime + runStats.duration,
                            totalKills: stats.totalKills + runStats.kills,
                            bossKills:
                                stats.bossKills +
                                (runStats.bossDefeated ? 1 : 0),
                            bestWave: Math.max(stats.bestWave, runStats.wave),
                            fastestBossKill: runStats.bossDefeated
                                ? Math.min(
                                      stats.fastestBossKill ?? Infinity,
                                      runStats.duration
                                  )
                                : stats.fastestBossKill,
                            highestDamage: Math.max(
                                stats.highestDamage,
                                runStats.damageDealt
                            ),
                        },
                    });
                },

                unlockAchievement: (id) => {
                    const { achievements } = get();
                    if (achievements[id]?.unlocked) return false;
                    set({
                        achievements: {
                            ...achievements,
                            [id]: { unlocked: true, unlockedAt: Date.now() },
                        },
                    });
                    return true;
                },

                // Card collection actions
                triggerCardReward: () => {
                    const { cardCollection } = get();
                    // Build pool: locked upgrades + boostable upgrades
                    const pool = buildCardRewardPool(cardCollection);
                    if (pool.length === 0) return;

                    // Pick 3 weighted random options
                    const options = pickWeightedRandom(pool, 3);
                    set({ pendingCardReward: { active: true, options } });
                },

                selectCardReward: (upgradeId) => {
                    const { cardCollection } = get();
                    const isLocked =
                        !cardCollection.unlockedUpgrades.includes(upgradeId);

                    if (isLocked) {
                        // Unlock new upgrade
                        set({
                            cardCollection: {
                                ...cardCollection,
                                unlockedUpgrades: [
                                    ...cardCollection.unlockedUpgrades,
                                    upgradeId,
                                ],
                                totalCardsCollected:
                                    cardCollection.totalCardsCollected + 1,
                            },
                            pendingCardReward: { active: false, options: [] },
                        });
                    } else {
                        // Boost existing upgrade
                        const currentBoost =
                            cardCollection.upgradeBoosts[upgradeId] ?? 0;
                        set({
                            cardCollection: {
                                ...cardCollection,
                                upgradeBoosts: {
                                    ...cardCollection.upgradeBoosts,
                                    [upgradeId]: Math.min(5, currentBoost + 1),
                                },
                                totalCardsCollected:
                                    cardCollection.totalCardsCollected + 1,
                            },
                            pendingCardReward: { active: false, options: [] },
                        });
                    }
                },

                isUpgradeUnlocked: (upgradeId) => {
                    return get().cardCollection.unlockedUpgrades.includes(
                        upgradeId
                    );
                },

                getUpgradeBoost: (upgradeId) => {
                    return get().cardCollection.upgradeBoosts[upgradeId] ?? 0;
                },

                // Daily streak
                updateDailyStreak: () => {
                    const { stats } = get();
                    const today = new Date().toISOString().split("T")[0];
                    if (stats.lastPlayedDate === today)
                        return { streakIncreased: false };

                    const lastDate = new Date(stats.lastPlayedDate);
                    const todayDate = new Date(today);
                    const diffDays = Math.floor(
                        (todayDate - lastDate) / (1000 * 60 * 60 * 24)
                    );

                    const newStreak =
                        diffDays === 1 ? stats.currentDailyStreak + 1 : 1;
                    set({
                        stats: {
                            ...stats,
                            currentDailyStreak: newStreak,
                            bestDailyStreak: Math.max(
                                newStreak,
                                stats.bestDailyStreak
                            ),
                            lastPlayedDate: today,
                        },
                    });
                    return { streakIncreased: diffDays === 1, newStreak };
                },
            },
        }),
        { name: "quiet-quadrant-meta", version: 1 }
    )
);

// Initial unlocked upgrades (balanced starter set)
const INITIAL_UNLOCKED_UPGRADES = [
    "power-shot",
    "rapid-fire",
    "swift-projectiles",
    "engine-tune",
    "plating",
    "sidecar",
    "pierce",
    "shield-pickup",
    "kinetic-siphon",
    "dash-sparks",
];

function calculateRank(xp) {
    const thresholds = [
        0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800,
        9100, 10500, 12000, 13600, 15300, 17100, 19000,
    ];
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (xp >= thresholds[i]) return i + 1;
    }
    return 1;
}
```

### 11.2 Achievement Definitions

```javascript
// config/achievements.js
export const ACHIEVEMENTS = {
    firstBlood: {
        id: "firstBlood",
        name: "First Blood",
        description: "Kill your first enemy",
        icon: "🎯",
        category: "progression",
        check: (run) => run.kills >= 1,
    },
    bossSlayer: {
        id: "bossSlayer",
        name: "Boss Slayer",
        description: "Defeat the boss",
        icon: "👑",
        category: "progression",
        check: (run) => run.bossDefeated,
    },
    perfectionist: {
        id: "perfectionist",
        name: "Perfectionist",
        description: "Beat the boss without taking damage",
        icon: "✨",
        category: "progression",
        check: (run) => run.bossDefeated && run.damageTaken === 0,
    },
    teamPlayer: {
        id: "teamPlayer",
        name: "Team Player",
        description: "Complete a multiplayer run",
        icon: "🤝",
        category: "multiplayer",
        check: (run) => run.multiplayer && run.bossDefeated,
    },
    // ... more achievements
};
```

### 11.3 Achievement Checker

```javascript
// systems/AchievementChecker.js
import { ACHIEVEMENTS } from "../config/achievements.js";
import { useMetaStore } from "../state/useMetaStore.js";

export function checkAchievements(runStats) {
    const unlocked = [];
    const { achievements, actions } = useMetaStore.getState();

    for (const achievement of Object.values(ACHIEVEMENTS)) {
        if (achievements[achievement.id]?.unlocked) continue;
        if (achievement.check(runStats)) {
            if (actions.unlockAchievement(achievement.id)) {
                unlocked.push(achievement);
            }
        }
    }
    return unlocked;
}
```

---

## 12. Notification System Implementation

### 12.1 Notification Store

```javascript
// state/useNotificationStore.js
import { create } from "zustand";

let notificationId = 0;

export const useNotificationStore = create((set, get) => ({
    notifications: [],

    actions: {
        push: (notification) => {
            const id = ++notificationId;
            const { notifications } = get();
            const visible = notifications.filter((n) => !n.dismissed).slice(-2);

            set({
                notifications: [
                    ...visible,
                    {
                        ...notification,
                        id,
                        createdAt: Date.now(),
                        dismissed: false,
                    },
                ],
            });

            setTimeout(
                () => get().actions.dismiss(id),
                notification.duration || 3000
            );
            return id;
        },

        dismiss: (id) => {
            const { notifications } = get();
            set({
                notifications: notifications.map((n) =>
                    n.id === id ? { ...n, dismissed: true } : n
                ),
            });
        },
    },
}));

export function notifyAchievement(achievement) {
    useNotificationStore.getState().actions.push({
        type: "achievement",
        title: "Achievement Unlocked!",
        message: achievement.name,
        icon: achievement.icon,
        duration: 4000,
    });
}

export function notifyRankUp(newRank) {
    useNotificationStore.getState().actions.push({
        type: "rankUp",
        title: "Rank Up!",
        message: `You are now Rank ${newRank}`,
        icon: "⭐",
        duration: 3000,
    });
}

export function notifyPersonalBest(stat, value) {
    useNotificationStore.getState().actions.push({
        type: "personalBest",
        title: "New Personal Best!",
        message: `${stat}: ${value}`,
        icon: "🏆",
        duration: 3000,
    });
}
```

### 12.2 Notification Component

```jsx
// ui/components/NotificationToast.jsx
import { useNotificationStore } from "../../state/useNotificationStore.js";

export function NotificationToast() {
    const notifications = useNotificationStore((s) =>
        s.notifications.filter((n) => !n.dismissed)
    );

    return (
        <div className="notification-container">
            {notifications.map((n) => (
                <div
                    key={n.id}
                    className={`notification notification-${n.type}`}
                >
                    <span className="notification-icon">{n.icon}</span>
                    <div className="notification-content">
                        <div className="notification-title">{n.title}</div>
                        <div className="notification-message">{n.message}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

---

## 13. Game Modes Implementation

### 13.1 Mode Configuration

```javascript
// config/modes.js
export const GAME_MODES = {
    standard: {
        id: "standard",
        name: "Standard",
        description: "10 waves + boss",
        waves: 10,
        hasBoss: true,
        scaling: null,
    },
    infinite: {
        id: "infinite",
        name: "Infinite",
        description: "Endless waves with scaling difficulty",
        waves: Infinity,
        hasBoss: false, // Boss every 10 waves
        scaling: {
            healthPerCycle: 0.1,
            speedPerCycle: 0.05,
            elitesPerCycle: 1,
        },
    },
    twin: {
        id: "twin",
        name: "Twin",
        description: "Local co-op on same device",
        waves: 10,
        hasBoss: true,
        localMultiplayer: true,
        controls: {
            p1: { move: "wasd", aim: "mouse" },
            p2: { move: "arrows", aim: "numpad" },
        },
    },
    online: {
        id: "online",
        name: "Online",
        description: "P2P multiplayer with friend",
        waves: 10,
        hasBoss: true,
        networkMultiplayer: true,
    },
};
```

### 13.2 Mode Selection Flow

```javascript
// GameSimulation.js
export class GameSimulation {
    constructor(config) {
        this.mode = config.mode ?? "standard";
        this.seed = config.seed;
        this.rng = new SeededRandom(this.seed);
        this.state = createInitialState(this.mode);

        // Apply weekly affix if enabled
        if (config.affix) {
            this.affix = config.affix;
            this.applyAffixModifiers();
        }
    }

    applyAffixModifiers() {
        // Modify enemy stats, player stats, upgrade odds based on affix
        if (this.affix.enemyHealthMultiplier) {
            this.modifiers.enemyHealth *= this.affix.enemyHealthMultiplier;
        }
        // ... other modifiers
    }

    isInfiniteMode() {
        return this.mode === "infinite";
    }

    getWaveConfig(waveNumber) {
        if (this.isInfiniteMode()) {
            const cycle = Math.floor(waveNumber / 10);
            const baseWave = WAVES[waveNumber % 10];
            return applyInfiniteScaling(baseWave, cycle);
        }
        return WAVES[waveNumber];
    }
}
```
