import { create } from "zustand";
import type { RunSummary, Settings } from "../models/types";
import { LocalStorageAdapter } from "../persistence/LocalStorageAdapter";
import type { MetaStatePayload } from "../persistence/PersistenceAdapter";

const adapter = new LocalStorageAdapter();

const defaultSettings: Settings = {
  masterVolume: 0.6,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  lowGraphicsMode: false,
  difficultyMultiplier: 1,
};

interface MetaState {
  bestRun?: RunSummary;
  totalRuns: number;
  settings: Settings;
  isHydrated: boolean;
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
  actions: {
    hydrateFromPersistence: async () => {
      const payload = await adapter.loadMeta();
      const settings = {
        ...defaultSettings,
        ...(payload?.settings ?? {}),
      };
      if (!payload) {
        set(() => ({ isHydrated: true, settings }));
        return;
      }
      set(() => ({
        bestRun: payload.bestRun,
        totalRuns: payload.totalRuns,
        settings,
        isHydrated: true,
      }));
    },
    recordRun: async (summary) => {
      const state = get();
      const bestRun =
        !state.bestRun || summary.wavesCleared > state.bestRun.wavesCleared
          ? summary
          : state.bestRun;
      const meta: MetaStatePayload = {
        schemaVersion: 1,
        bestRun,
        totalRuns: state.totalRuns + 1,
        settings: state.settings,
      };
      await adapter.saveMeta(meta);
      set(() => ({
        bestRun,
        totalRuns: meta.totalRuns,
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
