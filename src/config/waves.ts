import type { WaveDefinition } from "../models/types";

export const WAVES: WaveDefinition[] = [
    // Early waves (1-4): Easy introduction with gentler ramp
    { id: "wave-1", enemies: [{ kind: "drifter", count: 4 }] },
    {
        id: "wave-2",
        enemies: [
            { kind: "drifter", count: 5 },
            { kind: "watcher", count: 1 },
        ],
    },
    {
        id: "wave-3",
        enemies: [
            { kind: "drifter", count: 6 },
            { kind: "watcher", count: 2 },
        ],
    },
    {
        id: "wave-4",
        enemies: [
            { kind: "drifter", count: 7 },
            { kind: "watcher", count: 2 },
            { kind: "mass", count: 1 },
        ],
    },

    // Mid-game waves (5-7): Gradual ramp up
    {
        id: "wave-5",
        enemies: [
            { kind: "drifter", count: 8 },
            { kind: "watcher", count: 3 },
            { kind: "mass", count: 1 },
        ],
    },
    {
        id: "wave-6",
        enemies: [
            { kind: "drifter", count: 9 },
            { kind: "watcher", count: 3, elite: true },
            { kind: "mass", count: 2 },
        ],
    },
    {
        id: "wave-7",
        enemies: [
            { kind: "drifter", count: 10 },
            { kind: "watcher", count: 4, elite: true },
            { kind: "mass", count: 2 },
        ],
    },

    // Late waves (8-10): Challenge waves but more manageable
    {
        id: "wave-8",
        enemies: [
            { kind: "drifter", count: 11 },
            { kind: "watcher", count: 4, elite: true },
            { kind: "mass", count: 3 },
        ],
    },
    {
        id: "wave-9",
        enemies: [
            { kind: "drifter", count: 12, elite: true },
            { kind: "watcher", count: 5, elite: true },
            { kind: "mass", count: 3 },
        ],
    },
    {
        id: "wave-10",
        enemies: [
            { kind: "drifter", count: 14, elite: true },
            { kind: "watcher", count: 6, elite: true },
            { kind: "mass", count: 4, elite: true },
        ],
    },
    { id: "boss", enemies: [{ kind: "boss", count: 1 }] },
];

export const FINAL_WAVE_INDEX = WAVES.length;
