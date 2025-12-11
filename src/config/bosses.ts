import type { BossDefinition } from "../models/types";

export const BOSSES: BossDefinition[] = [
  {
    id: "sentinel",
    name: "Sentinel Core",
    description: "Tracks the player and alternates beam spins with aimed bursts.",
    tuning: { healthMultiplier: 1, speedMultiplier: 1 },
    patterns: ["beam-spin", "aimed-burst", "ring-with-gap"],
  },
  {
    id: "swarm-core",
    name: "Swarm Core",
    description: "Spawns escorts, fires cone volleys, and drops radial pulses.",
    tuning: { healthMultiplier: 0.95, speedMultiplier: 1.05, fireRateMultiplier: 0.9 },
    patterns: ["summon-minions", "cone-volley", "pulse-ring"],
  },
  {
    id: "obelisk",
    name: "Obelisk",
    description: "Telegraphs slams, ricochets shards, and locks lanes with beams.",
    tuning: { healthMultiplier: 1.15, speedMultiplier: 0.9, projectileSpeedMultiplier: 1.15 },
    patterns: ["slam", "ricochet-shards", "lane-beams"],
  },
];
