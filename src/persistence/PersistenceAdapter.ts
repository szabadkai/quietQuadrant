import type { RunSummary, Settings } from "../models/types";

export interface MetaStatePayload {
  schemaVersion: number;
  bestRun?: RunSummary;
  totalRuns: number;
  settings: Settings;
}

export interface PersistenceAdapter {
  loadMeta(): Promise<MetaStatePayload | null>;
  saveMeta(meta: MetaStatePayload): Promise<void>;
}
