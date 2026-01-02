# Menu System Specification – Quiet Quadrant v2

## 1. Screen Architecture

### 1.1 Screen Types

| Screen           | Type  | Purpose                   |
| ---------------- | ----- | ------------------------- |
| Title            | Full  | Main menu, mode selection |
| Game             | Full  | Active gameplay           |
| Summary          | Full  | Post-run results          |
| Stats            | Full  | Lifetime statistics       |
| Collection       | Full  | Card collection viewer    |
| HowToPlay        | Full  | Tutorial/controls         |
| MultiplayerSetup | Full  | MP mode selection         |
| HostGame         | Full  | Host lobby                |
| JoinGame         | Full  | Join with code            |
| TwinSetup        | Full  | Local co-op setup         |
| Pause            | Modal | In-game pause overlay     |
| Upgrade          | Modal | Level-up selection        |
| CardReward       | Modal | Post-boss card pick       |
| Leaderboard      | Modal | Weekly rankings           |
| Settings         | Modal | Audio/accessibility       |

### 1.2 UI Store State

```javascript
const UIState = {
    screen: "title",
    pauseOpen: false,
    upgradeOpen: false,
    cardRewardOpen: false,
    leaderboardOpen: false,
    settingsOpen: false,
    upgradeOptions: [],
    cardRewardOptions: [],
    focusedIndex: 0,
    navigationEnabled: true,
};
```

---

## 2. Title Screen

**Purpose:** Main entry point, mode selection, weekly info

**Elements:**
| Element | Type | Action |
|---------|------|--------|
| Weekly Run | Button (primary) | Start with weekly seed |
| Random Run | Button | Start with random seed |
| Multiplayer | Button | → MultiplayerSetup |
| Infinite Mode | Button | Start infinite mode |
| Collection | Button | → Collection screen |
| Stats | Button | → Stats screen |
| How to Play | Button | → HowToPlay screen |
| Settings | Button | Open Settings modal |
| Season Card | Info panel | Weekly seed, boss, affix, personal best |

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│                     QUIET QUADRANT                     v1.0 │
│            One ship. One quadrant. Stay alive.              │
│                                                             │
│                    [ Weekly Run ]  ←primary                 │
│                    [ Random Run ]                           │
│                    [ Multiplayer ]                          │
│                    [ Infinite Mode ]                        │
│                    [ Collection ]                           │
│                    [ Stats ]                                │
│                    [ How to Play ]                          │
│                    [ Settings ]                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ This Week: Seed ABC123 · Boss: Sentinel Core        │   │
│  │ Affix: Nimble Foes · Your Best: Wave 10             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Game Screen (HUD)

**HUD Elements:**
| Element | Position | Content |
|---------|----------|---------|
| Health | Top-left | Hearts or bar (5 HP default) |
| Wave | Top-center | "WAVE X" or "BOSS" |
| Dash | Top-right | Cooldown indicator |
| Upgrades | Left side | Active upgrade icons |
| XP Bar | Bottom | Progress bar + level |
| Partner HP | Top-left (MP) | Second health bar |

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ ♥♥♥♥♥                    WAVE 7                    [⚡100%] │
│ [🔫][🛡️][⚡]                                                 │
│                        [GAME AREA]                          │
│ ════════════════════════════════════════════════════ Lv.5  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Pause Menu (Modal)

**Elements:**
| Element | Type | Range/Action |
|---------|------|--------------|
| Master Volume | Slider | 0-100% |
| Music Volume | Slider | 0-100% |
| SFX Volume | Slider | 0-100% |
| Screen Shake | Toggle | On/Off |
| Resume | Button | Close modal, resume |
| Quit | Button | End run, → Title |

**Navigation:**

-   Up/Down: Move focus
-   Left/Right: Adjust sliders
-   Escape: Resume game

---

## 5. Upgrade Selection (Modal)

**Purpose:** Choose upgrade on level-up (3 cards)

**Card Styling by Rarity:**
| Rarity | Border | Background | Glow |
|--------|--------|------------|------|
| Common | Gray #666 | #1a1a1a | None |
| Rare | Gold #FFD700 | #2a2a1a | Subtle |
| Legendary | Purple #AA00FF | #2a1a2a | Pulse |

**Navigation:**

-   Left/Right or 1/2/3: Select card
-   Enter: Confirm selection
-   No escape (must choose)

---

## 6. Card Reward (Modal)

**Purpose:** Post-boss unlock/boost selection

**Card Types:**

-   UNLOCK: New upgrade (shows "★ NEW ★")
-   BOOST: Existing upgrade (shows boost pips ●●●○○)

**Layout:** Same as Upgrade Selection with reward-specific labels

---

## 7. Summary Screen

**Sections:**
| Section | Content |
|---------|---------|
| Header | Victory/Defeat + subtitle |
| Stats Grid | Time, Waves, Enemies |
| Run Info | Seed, Boss, Affix, Mode |
| Upgrades | List with stack counts |
| Synergies | Discovered this run |
| Unlocks | Achievements, XP, personal bests |
| Records | All-time best, weekly best |
| Actions | Run Again, Title |

---

## 8. Stats Screen

**Sections:**

1. Overview: Total runs, playtime, victories, win rate
2. Combat: Enemies destroyed, waves cleared, bosses defeated
3. Records: Fastest victory, most kills, best streaks
4. Streaks: Daily streak, win streak
5. Favorites: Top 5 upgrades
6. Achievements: Synergy discovery progress
7. Boss Record: Per-boss stats
8. Affix Experience: Per-affix stats

