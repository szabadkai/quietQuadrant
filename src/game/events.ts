import Phaser from "phaser";
import type { RunSummary, UpgradeDefinition } from "../models/types";

export type LevelUpEvent = {
  options: UpgradeDefinition[];
};

export type RunEndedEvent = RunSummary;

export type BossPhaseEvent = {
  phase: number;
};

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT_KEYS = {
  runStarted: "run-started",
  runEnded: "run-ended",
  waveStarted: "wave-started",
  levelUp: "level-up",
  bossPhaseChanged: "boss-phase-changed",
} as const;
