import type { WaveDefinition } from "../models/types";

export const WAVES: WaveDefinition[] = [
	// Early waves (1-3): Gradual introduction, minimal elite presence
	{ id: "wave-1", enemies: [{ kind: "drifter", count: 6 }] },
	{
		id: "wave-2",
		enemies: [
			{ kind: "drifter", count: 8 },
			{ kind: "watcher", count: 2 },
		],
	},
	{
		id: "wave-3",
		enemies: [
			{ kind: "drifter", count: 10 },
			{ kind: "watcher", count: 3 },
		],
	},
	
	// Mid-game waves (4-7): Increased counts and elite frequency to challenge upgrade builds
	{
		id: "wave-4",
		enemies: [
			{ kind: "drifter", count: 12 },
			{ kind: "watcher", count: 5, elite: true },
		],
	},
	{
		id: "wave-5",
		enemies: [
			{ kind: "drifter", count: 15 },
			{ kind: "watcher", count: 6 },
			{ kind: "mass", count: 3 },
		],
	},
	{
		id: "wave-6",
		enemies: [
			{ kind: "drifter", count: 16, elite: true },
			{ kind: "watcher", count: 7, elite: true },
			{ kind: "mass", count: 4 },
		],
	},
	{
		id: "wave-7",
		enemies: [
			{ kind: "drifter", count: 18 },
			{ kind: "watcher", count: 8, elite: true },
			{ kind: "mass", count: 5, elite: true },
		],
	},
	
	// Late waves (8-10): High elite frequency and counts to challenge optimized builds
	{
		id: "wave-8",
		enemies: [
			{ kind: "drifter", count: 20, elite: true },
			{ kind: "watcher", count: 10, elite: true },
			{ kind: "mass", count: 6 },
		],
	},
	{
		id: "wave-9",
		enemies: [
			{ kind: "drifter", count: 22, elite: true },
			{ kind: "watcher", count: 11, elite: true },
			{ kind: "mass", count: 7, elite: true },
		],
	},
	{
		id: "wave-10",
		enemies: [
			{ kind: "drifter", count: 24, elite: true },
			{ kind: "watcher", count: 12, elite: true },
			{ kind: "mass", count: 8, elite: true },
		],
	},
	{ id: "boss", enemies: [{ kind: "boss", count: 1 }] },
];

export const FINAL_WAVE_INDEX = WAVES.length;
