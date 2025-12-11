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
};

interface MetaState {
  bestRun?: RunSummary;
  totalRuns: number;
  settings: Settings;
  isHydrated: boolean;
  bestRunsBySeed: PerSeedBest;
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
      if (!payload) {
        set(() => ({ isHydrated: true, settings, bestRunsBySeed }));
        return;
      }
      set(() => ({
        bestRun,
        totalRuns: payload.totalRuns,
        settings,
        isHydrated: true,
        bestRunsBySeed,
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
      const meta: MetaStatePayload = {
        schemaVersion: 1,
        bestRun,
        totalRuns: state.totalRuns + 1,
        settings: state.settings,
        bestRunsBySeed,
      };
      await adapter.saveMeta(meta);
      set(() => ({
        bestRun,
        totalRuns: meta.totalRuns,
        bestRunsBySeed,
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
      };
      await adapter.saveMeta(meta);
      set(() => ({ settings }));
    },
  },
}));
