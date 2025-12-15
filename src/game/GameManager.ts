import Phaser from "phaser";
import { AFFIXES } from "../config/affixes";
import { BOSSES } from "../config/bosses";
import type {
    BossDefinition,
    RunMode,
    TwinControlConfig,
    WeeklyAffix,
} from "../models/types";
import { getWeeklySeed, hashSeed, Prng, pickFromList } from "../utils/seed";
import { createGameConfig } from "./GameConfig";
import { MainScene } from "./scenes/MainScene";

class GameManager {
    private game?: Phaser.Game;
    private mainScene?: MainScene;
    private currentAffix?: WeeklyAffix;
    private seasonSeedId?: string;
    private seasonSeedValue?: number;
    private seasonBoss?: BossDefinition;
    private lastTwinControls?: TwinControlConfig;

    init(containerId: string) {
        if (this.game) return;
        this.mainScene = new MainScene();
        const config = createGameConfig(containerId, [this.mainScene]);
        this.game = new Phaser.Game(config);
    }

    private ensureSeason(seedId?: string, forceRandom = false) {
        const weekly = getWeeklySeed();
        // Check if cached seed is stale (from a previous week)
        const cachedIsWeeklySeed = this.seasonSeedId?.startsWith("week-");
        const cachedIsCurrentWeek = this.seasonSeedId === weekly.seedId;
        const useCache = cachedIsWeeklySeed ? cachedIsCurrentWeek : true;

        const finalSeedId = forceRandom
            ? `random-${crypto.randomUUID()}`
            : seedId ?? (useCache ? this.seasonSeedId : null) ?? weekly.seedId;
        const seedValue = forceRandom
            ? (crypto.randomUUID().split("-")[0] ?? "1")
                  .split("")
                  .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
            : (seedId
                  ? hashSeed(seedId)
                  : (useCache ? this.seasonSeedValue : null) ??
                    weekly.seedValue) || 1;
        if (
            this.seasonSeedId === finalSeedId &&
            this.seasonSeedValue === seedValue &&
            this.currentAffix &&
            this.seasonBoss
        ) {
            return;
        }
        const affixRng = new Prng(seedValue ^ 0x9e3779b9);
        this.currentAffix = pickFromList(AFFIXES, affixRng);
        const bossRng = new Prng(seedValue);
        this.seasonBoss = BOSSES[bossRng.nextInt(BOSSES.length)] ?? BOSSES[0];
        this.seasonSeedId = finalSeedId;
        this.seasonSeedValue = seedValue;
    }

    startRun(
        seedId?: string,
        options?: {
            randomSeed?: boolean;
            mode?: RunMode;
            twinControls?: TwinControlConfig;
        }
    ) {
        if (!this.game) {
            this.init("game-root");
        }
        if (options?.twinControls) {
            this.lastTwinControls = options.twinControls;
        }
        this.ensureSeason(seedId, options?.randomSeed);
        if (!this.seasonSeedId || !this.seasonSeedValue) return;
        this.mainScene?.startNewRun(
            this.seasonSeedId,
            this.seasonSeedValue,
            this.currentAffix,
            this.seasonBoss,
            {
                mode: options?.mode,
                twinControls: options?.twinControls ?? this.lastTwinControls,
            }
        );
    }

    applyUpgrade(id: string) {
        if (!this.game) return;
        this.mainScene?.applyUpgrade(id);
    }

    setLowGraphicsMode(enabled: boolean) {
        if (!this.game) return;
        this.mainScene?.setLowGraphicsMode(enabled);
    }

    debugSetWave(waveNumber: number) {
        if (!this.game) return;
        this.mainScene?.debugSetWave(waveNumber);
    }

    pause() {
        if (!this.game) return;
        this.mainScene?.setPaused(true);
    }

    resume() {
        if (!this.game) return;
        this.mainScene?.setPaused(false);
    }

    getSeasonInfo() {
        this.ensureSeason();
        return {
            seedId: this.seasonSeedId,
            boss: this.seasonBoss,
            affix: this.currentAffix,
        };
    }
}

export const gameManager = new GameManager();
