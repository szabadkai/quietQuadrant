import type { BossDefinition } from "../models/types";

export const BOSSES: BossDefinition[] = [
	{
		id: "sentinel",
		name: "Sentinel Core",
		description:
			"Tracks the player and alternates beam spins with aimed bursts.",
		tuning: { 
			healthMultiplier: 2.5, // Increased from 1 to 2.5 (3750 health)
			speedMultiplier: 1.2, // Slightly increased for more aggressive movement
			fireRateMultiplier: 1.1 // Slightly faster firing
		},
		patterns: ["beam-spin", "aimed-burst", "ring-with-gap"],
	},
	{
		id: "swarm-core",
		name: "Swarm Core",
		description: "Spawns escorts, fires cone volleys, and drops radial pulses.",
		tuning: {
			healthMultiplier: 2.4, // Increased from 0.95 to 2.4 (3600 health)
			speedMultiplier: 1.25, // Increased from 1.05 to 1.25
			fireRateMultiplier: 1.2, // Increased from 0.9 to 1.2
		},
		patterns: ["summon-minions", "cone-volley", "pulse-ring"],
	},
	{
		id: "obelisk",
		name: "Obelisk",
		description:
			"Telegraphs slams, ricochets shards, and locks lanes with beams.",
		tuning: {
			healthMultiplier: 2.6, // Increased from 1.15 to 2.6 (3900 health)
			speedMultiplier: 1.1, // Increased from 0.9 to 1.1
			projectileSpeedMultiplier: 1.3, // Increased from 1.15 to 1.3
			fireRateMultiplier: 1.15 // Added faster firing
		},
		patterns: ["slam", "ricochet-shards", "lane-beams"],
	},
];
