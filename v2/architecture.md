# Architecture Document – Quiet Quadrant v2

## 1. Executive Summary

This document defines the architectural principles, patterns, and constraints for Quiet Quadrant v2. The primary goals are:

1. **Maintainability** - Small, focused files that are easy to understand and modify
2. **Testability** - Pure simulation logic that can be tested without rendering
3. **Network-first** - Designed for P2P multiplayer from the ground up
4. **Performance** - Predictable frame times and minimal allocations

---

## 2. Architectural Principles

### 2.1 Separation of Simulation and Presentation

The game is split into two distinct layers:

**Simulation Layer:**

-   Pure JavaScript, no framework dependencies
-   Deterministic given same inputs and seed
-   Operates on fixed timestep (60 ticks/second)
-   Owns all game state
-   Can run headless (for testing, server-side validation)

**Presentation Layer:**

-   Phaser for rendering
-   React for UI
-   Reads simulation state, never modifies it
-   Handles interpolation between ticks
-   Manages visual effects and audio

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Phaser Renderer │  │    React UI      │  │    Audio     │  │
│  │  (60fps visual)  │  │  (HUD, menus)    │  │   Manager    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                    │          │
│           └─────────────────────┼────────────────────┘          │
│                                 │                               │
│                          reads state                            │
├─────────────────────────────────┼───────────────────────────────┤
│                                 ▼                               │
│                    ┌────────────────────────┐                   │
│                    │      GAME STATE        │                   │
│                    │   (Single Source of    │                   │
│                    │        Truth)          │                   │
│                    └────────────────────────┘                   │
│                                 ▲                               │
│                          updates state                          │
├─────────────────────────────────┼───────────────────────────────┤
│                                 │                               │
│                     SIMULATION LAYER                            │
│  ┌──────────────────┐  ┌───────┴────────┐  ┌────────────────┐  │
│  │  Input Handler   │  │   Simulation   │  │    Network     │  │
│  │  (local/remote)  │──▶│    Engine     │◀─│    Manager     │  │
│  └──────────────────┘  │  (60 ticks/s)  │  │  (sync/correct)│  │
│                        └────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Input Sources          Simulation              Presentation
─────────────          ──────────              ────────────

Keyboard ──┐
Mouse ─────┼──▶ Input    ┌──────────┐         ┌──────────┐
Gamepad ───┤   Handler ──▶│          │         │  Phaser  │
Touch ─────┘              │   Game   │────────▶│ Renderer │
                          │  State   │         └──────────┘
Network ──────▶ Network   │          │
               Manager ──▶│          │────────▶┌──────────┐
                          └──────────┘         │  React   │
                               │               │    UI    │
                               │               └──────────┘
                               │
                               └──────────────▶┌──────────┐
                                               │  Audio   │
                                               │ Manager  │
                                               └──────────┘
