# Quiet Quadrant – Stats, Collection, and Achievements Specs

This document defines the current UX/behavior for the stats screen, collection screen, and achievement system so they can be reimplemented 1:1.

## 1) Stats Screen

**Purpose & Entry**

-   Full-screen overlay opened from the Title screen “Stats” button.
-   Read-only view; pressing **Back** returns to the Title screen (no other side effects).

**Layout**

-   Overlay dims playfield; centered panel `max-width: 600px`, `max-height: 85vh`, scrollable if needed.
-   Vertical stack of sections; each has a small-caps title and a bottom border except the last section.
-   Stat grids are 4 columns, collapse to 2 columns ≤600px width.

**Data Source & Formatting**

-   Data from `useMetaStore().lifetimeStats`.
-   Numbers: `formatNumber` with K/M abbreviations (1 decimal).
-   Time: `formatTime` -> `Xm Ys`, or `Hh Mm`; non-positive/∞ shows “—”.
-   Win rate: `round(totalVictories / totalRuns * 100)`, 0 if no runs.

**Section Order & Content**

1. **Overview**: Total Runs, Time Played, Victories, Win Rate.
2. **Combat**: Enemies Destroyed, Waves Cleared, Bosses Defeated, Highest Wave.
3. **Records**: Fastest Victory, Most Kills (run), Most Upgrades, Best Win Streak.
4. **Streaks**: Current Daily Streak (highlighted), Best Daily Streak, Current Win Streak, Best Win Streak.
5. **Favorite Upgrades**: Top 5 by pick count; each row shows rarity pill + “×count”. Hidden if none.
6. **Achievements**: “Synergies Discovered” progress (unlocked/total). Grid cards with name, description, and “Unlocked N×”. Empty state text if none.
7. **Boss Record**: Only bosses with `encounters > 0`; shows `kills/encounters` and win % per boss.
8. **Affix Experience**: First 6 affixes with `plays > 0`, sorted by plays desc; shows `wins W / plays P`, tooltip carries description.

**Interaction**

-   Content is non-clickable.
-   Single primary **Back** button sets screen to `title`.

**Visual Notes**

-   Stat cards: dark panels with accent borders; highlighted card for current daily streak.
-   Lists: left-aligned names, right-aligned counts; boss/affix names styled as strong labels.
-   Achievements grid: gold-accent cards with hover lift; progress header in a tinted pill.

**Responsiveness**

-   Panel and overlay scroll if content exceeds viewport.
-   Grids collapse as described; retains touch-friendly button sizes from shared styles.

## 2) Collection Screen

**Purpose & Entry**

-   Full-screen overlay opened from the Title screen “Collection” button.
-   Read-only view of unlocked upgrades and their boost levels; **Back** returns to Title.

**Layout**

-   Centered panel `max-width: 800px`, `max-height: 90vh`, scrollable.
-   Order: Summary row → Filter bar → Card grid → Hint text → Actions row.

**Data Source & Filtering**

-   Uses `useMetaStore().cardCollection` plus `UPGRADE_CATALOG`.
-   Only unlocked upgrades are shown (locked cards are not revealed).
-   Filters: All / Common / Rare / Legendary. Active filter is accent-styled.
-   Sorting: rarity priority `legendary > rare > common`, then name A–Z.

**Summary Strip**

-   Cards Unlocked (count of unlocked IDs).
-   Legendaries (unlocked with rarity `legendary`, gold text).
-   Cards Collected (total unlocks/boosts taken).

**Card Tiles**

-   Classes: `collection-card` + rarity + `unlocked`; legendary unlocked gets subtle glow.
-   Header: rarity label; boost badge `+N` if boost > 0.
-   Body: name, description, 5-pip boost bar (filled up to boost level), category pill.
-   No click handling on cards.

**Mystery Slot**

-   If filter=All and currently displayed upgrades < 30, append a locked “?” tile reading “More to discover... Defeat bosses to unlock new cards.”

**Hint**

-   Single line: “Defeat bosses to unlock new cards and boost existing ones. Boosted cards appear more often!”

**Interaction**

-   Filter buttons update the view; **Back** returns to Title.

**Responsiveness**

-   Grid uses `auto-fill, minmax(180px, 1fr)` to collapse gracefully on smaller screens.
-   Panel scrolls; overlay covers playfield.

## 3) Achievement System (Synergy-Based)

**Goal**

-   Surface discovery of synergies as “achievements” with a popup and lifetime tracking; expose counts in Stats screen.

**Data Model**

-   Synergy catalog: `SYNERGY_DEFINITIONS` (id, name, description, requires[]).
-   Lifetime tracking: `lifetimeStats.synergyUnlockCounts` (id → times unlocked).
-   UI state: `useMetaStore().achievementPopup` with `{ show, synergyId, synergyName, synergyDescription }`.

**Unlock & Persistence Flow**

-   During a run, when a synergy is achieved, gameplay code must call `useMetaStore().actions.showAchievement(id, name, description)` to trigger the popup (call site is outside this spec but required).
-   On run completion, `recordRun` persists synergy unlock counts by incrementing each synergy present in the `RunSummary.synergies` array.
-   Lifetime stats (including synergy counts) and card collection are saved via `LocalStorageAdapter` (schemaVersion 1).

**Popup Behavior**

-   Component: `AchievementPopup`.
-   Show: when `achievementPopup.show` is set true; adds a short delay (~100 ms) before animating in.
-   Manual dismiss: clicking overlay or “Awesome!” button; triggers animate-out then clears popup state.
-   Visibility: overlay blocks input; pointer-events enabled only while visible.
-   Animation: scale+translate entrance (`animate-in`), exit (`animate-out`); gold badge pulse and icon bounce.
-   Copy: Title “Achievement Unlocked!”, synergy name, synergy description, hint “Synergy discovered!”, CTA “Awesome!”.

**Stats Screen Integration**

-   Achievements section reads `synergyUnlockCounts`:
    -   Progress header shows `unlocked / total synergies`.
    -   Grid cards show each synergy with count `Unlocked N×`.
    -   Empty state text if none unlocked.

**Edge/Formatting Rules**

-   Synergy counts default to 0; only entries with count > 0 appear in Stats achievements grid.
-   Run summaries must include `synergies` array to be counted.
-   Popup is purely presentational; it does not mutate counts (those are updated on run save).

**Responsiveness & Styling**

-   Popup max-width 400px; centered overlay; uses gold-accent gradient panel with rounded corners and shadows.
-   Works on desktop and mobile; retains tap targets per shared button styles.

**Related State Interactions**

-   Independent from streak popup (daily streaks) but both live in `useMetaStore`.
-   Does not affect gameplay state; purely UI + persistence of counts.

---

Authored for parity with the current implementation in `src/ui/components/StatsScreen.tsx`, `CollectionScreen.tsx`, `AchievementPopup.tsx`, and `state/useMetaStore.ts`.
