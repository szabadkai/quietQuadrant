import { create } from "zustand";
import type { PerSeedBest, RunSummary, Settings } from "../models/types";
import { LocalStorageAdapter } from "../persistence/LocalStorageAdapter";
import type { MetaStatePayload } from "../persistence/PersistenceAdapter";

const adapter = new LocalStorageAdapter();

const defaultSettings: Settings = {
  masterVolume: 0.6,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muteAll: false,
  muteMusic: false,
  lowGraphicsMode: false,
  difficultyMultiplier: 1,
  inputMode: "keyboardMouse",
};

interface MetaState {
  bestRun?: RunSummary;
  totalRuns: number;
  settings: Settings;
  isHydrated: boolean;
  bestRunsBySeed: PerSeedBest;
   topRuns: RunSummary[];
  actions: {
    hydrateFromPersistence: () => Promise<void>;
    recordRun: (summary: RunSummary) => Promise<void>;
    updateSettings: (patch: Partial<Settings>) => Promise<void>;
  };
}

export const useMetaStore = create<MetaState>()((set, get) => ({
  totalRuns: 0,
  settings: defaultSettings,
  isHydrated: false,
  bestRunsBySeed: {},
  topRuns: [],
  actions: {
    hydrateFromPersistence: async () => {
      const payload = await adapter.loadMeta();
      const settings = {
        ...defaultSettings,
        ...(payload?.settings ?? {}),
      };
      const bestRun = payload?.bestRun
        ? { ...payload.bestRun, seedId: payload.bestRun.seedId ?? "legacy" }
        : undefined;
      const bestRunsBySeed = payload?.bestRunsBySeed ?? {};
      const topRuns = payload?.topRuns ?? [];
      if (!payload) {
        set(() => ({ isHydrated: true, settings, bestRunsBySeed, topRuns }));
        return;
      }
      set(() => ({
        bestRun,
        totalRuns: payload.totalRuns,
        settings,
        isHydrated: true,
        bestRunsBySeed,
        topRuns,
      }));
    },
    recordRun: async (summary) => {
      const state = get();
      const bestRun =
        !state.bestRun || summary.wavesCleared > state.bestRun.wavesCleared
          ? summary
          : state.bestRun;
      const currentSeedBest = state.bestRunsBySeed[summary.seedId];
      const betterSeedRun =
        !currentSeedBest || summary.wavesCleared > currentSeedBest.wavesCleared
          ? summary
          : currentSeedBest;
      const bestRunsBySeed = {
        ...state.bestRunsBySeed,
        [summary.seedId]: betterSeedRun,
      };
      const topRuns = [...state.topRuns.filter((r) => r.runId !== summary.runId), summary]
        .sort((a, b) => {
          if (b.wavesCleared !== a.wavesCleared) return b.wavesCleared - a.wavesCleared;
          return a.durationSeconds - b.durationSeconds;
        })
        .slice(0, 20);
      const meta: MetaStatePayload = {
        schemaVersion: 1,
        bestRun,
        totalRuns: state.totalRuns + 1,
        settings: state.settings,
        bestRunsBySeed,
        topRuns,
      };
      await adapter.saveMeta(meta);
      set(() => ({
        bestRun,
        totalRuns: meta.totalRuns,
        bestRunsBySeed,
        topRuns,
      }));
    },
    updateSettings: async (patch) => {
      const state = get();
      const settings = { ...state.settings, ...patch };
      const meta: MetaStatePayload = {
        schemaVersion: 1,
        bestRun: state.bestRun,
        totalRuns: state.totalRuns,
        settings,
        bestRunsBySeed: state.bestRunsBySeed,
        topRuns: state.topRuns,
      };
      await adapter.saveMeta(meta);
      set(() => ({ settings }));
    },
  },
}));