```

### 2.3 File Size Constraints

**Hard Limit: 300 lines per file**

This constraint forces:

-   Single responsibility per file
-   Smaller, more focused functions
-   Better code organization
-   Easier code review

**Enforcement:**

```javascript
// eslint.config.js
export default [
    {
        rules: {
            "max-lines": [
                "error",
                { max: 300, skipBlankLines: true, skipComments: true },
            ],
            "max-lines-per-function": ["warn", { max: 50 }],
        },
    },
];
```

---

## 3. System Architecture

### 3.1 Simulation Systems

Each system is a plain object with update methods:

```javascript
// Pattern for all simulation systems
const ExampleSystem = {
    update(state, inputs, rng) {
        // Process state
    },
};
```

**PlayerSystem** - Player movement, shooting, abilities

```javascript
// PlayerSystem.js (~200 lines)
export const PlayerSystem = {
    update(state, inputs, rng) {
        for (const player of state.players) {
            if (!player.alive) continue;

            const input = inputs[player.id];
            this.handleMovement(player, input, state);
            this.handleShooting(player, input, state, rng);
            this.handleDash(player, input, state);
            this.updateTimers(player);
        }
    },

    handleMovement(player, input, state) {
        // Movement logic
    },

    handleShooting(player, input, state, rng) {
        // Shooting logic
    },

    // ... other methods
};
```

**EnemySystem** - Enemy AI, spawning, behavior

```javascript
// EnemySystem.js (~250 lines)
export const EnemySystem = {
    update(state, rng) {
        this.processSpawnQueue(state, rng);

        for (const enemy of state.enemies) {
            if (!enemy.alive) continue;

            switch (enemy.type) {
                case "drifter":
                    this.updateDrifter(enemy, state);
                    break;
                case "watcher":
                    this.updateWatcher(enemy, state, rng);
                    break;
                case "mass":
                    this.updateMass(enemy, state, rng);
                    break;
            }
        }
    },

    // ... behavior methods
};
```

**BulletSystem** - Bullet movement, lifetime

```typescript
// BulletSystem.ts (~150 lines)
export const BulletSystem = {
    update(state: GameState): void {
        for (const bullet of state.bullets) {
            bullet.x += bullet.vx / TICK_RATE;
            bullet.y += bullet.vy / TICK_RATE;
            bullet.ttl--;

            if (bullet.ttl <= 0 || this.isOutOfBounds(bullet)) {
                bullet.alive = false;
            }
        }
    },

    // ... helper methods
};
```

**CollisionSystem** - All collision detection and response

```javascript
// CollisionSystem.js (~200 lines)
export const CollisionSystem = {
    update(state) {
        this.playerBulletsVsEnemies(state);
        this.enemyBulletsVsPlayers(state);
        this.enemiesVsPlayers(state);
        this.playersVsPickups(state);
    },

    // ... collision methods using spatial partitioning
};
```

### 3.2 Rendering Systems

Renderers are classes that manage Phaser objects:

```javascript
// Pattern for all renderers
class Renderer {
    constructor(scene) {
        this.scene = scene;
    }

    render(state, interpolation) {
        // Override in subclass
    }

    cleanup() {
        // Override in subclass
    }
}
```

**Key Principle:** Renderers create/destroy Phaser objects to match simulation state. They never store game logic state.

```javascript
// EnemyRenderer.js (~150 lines)
export class EnemyRenderer {
    constructor(scene) {
        this.scene = scene;
        this.sprites = new Map();
    }

    render(state, interpolation) {
        const activeIds = new Set();

        // Update or create sprites for active enemies
        for (const enemy of state.enemies) {
            if (!enemy.alive) continue;
            activeIds.add(enemy.id);

            let sprite = this.sprites.get(enemy.id);
            if (!sprite) {
                sprite = this.createSprite(enemy);
                this.sprites.set(enemy.id, sprite);
            }

            // Interpolate position
            sprite.x = lerp(enemy.prevX, enemy.x, interpolation);
            sprite.y = lerp(enemy.prevY, enemy.y, interpolation);
        }

        // Remove sprites for dead enemies
        for (const [id, sprite] of this.sprites) {
            if (!activeIds.has(id)) {
                sprite.destroy();
                this.sprites.delete(id);
            }
        }
    }

    cleanup() {
        for (const sprite of this.sprites.values()) {
            sprite.destroy();
        }
        this.sprites.clear();
    }
}
```

### 3.3 Network Architecture

**Authority Model:**

```
                    HOST                              GUEST
                    ────                              ─────

Authoritative for:                    Authoritative for:
- RNG seed                            - Own ship movement
- Enemy spawning                      - Own bullets
- Enemy AI
- Enemy bullets                       Receives from host:
- Wave progression                    - Enemy state
- Boss behavior                       - Enemy bullets
- Pickups                             - Wave events
                                      - Corrections
Receives from guest:
- Guest input
- Guest bullet spawns
```

**Sync Protocol:**

```
Time ──────────────────────────────────────────────────────────▶

Host:  [Tick 0]──[Tick 1]──[Tick 2]──[Tick 3]──[Tick 4]──[Tick 5]
         │                    │                    │
         └─── Input ──────────┼─── Input ──────────┼─── Input ───▶
                              │                    │
                              └─── Correction ─────┘

Guest: [Tick 0]──[Tick 1]──[Tick 2]──[Tick 3]──[Tick 4]──[Tick 5]
         │                    │                    │
         └─── Input ──────────┼─── Input ──────────┼─── Input ───▶
                              │                    │
                              ◀─── Correction ─────┘
