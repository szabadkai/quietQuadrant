import type { WaveDefinition } from "../models/types";

export const WAVES: WaveDefinition[] = [
    // Early waves (1-3): Easy introduction
    { id: "wave-1", enemies: [{ kind: "drifter", count: 5 }] },
    {
        id: "wave-2",
        enemies: [
            { kind: "drifter", count: 6 },
            { kind: "watcher", count: 2 },
        ],
    },
    {
        id: "wave-3",
        enemies: [
            { kind: "drifter", count: 8 },
            { kind: "watcher", count: 3 },
        ],
    },

    // Mid-game waves (4-7): Gradual ramp up
    {
        id: "wave-4",
        enemies: [
            { kind: "drifter", count: 8 },
            { kind: "watcher", count: 3 },
            { kind: "mass", count: 1 },
        ],
    },
    {
        id: "wave-5",
        enemies: [
            { kind: "drifter", count: 10 },
            { kind: "watcher", count: 4 },
            { kind: "mass", count: 2 },
        ],
    },
    {
        id: "wave-6",
        enemies: [
            { kind: "drifter", count: 10 },
            { kind: "watcher", count: 5, elite: true },
            { kind: "mass", count: 2 },
        ],
    },
    {
        id: "wave-7",
        enemies: [
            { kind: "drifter", count: 12 },
            { kind: "watcher", count: 5, elite: true },
            { kind: "mass", count: 3 },
        ],
    },

    // Late waves (8-10): Challenge waves
    {
        id: "wave-8",
        enemies: [
            { kind: "drifter", count: 14 },
            { kind: "watcher", count: 6, elite: true },
            { kind: "mass", count: 4 },
        ],
    },
    {
        id: "wave-9",
        enemies: [
            { kind: "drifter", count: 16, elite: true },
            { kind: "watcher", count: 7, elite: true },
            { kind: "mass", count: 5 },
        ],
    },
    {
        id: "wave-10",
        enemies: [
            { kind: "drifter", count: 18, elite: true },
            { kind: "watcher", count: 8, elite: true },
            { kind: "mass", count: 6, elite: true },
        ],
    },
    { id: "boss", enemies: [{ kind: "boss", count: 1 }] },
];

export const FINAL_WAVE_INDEX = WAVES.length;
