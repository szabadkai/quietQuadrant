import type {
    CardCollection,
    LifetimeStats,
    PerSeedBest,
    RunSummary,
    Settings,
} from "../models/types";

export interface MetaStatePayload {
    schemaVersion: number;
    bestRun?: RunSummary;
    totalRuns: number;
    settings: Settings;
    bestRunsBySeed?: PerSeedBest;
    topRuns?: RunSummary[];
    lifetimeStats?: LifetimeStats;
    cardCollection?: CardCollection;
}

export interface PersistenceAdapter {
    loadMeta(): Promise<MetaStatePayload | null>;
    saveMeta(meta: MetaStatePayload): Promise<void>;
}