```

**Input Packet Structure (compact, 9 bytes):**

```javascript
// Input packet structure
const inputPacket = {
    tick: 0, // u32 - 4 bytes - simulation tick
    moveX: 0, // i8 - 1 byte - movement X (-127 to 127)
    moveY: 0, // i8 - 1 byte - movement Y
    aimX: 0, // i8 - 1 byte - aim direction X
    aimY: 0, // i8 - 1 byte - aim direction Y
    flags: 0, // u8 - 1 byte - fire (bit 0), dash (bit 1)
};
```

**Correction Snapshot Structure:**

```javascript
const correctionSnapshot = {
    tick: 0,
    players: [
        { id: "p1", x: 100, y: 200, health: 5 },
        { id: "p2", x: 300, y: 200, health: 4 },
    ],
    enemies: [
        { id: 1, x: 400, y: 100 },
        { id: 2, x: 450, y: 150 },
    ],
};
// ~500 bytes max (20 enemies × 12 bytes + overhead)
```

---

## 4. State Management

### 4.1 Game State Structure

```javascript
/**
 * Game state structure - plain object, easy to serialize
 */
function createGameState() {
    return {
        // Metadata
        tick: 0,
        seed: 0,
        phase: "pregame", // 'pregame' | 'wave' | 'intermission' | 'boss' | 'victory' | 'defeat'

        // Entities
        players: [],
        enemies: [],
        bullets: [],
        pickups: [],

        // Wave management
        wave: { current: 0, enemiesRemaining: 0 },

        // Boss (null if not active)
        boss: null,

        // Events this tick (for rendering/audio)
        events: [],
    };
}
```

### 4.2 Zustand Store Design

```javascript
// state/useGameStore.js
import { create } from "zustand";

export const useGameStore = create((set, get) => ({
    simulation: null,
    state: null,

    actions: {
        startGame: (config) => {
            const simulation = new GameSimulation(config.seed);
            set({ simulation, state: simulation.getState() });
        },
        tick: (inputs) => {
            const { simulation } = get();
            if (!simulation) return;
            simulation.tick(inputs);
            set({ state: simulation.getState() });
        },
        endGame: () => {
            set({ simulation: null, state: null });
        },
    },
}));

// Selector pattern for performance
const selectPlayerHealth = (s) => s.state?.players[0]?.health ?? 0;
const selectWave = (s) => s.state?.wave.current ?? 0;

// Usage in components
function HUD() {
    const health = useGameStore(selectPlayerHealth);
    const wave = useGameStore(selectWave);
    // Only re-renders when health or wave changes
}
```

### 4.3 State Mutation Pattern

Simulation state is mutable internally - no need for immutability overhead:

```javascript
// GameSimulation.js
class GameSimulation {
    constructor(seed) {
        this.state = createGameState();
        this.state.seed = seed;
    }

    tick(inputs) {
        // Direct mutation is fine - simulation owns this state
        this.state.tick++;
        this.state.players[0].x += velocity;
    }

    getState() {
        return this.state;
    }
}
```

---

## 5. Module Dependencies

### 5.1 Dependency Rules

```
┌─────────────────────────────────────────────────────────────┐
│                         config/                              │
│  (No dependencies - pure data)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       simulation/                            │
│  (Depends only on: config/, utils/)                         │
│  (NO Phaser, NO React, NO network)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         state/                               │
│  (Depends on: simulation/, config/)                         │
│  (Zustand stores)                                           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   rendering/    │ │      ui/        │ │    network/     │
│   (Phaser)      │ │    (React)      │ │   (Trystero)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 5.2 Import Rules

```javascript
// ✅ ALLOWED
// simulation/ can import from config/, utils/
import { ENEMIES } from "../config/enemies.js";
import { SeededRandom } from "../utils/random.js";

// ❌ FORBIDDEN
// simulation/ cannot import from rendering/, ui/, network/
import { PlayerRenderer } from "../rendering/PlayerRenderer.js"; // ERROR
import { useGameStore } from "../state/useGameStore.js"; // ERROR
```

**Enforcement via ESLint:**

```javascript
// eslint.config.js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['../rendering/*', '../ui/*', '../network/*'],
          message: 'Simulation layer cannot depend on presentation or network layers',
        },
      ],
    }],
  },
}
```

---

## 6. Error Handling

### 6.1 Simulation Errors

