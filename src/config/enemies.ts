import type { EnemyDefinition, EnemyKind } from "../models/types";

const base: Record<EnemyKind, EnemyDefinition> = {
  drifter: {
    kind: "drifter",
    speed: 110,
    health: 18,
    damage: 10,
  },
  watcher: {
    kind: "watcher",
    speed: 70,
    health: 28,
    damage: 12,
    fireCooldown: 1.6,
    projectileSpeed: 160,
  },
  mass: {
    kind: "mass",
    speed: 45,
    health: 70,
    damage: 25,
    fireCooldown: 2.6,
    projectileSpeed: 120,
  },
  boss: {
    kind: "boss",
    speed: 50,
    health: 1200,
    damage: 25,
    fireCooldown: 1.2,
    projectileSpeed: 200,
  },
};

export const eliteMultipliers = {
  health: 1.5,
  speed: 1.2,
};

export const getEnemyDefinition = (
  kind: EnemyKind,
  elite?: boolean
): EnemyDefinition => {
  const data = { ...base[kind] };
  if (elite) {
    data.health *= eliteMultipliers.health;
    data.speed *= eliteMultipliers.speed;
    data.elite = true;
  }
  return data;
};
