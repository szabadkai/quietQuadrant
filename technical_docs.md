Below is a concise technical specification for **Quiet Quadrant**.

---

## 1. Goals & Non‑Goals

**Goals**

-   Browser‑playable game, hosted as a static site on **GitHub Pages**.
-   Core gameplay built with **Phaser**.
-   **React + Zustand** as the application shell and global state layer.
-   Use **localStorage** for persistence, with a clean abstraction so we can later swap to a real backend (REST/GraphQL/WebSocket).
-   Clear separation of concerns between:
    -   Game simulation (Phaser)
    -   App/UI/meta state (Zustand)
    -   Persistence (pluggable adapter)

**Non‑Goals (for now)**

-   No server‑authoritative gameplay.
-   No user accounts or authentication (but design to be compatible later).
-   No real‑time multiplayer.

---

## 2. Tech Stack

-   **Language:** TypeScript (strict mode)
-   **Frontend Framework:** React (functional components, hooks)
-   **Game Engine:** Phaser 3 (2D, WebGL)
-   **State Management:** Zustand (all app state goes through it: UI + meta + run summaries)
-   **Build Tool:** Vite (React + TS template)
-   **Styling:** Minimal (CSS modules or Tailwind; choice is not critical)
-   **Persistence:** `window.localStorage` behind an abstraction
-   **Deployment:** GitHub Pages (static hosting from `gh-pages` branch or `/docs`)

---

## 3. High‑Level Architecture

### 3.1 Layers

1. **Game Layer (Phaser)**

    - Responsible for:
        - Simulation of a single run (positions, physics, waves, boss, bullets).
        - Rendering of the game scene.
    - Phaser scenes emit high‑level events (e.g., `runStarted`, `levelUp`, `runEnded`, `bossPhaseChanged`) to the app layer.

2. **App Layer (React + Zustand)**

    - React renders:
        - Wrapper around the Phaser canvas
        - HUD overlays
        - Menus (title, pause, upgrade selection)
        - End‑of‑run summary
    - Zustand stores:
        - Game meta state (current run status, selected upgrades, run history)
        - UI state (which panel is open, current screen)
        - Settings (audio, input preferences)

3. **Persistence Layer**
    - Abstracted in a small API (e.g., `PersistenceAdapter`).
    - Default implementation uses `localStorage`.
    - Future implementation can talk to backend via HTTP/WebSocket with the same interface.

---

## 4. Application Structure

### 4.1 Top‑Level Structure

-   `src/`
    -   `main.tsx` – React entry point, creates root and mounts `<App />`.
    -   `App.tsx` – High‑level router between:
        -   Title
        -   Game (Phaser canvas + HUD)
        -   End‑of‑run
        -   Minimal “how to play”
    -   `game/`
        -   `GameConfig.ts` – Phaser configuration.
        -   `scenes/` – MainScene (lightweight system orchestrator).
        -   `systems/` – Modular game systems architecture:
            -   `PlayerSystem.ts` – Player movement, input, stats, abilities.
            -   `EnemySystem.ts` – Enemy spawning, AI, wave management.
            -   `ProjectileSystem.ts` – Bullet physics, collision, effects.
            -   `UpgradeSystem.ts` – Upgrade logic, synergy calculations.
            -   `VFXSystem.ts` – Visual effects, particles, screen effects.
            -   `SystemRegistry.ts` – System lifecycle management.
            -   `EventBus.ts` – Inter-system communication.
            -   Helper modules: CollisionHandler, EffectProcessor, WaveManager, EnemySpawner, etc.
    -   `state/`
        -   `useRunStore.ts` – in‑run and recent‑run metadata.
        -   `useMetaStore.ts` – settings, high scores, unlocks (future).
        -   `useUIStore.ts` – modal/menu open/closed, selected panels, etc.
    -   `persistence/`
        -   `PersistenceAdapter.ts` – interface + factory.
        -   `LocalStorageAdapter.ts` – localStorage implementation.
    -   `models/`
        -   TypeScript interfaces/types for Player, Enemy, Upgrade, RunSummary, Settings.
    -   `ui/`
        -   HUD components, menus, upgrade selection, summary views.
    -   `config/`
        -   Constants: upgrade catalog, enemy definitions, wave definitions.

---

## 5. State Management (Zustand)

### 5.1 Stores

All state outside the immediate per‑frame Phaser simulation goes into Zustand.

**`useRunStore`** (per‑run / gameplay meta)

-   `runId: string | null`
-   `status: "idle" | "running" | "paused" | "ended"`
-   `currentWave: number`
-   `elapsedTime: number`
-   `currentUpgrades: UpgradeInstance[]`
-   `lastRunSummary?: RunSummary`
-   `actions`:
    -   `startRun()`
    -   `endRun(summary: RunSummary)`
    -   `setWave(n: number)`
    -   `addUpgrade(u: UpgradeInstance)`
    -   `setStatus(status)`
    -   `tick(delta: number)`

**`useMetaStore`** (persisted meta, future‑proof for backend)