Simulation should never throw. Invalid states are handled gracefully:

```javascript
// Instead of throwing
function getEnemy(state, id) {
    const enemy = state.enemies.find((e) => e.id === id);
    if (!enemy) {
        throw new Error(`Enemy ${id} not found`); // ❌ Don't do this
    }
    return enemy;
}

// Return null/undefined and handle at call site
function getEnemy(state, id) {
    return state.enemies.find((e) => e.id === id); // ✅ Do this
}
```

### 6.2 Network Errors

Network errors are expected and handled gracefully:

```javascript
class NetworkManager {
    constructor() {
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
    }

    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.scheduleReconnect();
        } else {
            this.emit("connectionFailed");
            // UI shows "Connection lost" and offers to return to menu
        }
    }
}
```

### 6.3 Rendering Errors

Rendering errors should not crash the game:

```javascript
class EnemyRenderer {
    render(state) {
        try {
            // Rendering logic
        } catch (error) {
            console.error("Rendering error:", error);
            // Continue running - visual glitch is better than crash
        }
    }
}
```

---

## 7. Testing Architecture

### 7.1 Test Categories

```
tests/
├── unit/                    # Pure function tests
│   ├── simulation/          # Simulation system tests
│   ├── utils/               # Utility function tests
│   └── config/              # Config validation tests
│
├── integration/             # Multi-system tests
│   ├── gameplay/            # Full game scenarios
│   └── network/             # Network sync tests
│
└── e2e/                     # End-to-end tests (optional)
    └── flows/               # User flow tests
```

### 7.2 Simulation Testing

```javascript
// tests/unit/simulation/PlayerSystem.test.js
describe("PlayerSystem", () => {
    let state;
    let rng;

    beforeEach(() => {
        state = createTestState();
        rng = new SeededRandom(12345);
    });

    describe("movement", () => {
        it("moves player right when moveX is positive", () => {
            const initialX = state.players[0].x;
            const input = { moveX: 1, moveY: 0, fire: false, dash: false };

            PlayerSystem.update(state, { p1: input }, rng);

            expect(state.players[0].x).toBeGreaterThan(initialX);
        });

        it("clamps player to arena bounds", () => {
            state.players[0].x = ARENA_WIDTH - 1;
            const input = { moveX: 1, moveY: 0, fire: false, dash: false };

            PlayerSystem.update(state, { p1: input }, rng);

            expect(state.players[0].x).toBeLessThanOrEqual(
                ARENA_WIDTH - PLAYER_RADIUS
            );
        });
    });
});
```

### 7.3 Determinism Testing

```javascript
// tests/integration/determinism.test.js
describe("Simulation Determinism", () => {
    it("produces identical results with same seed", () => {
        const seed = 42;
        const inputs = generateRandomInputs(1000, seed);

        const sim1 = new GameSimulation(seed);
        const sim2 = new GameSimulation(seed);

        for (let i = 0; i < 1000; i++) {
            sim1.tick(inputs[i]);
            sim2.tick(inputs[i]);

            // States must be identical at every tick
            expect(sim1.getState()).toEqual(sim2.getState());
        }
    });

    it("diverges with different seeds", () => {
        const inputs = generateRandomInputs(100, 1);

        const sim1 = new GameSimulation(1);
        const sim2 = new GameSimulation(2);

        for (let i = 0; i < 100; i++) {
            sim1.tick(inputs[i]);
            sim2.tick(inputs[i]);
        }

        // Enemy positions should differ due to different RNG
        expect(sim1.getState().enemies).not.toEqual(sim2.getState().enemies);
    });
});
```

### 7.4 Network Testing

```javascript
// tests/integration/network/sync.test.js
describe("Network Sync", () => {
    it("maintains sync under normal conditions", async () => {
        const { host, guest } = await createTestPeers();

        // Run 100 ticks with simulated network
        for (let i = 0; i < 100; i++) {
            const hostInput = generateInput();
            const guestInput = generateInput();

            host.tick(hostInput, guestInput);
            guest.tick(guestInput, hostInput);

            // Simulate network delay
            await delay(16);

            // Exchange corrections
            if (i % 12 === 0) {
                const correction = host.generateCorrection();
                guest.applyCorrection(correction);
            }
        }

        // States should be within tolerance
        const hostState = host.getState();
        const guestState = guest.getState();

        expect(
            distance(hostState.players[0], guestState.players[0])
        ).toBeLessThan(50);
    });
});
```

