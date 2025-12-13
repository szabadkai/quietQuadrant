import { create } from "zustand";
import type { RunSummary, UpgradeInstance } from "../models/types";

export type RunStatus = "idle" | "running" | "paused" | "ended";

interface RunState {
  runId: string | null;
  status: RunStatus;
  currentWave: number;
  elapsedTime: number;
  currentUpgrades: UpgradeInstance[];
  enemiesDestroyed: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerLevel: number;
  xp: number;
  xpThreshold: number;
  seedId: string | null;
  intermissionCountdown: number | null;
  upcomingWave: number | null;
  achievedSynergies: string[];
  lastRunSummary?: RunSummary;
  actions: {
    startRun: (seedId: string) => void;
    endRun: (summary: RunSummary) => void;
    setWave: (wave: number) => void;
    addUpgrade: (upgrade: UpgradeInstance) => void;
    unlockSynergy: (synergyId: string) => void;
    setStatus: (status: RunStatus) => void;
    tick: (deltaSeconds: number) => void;
    recordKill: () => void;
    setVitals: (health: number, maxHealth: number) => void;
    setXp: (level: number, xp: number, xpThreshold: number) => void;
    setWaveCountdown: (countdown: number | null, upcomingWave?: number | null) => void;
    reset: () => void;
  };
}

const defaultState = (): Omit<RunState, "actions"> => ({
  runId: null,
  status: "idle",
  currentWave: 1,
  elapsedTime: 0,
  currentUpgrades: [],
  enemiesDestroyed: 0,
  playerHealth: 0,
  playerMaxHealth: 0,
  playerLevel: 1,
  xp: 0,
  xpThreshold: 12,
  seedId: null,
  intermissionCountdown: null,
  upcomingWave: null,
  achievedSynergies: [],
});

export const useRunStore = create<RunState>()((set, _get) => ({
  ...defaultState(),
  actions: {
    startRun: (seedId) =>
      set((state) => ({
        ...state,
        ...defaultState(),
        runId: crypto.randomUUID(),
        status: "running",
        seedId,
        achievedSynergies: [],
      })),
    endRun: (summary) =>
      set((state) => ({
        ...state,
        status: "ended",
        runId: null,
        lastRunSummary: summary,
      })),
    setWave: (wave) => set(() => ({ currentWave: wave })),
    addUpgrade: (upgrade) =>
      set((state) => {
        const existing = state.currentUpgrades.find((u) => u.id === upgrade.id);
        if (existing) {
          return {
            currentUpgrades: state.currentUpgrades.map((u) =>
              u.id === upgrade.id ? { ...u, stacks: upgrade.stacks } : u
            ),
          };
        }
        return { currentUpgrades: [...state.currentUpgrades, upgrade] };
      }),
    unlockSynergy: (synergyId) =>
      set((state) =>
        state.achievedSynergies.includes(synergyId)
          ? state
          : { achievedSynergies: [...state.achievedSynergies, synergyId] }
      ),
    setStatus: (status) => set(() => ({ status })),
    tick: (deltaSeconds) =>
      set((state) => ({ elapsedTime: state.elapsedTime + deltaSeconds })),
    recordKill: () =>
      set((state) => ({ enemiesDestroyed: state.enemiesDestroyed + 1 })),
    setVitals: (health, maxHealth) =>
      set(() => ({ playerHealth: health, playerMaxHealth: maxHealth })),
    setXp: (level, xp, xpThreshold) =>
      set(() => ({ playerLevel: level, xp, xpThreshold })),
    setWaveCountdown: (countdown, upcomingWave) =>
      set((state) => ({
        intermissionCountdown: countdown,
        upcomingWave:
          upcomingWave === undefined ? state.upcomingWave : upcomingWave,
      })),
    reset: () =>
      set((state) => ({
        ...state,
        ...defaultState(),
      })),
  },
}));
