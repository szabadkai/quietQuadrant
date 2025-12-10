export type Rarity = "common" | "rare";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  maxStacks?: number;
  category: "offense" | "defense" | "utility";
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
}

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
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
