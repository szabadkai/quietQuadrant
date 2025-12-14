import Phaser from "phaser";
import { createGameConfig } from "./GameConfig";
import { MainScene } from "./scenes/MainScene";
import { getWeeklySeed, hashSeed, Prng, pickFromList } from "../utils/seed";
import { AFFIXES } from "../config/affixes";
import { BOSSES } from "../config/bosses";
import type { BossDefinition, RunMode, WeeklyAffix } from "../models/types";

class GameManager {
  private game?: Phaser.Game;
  private mainScene?: MainScene;
  private currentAffix?: WeeklyAffix;
  private seasonSeedId?: string;
  private seasonSeedValue?: number;
  private seasonBoss?: BossDefinition;

  init(containerId: string) {
    if (this.game) return;
    this.mainScene = new MainScene();
    const config = createGameConfig(containerId, [this.mainScene]);
    this.game = new Phaser.Game(config);
  }

  private ensureSeason(seedId?: string, forceRandom = false) {
    const weekly = getWeeklySeed();
    const finalSeedId = forceRandom
      ? `random-${crypto.randomUUID()}`
      : seedId ?? this.seasonSeedId ?? weekly.seedId;
    const seedValue = forceRandom
      ? (crypto.randomUUID().split("-")[0] ?? "1").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      : (seedId ? hashSeed(seedId) : this.seasonSeedValue ?? weekly.seedValue) || 1;
    if (this.seasonSeedId === finalSeedId && this.seasonSeedValue === seedValue && this.currentAffix && this.seasonBoss) {
      return;
    }
    const affixRng = new Prng(seedValue ^ 0x9e3779b9);
    this.currentAffix = pickFromList(AFFIXES, affixRng);
    const bossRng = new Prng(seedValue);
    this.seasonBoss = BOSSES[bossRng.nextInt(BOSSES.length)] ?? BOSSES[0];
    this.seasonSeedId = finalSeedId;
    this.seasonSeedValue = seedValue;
  }

  startRun(seedId?: string, options?: { randomSeed?: boolean; mode?: RunMode }) {
    if (!this.game) {
      this.init("game-root");
    }
    this.ensureSeason(seedId, options?.randomSeed);
    if (!this.seasonSeedId || !this.seasonSeedValue) return;
    this.mainScene?.startNewRun(
      this.seasonSeedId,
      this.seasonSeedValue,
      this.currentAffix,
      this.seasonBoss,
      { mode: options?.mode }
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
