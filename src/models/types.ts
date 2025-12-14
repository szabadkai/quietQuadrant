export type Rarity = "common" | "rare" | "legendary";

export type UpgradeTuning = Record<string, number>;

export type RunMode = "standard" | "infinite";

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
}

export type EnemyKind = "drifter" | "watcher" | "mass" | "boss";

export interface EnemyDefinition {
  kind: EnemyKind;
  speed: number;
  health: number;
  damage: number;
  fireCooldown?: number;
  projectileSpeed?: number;
  elite?: boolean;
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
  enemyHealthMultiplier?: number;
  enemySpeedMultiplier?: number;
  rareUpgradeBonus?: number;
}

export type PerSeedBest = Record<string, RunSummary>;