-   `bestRun?: RunSummary`
-   `totalRuns: number`
-   `settings: Settings`
-   `actions`:
    -   `recordRun(summary: RunSummary)`
    -   `updateSettings(patch: Partial<Settings>)`
    -   `hydrateFromPersistence()`
    -   `persist()`

**`useUIStore`** (pure UI)

-   `screen: "title" | "inGame" | "summary" | "howToPlay"`
-   `upgradeSelectionOpen: boolean`
-   `pauseMenuOpen: boolean`
-   `recentRareUpgradeSeen?: UpgradeId`
-   `actions` to switch screens, open/close overlays.

### 5.2 Interaction with Phaser

-   Phaser emits events to React/Zustand via:
    -   An event bus or direct callbacks (injected when creating the scene).
-   Zustand is not used for per‑frame physics; it stores **events and derived info**:
    -   e.g., on wave start, Phaser calls `useRunStore.getState().setWave(waveIndex)`.
    -   On run end, Phaser calls `endRun(summary)`.

React components subscribe to stores with `useStore` selectors to update UI.

---

## 6. Data Models (Types)

Define in `models/` as TypeScript types/interfaces.

```ts
export type Rarity = "common" | "rare";

export interface UpgradeDefinition {
    id: string;
    name: string;
    description: string;
    rarity: Rarity;
    maxStacks?: number;
    // Semantic flags to inform UI or future backend, not mechanics details
    category: "offense" | "defense" | "utility";
}

export interface UpgradeInstance {
    id: string; // references UpgradeDefinition.id
    stacks: number;
}

export interface RunSummary {
    runId: string;
    timestamp: number;
    durationSeconds: number;
    wavesCleared: number;
    bossDefeated: boolean;
    enemiesDestroyed: number;
    upgrades: UpgradeInstance[];
}

export interface Settings {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    lowGraphicsMode: boolean;
}
```

Enemy and wave configuration go into `config/` as typed data, not hard‑coded in logic.

---

## 7. Persistence & Local Storage

### 7.1 Persistence Adapter

Interface:

```ts
export interface PersistenceAdapter {
    loadMeta(): Promise<MetaStatePayload | null>;
    saveMeta(meta: MetaStatePayload): Promise<void>;
}
```

-   `MetaStatePayload` is a serializable subset of `useMetaStore` state:
    -   `settings`, `bestRun`, `totalRuns`, schema version, etc.

**LocalStorage Implementation**

-   Single key, namespaced by game and version:
    -   e.g., `quiet-quadrant:meta:v1`
-   Automatic migration strategy:
    -   Include `schemaVersion` inside payload.
    -   On load:
        -   Check version, apply migrations if needed.
        -   If unsupported, fall back to defaults.

### 7.2 Future Backend Migration

-   Swap `LocalStorageAdapter` with e.g. `RemoteAdapter`:

    -   Same interface, implemented with fetch/WebSocket.
    -   Allows adding user IDs, auth tokens, etc., without changing consumers.

-   Keep all persistence interactions inside `MetaStore` actions (e.g., `hydrateFromPersistence`, `persist`) to avoid spreading IO concerns.

---

## 8. Backend‑Ready Design

To ease migration to a full backend later:

-   **No direct `localStorage` calls outside the persistence layer.**
-   All persisted state is:
    -   Explicitly modeled (no ad‑hoc objects).
    -   Serialized/deserialized via a well‑typed DTO (`MetaStatePayload`).
-   Add a simple `Config` layer:
    -   e.g., `IS_REMOTE_ENABLED`, `API_BASE_URL` from environment variables.
-   Encapsulate any “user identity” as an optional `userId` field in meta, even if unused now; this is easy to wire later.

---

## 9. Build & Deployment

-   Build with **Vite** into a static bundle (`dist/`).
-   Configure GitHub Pages:
    -   Either use the `gh-pages` branch, or set `docs/` folder from repo settings.
    -   Ensure correct `base` path in Vite config when deploying under `/<repo-name>/`.
-   SPA consideration:
    -   Initially, all navigation is client‑side (no server routing).
    -   No complex routing: a single `index.html` is sufficient.

---

## 10. Testing & Debugging (Minimal, Practical)

-   **Unit tests (optional but recommended):**
    -   Pure functions in wave generation, upgrade selection, and persistence (e.g., Jest/Vitest).
-   **Manual testing focus:**
    -   LocalStorage persistence (settings and runs survive refresh).
    -   Upgrade rarity distribution over multiple runs.
    -   Boss fight performance and readability in constrained hardware.
-   **Debug UI (dev only):**
    -   Simple debug panel toggled by query param or key:
        -   Show current wave, DPS, upgrade stack info.
        -   Basic logging of events.

---

## 11. Performance Considerations

-   Keep React render workload low:
    -   Phaser handles frame updates; React only updates overlays and menus.
    -   Use `useStore` selectors and shallow compare in Zustand.
-   Cap object counts in Phaser:
    -   Limit max enemies/bullets concurrently.
    -   Use pooling for bullets and effects if needed.
-   Provide a simple **low‑graphics mode** in `Settings`:
    -   Fewer particles, less post‑processing, reduced glow.

---

This spec should be enough to scaffold the project and keep it structurally sound, with clear seams for swapping `localStorage` for a real backend later.
