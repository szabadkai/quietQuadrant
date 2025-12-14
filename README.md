# Quiet Quadrant

Quiet Quadrant is a minimalist roguelike arena shooter. One ship, one boxed-in quadrant, and escalating enemy waves that culminate in a bullet-hell boss. The game scene is built with Phaser, while React renders the HUD, menus, and meta screens.

## How to Play

-   Move: WASD / Arrow Keys
-   Aim & Fire: Mouse aim, hold Left Click to shoot
-   Dash: Shift (short cooldown, grants brief i-frames)
-   Pause: Esc (resume, restart, or return to menu)

## Game Loop

-   Survive 10 waves plus a boss. Small intermissions let you reposition before the next wave.
-   Enemies drop XP shards. Leveling pauses the action and offers 3 upgrades; pick one to stack power.
-   Upgrade rarities: Common / Rare / Legendary, with stacking caps and category tags (offense, defense, utility).
-   Synergies unlock when specific upgrade sets are owned (examples: Railgun, Meat Grinder, Vampire, Frame Rate Killer, Black Hole Sun).
-   Weekly seed: The title screen shows the current weekly seed, boss, and affix (modifiers like Nimble Foes or Volatile Finds). You can also start a fully random seed.
-   Run summary: At death or victory you see time, waves cleared, enemies destroyed, loadout, and any synergies hit.
-   Persistence: Local bests, per-seed bests, and settings are stored in `localStorage` on the device.

## Project Layout

-   `src/game` – Phaser scene, spawning, combat, waves, boss patterns, upgrades, synergies.
-   `src/ui` – React HUD, overlays (upgrades, pause menu, wave countdown, summary, title/how-to).
-   `src/config` – Waves, enemies, bosses, weekly affixes, upgrades, and synergy definitions.
-   `src/state` – Zustand stores for run state, UI state, and persisted meta/settings.
-   `src/persistence` – `localStorage` adapter (pluggable later).

## Development

1. `npm install`
2. `npm run dev` and open the Vite dev server (default http://localhost:5173).
3. Dev-only helper: `Shift + D` toggles the in-game Dev Panel (jump to waves, grant upgrades/synergies).

### Scripts

-   `npm run dev` – Start Vite + live reload.
-   `npm run build` – Type-check then produce a static build in `docs/` (configured for GitHub Pages).
-   `npm run preview` – Serve the production build locally.
-   `npm run lint` – ESLint over the project.

## Deployment (GitHub Pages-friendly)

1. `npm run build` (outputs to `docs/` with `base: './'` for relative assets).
2. Commit and push; in GitHub Pages settings point to the repository’s `docs/` folder on the default branch (or publish the `docs/` folder to a `gh-pages` branch if preferred).
3. Optionally run `npm run preview` before publishing to verify the static build.
