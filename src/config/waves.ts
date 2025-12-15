import type { WaveDefinition } from "../models/types";

export const WAVES: WaveDefinition[] = [
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
	{
		id: "wave-4",
		enemies: [
			{ kind: "drifter", count: 10 },
			{ kind: "watcher", count: 4, elite: true },
		],
	},
	{
		id: "wave-5",
		enemies: [
			{ kind: "drifter", count: 12 },
			{ kind: "watcher", count: 5 },
			{ kind: "mass", count: 2 },
		],
	},
	{
		id: "wave-6",
		enemies: [
			{ kind: "drifter", count: 12, elite: true },
			{ kind: "watcher", count: 6 },
			{ kind: "mass", count: 3 },
		],
	},
	{
		id: "wave-7",
		enemies: [
			{ kind: "drifter", count: 14 },
			{ kind: "watcher", count: 7, elite: true },
			{ kind: "mass", count: 3 },
		],
	},
	{
		id: "wave-8",
		enemies: [
			{ kind: "drifter", count: 14, elite: true },
			{ kind: "watcher", count: 8 },
			{ kind: "mass", count: 4, elite: true },
		],
	},
	{
		id: "wave-9",
		enemies: [
			{ kind: "drifter", count: 16 },
			{ kind: "watcher", count: 8, elite: true },
			{ kind: "mass", count: 4 },
		],
	},
	{
		id: "wave-10",
		enemies: [
			{ kind: "drifter", count: 18, elite: true },
			{ kind: "watcher", count: 9, elite: true },
			{ kind: "mass", count: 5 },
		],
	},
	{ id: "boss", enemies: [{ kind: "boss", count: 1 }] },
];

export const FINAL_WAVE_INDEX = WAVES.length;