---

## 8. Performance Guidelines

### 8.1 Allocation Avoidance

```javascript
// ❌ BAD: Creates new object every tick
function getVelocity(player) {
    return { x: player.vx, y: player.vy };
}

// ✅ GOOD: Reuse scratch objects
const scratchVec = { x: 0, y: 0 };
function getVelocity(player) {
    scratchVec.x = player.vx;
    scratchVec.y = player.vy;
    return scratchVec;
}
```

### 8.2 Spatial Partitioning

For collision detection with many entities:

```javascript
// Simple grid-based spatial hash
class SpatialHash {
    constructor(cellSize = 64) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    clear() {
        this.cells.clear();
    }

    insert(id, x, y) {
        const key = this.getKey(x, y);
        const cell = this.cells.get(key) ?? [];
        cell.push(id);
        this.cells.set(key, cell);
    }

    query(x, y, radius) {
        const results = [];
        const minX = Math.floor((x - radius) / this.cellSize);
        const maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize);
        const maxY = Math.floor((y + radius) / this.cellSize);

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const cell = this.cells.get(`${cx},${cy}`);
                if (cell) results.push(...cell);
            }
        }

        return results;
    }

    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(
            y / this.cellSize
        )}`;
    }
}
```

### 8.3 Object Pooling

```javascript
// Generic object pool
class Pool {
    constructor(factory, reset, initialSize = 100) {
        this.available = [];
        this.factory = factory;
        this.reset = reset;

        for (let i = 0; i < initialSize; i++) {
            this.available.push(factory());
        }
    }

    acquire() {
        return this.available.pop() ?? this.factory();
    }

    release(obj) {
        this.reset(obj);
        this.available.push(obj);
    }
}

// Usage
const bulletPool = new Pool(
    () => ({
        id: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        damage: 0,
        ttl: 0,
        alive: false,
    }),
    (b) => {
        b.alive = false;
    }
);
```

---

## 9. Coding Agent Skills

When implementing this architecture, the coding agent should:

### 9.1 File Management

-   **Always check file length** before adding code
-   **Split files proactively** when approaching 250 lines
-   **Create new files** for new responsibilities rather than expanding existing ones
-   **Use barrel exports** (index.js) to maintain clean imports

### 9.2 Code Patterns

-   **Prefer composition over inheritance**
-   **Use pure functions** in simulation layer
-   **Avoid side effects** except in designated places (stores, network)
-   **Use JSDoc sparingly** - only for complex public APIs

### 9.3 Testing

-   **Write tests alongside code** - not after
-   **Test edge cases** - empty arrays, null values, boundary conditions
-   **Test determinism** - same inputs = same outputs

### 9.4 Performance

-   **Profile before optimizing** - don't guess at bottlenecks
-   **Avoid premature optimization** - clarity first
-   **Use object pools** for frequently created/destroyed objects
-   **Minimize allocations** in hot paths (tick loop)

### 9.5 Networking

-   **Assume packets can be lost** - design for it
-   **Assume packets can arrive out of order** - handle it
-   **Assume latency varies** - interpolate and predict
-   **Keep packets small** - compress where possible

---

## 10. Migration Path from v1

### 10.1 Phase 1: Extract Simulation

1. Create `simulation/` directory
2. Extract player logic from MainScene to PlayerSystem
3. Extract enemy logic to EnemySystem
4. Extract collision logic to CollisionSystem
5. Create GameSimulation class that orchestrates systems
6. Write tests for each system

### 10.2 Phase 2: Refactor Rendering

1. Create `rendering/` directory
2. Create renderer classes that read from GameState
3. Gradually move Phaser code from MainScene to renderers
4. MainScene becomes thin orchestrator

### 10.3 Phase 3: Simplify Networking

1. Implement new InputSync based on deterministic model
2. Remove legacy state sync code
3. Implement correction snapshots
4. Test multiplayer thoroughly

### 10.4 Phase 4: Polish

1. Optimize performance
2. Add missing features
3. Polish UI/UX
4. Final testing and bug fixes
