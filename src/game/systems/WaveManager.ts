/**
 * Wave Manager - Handles wave configuration and difficulty scaling
 * Extracted from EnemySystem to improve modularity
 */

import { WAVES } from "../../config/waves";
import type { EnemySpawn, IWaveManager } from "./interfaces/EnemySystem";

export class WaveManager implements IWaveManager {
    loadWaveConfig(waveIndex: number): EnemySpawn[] {
        if (waveIndex >= WAVES.length) {
            // Infinite mode - generate procedural wave
            return this.generateInfiniteWave(waveIndex);
        }

        const wave = WAVES[waveIndex];
        return wave.enemies.map((enemy) => ({
            type: enemy.kind,
            count: enemy.count,
            spawnTime: 0,
            spawnDelay: 0,
        }));
    }

    calculateWaveDifficulty(waveIndex: number): number {
        const baseDifficulty = 1;
        const overflow =
            waveIndex >= WAVES.length ? waveIndex - (WAVES.length - 1) : 0;
        return baseDifficulty * (overflow > 0 ? 1 + overflow * 0.22 : 1);
    }

    getWaveDuration(waveIndex: number): number {
        // Base duration + scaling
        return 30000 + waveIndex * 5000; // 30s + 5s per wave
    }

    hasWave(waveIndex: number): boolean {
        return waveIndex >= 0; // Infinite waves supported
    }

    private generateInfiniteWave(waveIndex: number): EnemySpawn[] {
        const overflow = waveIndex - (WAVES.length - 1);
        const baseCount = 10 + overflow * 2;

        return [
            { type: "drifter", count: baseCount, spawnTime: 0, spawnDelay: 0 },
            {
                type: "watcher",
                count: Math.floor(baseCount * 0.6),
                spawnTime: 1000,
                spawnDelay: 0,
            },
            {
                type: "mass",
                count: Math.floor(baseCount * 0.3),
                spawnTime: 2000,
                spawnDelay: 0,
            },
        ];
    }
}
