export type Rarity = "common" | "rare" | "legendary";

export type UpgradeTuning = Record<string, number>;

export type RunMode = "standard" | "infinite" | "twin" | "online";

export type InputMode = "keyboardMouse" | "controller";

export type ControlBinding =
    | { type: "keyboardMouse"; label?: string }
    | { type: "gamepad"; id?: string; index?: number; label?: string }
    | { type: "remote"; peerId?: string; label?: string };

export type TwinControlConfig = {
    p1: ControlBinding;
    p2: ControlBinding;
};

export interface UpgradeDefinition {
    id: string;
    name: string;
    description: string;
    rarity: Rarity;
    maxStacks?: number;
    category: "offense" | "defense" | "utility";
    tags?: string[];
    synergy?: string;
    tuning?: UpgradeTuning;
    stackingNotes?: string;
    dropWeight?: number;
}

export interface SynergyDefinition {
    id: string;
    name: string;
    description: string;
    requires: string[];
}

export interface UpgradeInstance {
    id: string;
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
    seedId: string;
    bossId?: string;
    affixId?: string;
    synergies?: string[];
    mode?: RunMode;
}

export interface Settings {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muteAll: boolean;
    muteMusic: boolean;
    lowGraphicsMode: boolean;
    difficultyMultiplier: number;
    inputMode: InputMode;
}

export type EnemyKind = "drifter" | "watcher" | "mass" | "boss";

export type EliteBehavior =
    | "burst_movement"
    | "rapid_fire"
    | "shield_regen"
    | "death_explosion";

export interface EnemyDefinition {
    kind: EnemyKind;
    speed: number;
    health: number;
    damage: number;
    fireCooldown?: number;
    projectileSpeed?: number;
    elite?: boolean;
    eliteBehaviors?: EliteBehavior[];
}

export interface WaveDefinition {
    id: string;
    enemies: EnemySpawn[];
}

export interface EnemySpawn {
    kind: EnemyKind;
    count: number;
    elite?: boolean;
}

export interface UpgradeOption {
    definition: UpgradeDefinition;
    stacks: number;
}

export interface BossDefinition {
    id: string;
    name: string;
    description: string;
    tuning: {
        healthMultiplier?: number;
        speedMultiplier?: number;
        fireRateMultiplier?: number;
        projectileSpeedMultiplier?: number;
    };
    patterns: string[];
}

export interface WeeklyAffix {
    id: string;
    name: string;
    description: string;
    // Enemy modifiers
    enemyHealthMultiplier?: number;
    enemySpeedMultiplier?: number;
    enemyDamageMultiplier?: number;
    enemyProjectileSpeedMultiplier?: number;
    // Player modifiers
    playerDamageMultiplier?: number;
    playerSpeedMultiplier?: number;
    dashCooldownMultiplier?: number;
    // XP and upgrades
    xpMultiplier?: number;
    rareUpgradeBonus?: number;
    legendaryUpgradeBonus?: number;
    upgradeChoices?: number; // Override default 3 choices
    // Wave modifiers
    waveEnemyCountMultiplier?: number;
    eliteChanceBonus?: number; // Extra chance for elites to spawn
    // Boss modifiers
    bossHealthMultiplier?: number;
    bossProjectileSpeedMultiplier?: number;
}

export type PerSeedBest = Record<string, RunSummary>;
