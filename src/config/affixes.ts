import type { WeeklyAffix } from "../models/types";

export const AFFIXES: WeeklyAffix[] = [
  {
    id: "nimble-foes",
    name: "Nimble Foes",
    description: "+12% enemy speed, -10% enemy health.",
    enemySpeedMultiplier: 1.12,
    enemyHealthMultiplier: 0.9,
  },
  {
    id: "ironclad",
    name: "Ironclad",
    description: "+18% enemy health, -8% enemy speed.",
    enemyHealthMultiplier: 1.18,
    enemySpeedMultiplier: 0.92,
  },
  {
    id: "volatile-rare",
    name: "Volatile Finds",
    description: "+15% rare upgrade odds.",
    rareUpgradeBonus: 0.15,
  },
  {
    id: "glass-boost",
    name: "Glass Boost",
    description: "-12% enemy health, +10% enemy speed, +10% rare upgrade odds.",
    enemyHealthMultiplier: 0.88,
    enemySpeedMultiplier: 1.1,
    rareUpgradeBonus: 0.1,
  },
];