---

## 9. Collection Screen

**Features:**

-   Filter by rarity (All/Common/Rare/Legendary)
-   Sort by rarity then name
-   Show boost level (●●●○○ pips)
-   Mystery card hint for locked upgrades
-   Summary: Cards unlocked, legendaries, total collected

---

## 10. Multiplayer Screens

### 10.1 Multiplayer Setup

-   Local Co-op → TwinSetup
-   Host Online → HostGame
-   Join Online → JoinGame
-   Back → Title

### 10.2 Host Game

-   Display 6-char room code
-   Copy code button
-   Connection status indicator
-   Start button (enabled when P2 joins)
-   Cancel button

### 10.3 Join Game

-   6-char code input (auto-uppercase)
-   Join button (disabled until valid)
-   Connection status
-   Cancel button

---

## 11. Settings Modal

**Sections:**

-   Audio: Master, Music, SFX volume sliders
-   Display: Screen shake, damage numbers, high contrast
-   Accessibility: Reduced motion, colorblind mode
-   Controls: Input mode, rebind controls

---

## 12. Navigation System

### 12.1 Input Methods

| Input        | Keyboard    | Gamepad  | Touch    |
| ------------ | ----------- | -------- | -------- |
| Navigate     | Arrow keys  | D-pad    | Tap      |
| Select       | Enter/Space | A button | Tap      |
| Back         | Escape      | B button | Back btn |
| Quick select | 1/2/3       | -        | -        |

### 12.2 Focus Management

```javascript
const nav = useMenuNavigation(items, options);
// items: [{ ref, onActivate, onAdjust?, disabled? }]
// options: { enabled, columns, onBack, loop }
// Returns: { focusedIndex, setFocusedIndex }
```

**Rules:**

-   First item focused by default
-   Wrap at edges if loop: true
-   Skip disabled items
-   Sliders use Left/Right

---

## 13. Component Structure

```
src/ui/
├── screens/
│   ├── TitleScreen.jsx
│   ├── GameScreen.jsx
│   ├── SummaryScreen.jsx
│   ├── StatsScreen.jsx
│   ├── CollectionScreen.jsx
│   ├── HowToPlayScreen.jsx
│   ├── MultiplayerSetupScreen.jsx
│   ├── HostGameScreen.jsx
│   ├── JoinGameScreen.jsx
│   └── TwinSetupScreen.jsx
├── modals/
│   ├── PauseModal.jsx
│   ├── UpgradeModal.jsx
│   ├── CardRewardModal.jsx
│   ├── SettingsModal.jsx
│   └── LeaderboardModal.jsx
├── components/
│   ├── HUD.jsx
│   ├── HealthBar.jsx
│   ├── XPBar.jsx
│   ├── DashIndicator.jsx
│   ├── UpgradeCard.jsx
│   ├── CollectionCard.jsx
│   ├── NotificationToast.jsx
│   ├── Slider.jsx
│   └── Button.jsx
└── input/
    ├── useMenuNavigation.js
    ├── useGamepadInput.js
    └── VirtualSticks.jsx
```

---

## 14. Responsive Design

### 14.1 Breakpoints

| Breakpoint | Width      | Changes                 |
| ---------- | ---------- | ----------------------- |
| Desktop    | >1024px    | Full layout             |
| Tablet     | 768-1024px | Reduced padding         |
| Mobile     | <768px     | Stacked, larger buttons |

### 14.2 Mobile Adaptations

-   44px minimum tap targets
-   Collapsible season card
-   2-column collection grid
-   Full-width upgrade cards
-   Virtual sticks during gameplay

---

## 15. Animations

### 15.1 Transitions

| Transition   | Easing      | Duration |
| ------------ | ----------- | -------- |
| Screen fade  | ease-out    | 200ms    |
| Modal scale  | ease-out    | 150ms    |
| Card flip    | ease-in-out | 300ms    |
| Notification | ease-out    | 200ms    |

### 15.2 Micro-interactions

| Element      | Trigger | Animation   |
| ------------ | ------- | ----------- |
| Button hover | Enter   | Scale 1.02  |
| Button press | Click   | Scale 0.98  |
| Focus        | Nav     | Border glow |
| Card select  | Click   | Scale 1.05  |

---

## 16. Accessibility

### 16.1 Requirements

-   All elements keyboard focusable
-   Visible focus indicator (3px+)
-   4.5:1 contrast ratio minimum
-   ARIA labels for icons
-   Escape closes modals
-   No color-only information

### 16.2 Settings

-   High contrast mode
-   Reduced motion mode
-   Colorblind modes (deuteranopia, protanopia, tritanopia)
-   Screen shake toggle

---

## 17. Error States

| Error             | Message             | Action         |
| ----------------- | ------------------- | -------------- |
| Room not found    | "Invalid room code" | Clear input    |
| Connection failed | "Could not connect" | Retry button   |
| Disconnected      | "Connection lost"   | Reconnect/Quit |
| Save failed       | "Could not save"    | Retry          |

---

## 18. Persisted Settings

```javascript
{
  masterVolume: 0.75,
  musicVolume: 0.5,
  sfxVolume: 0.9,
  screenShake: true,
  damageNumbers: false,
  highContrast: false,
  reducedMotion: false,
  colorblindMode: 'none',
  inputMode: 'keyboardMouse'
}
```
