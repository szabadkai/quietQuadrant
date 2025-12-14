import type { MetaStatePayload, PersistenceAdapter } from './PersistenceAdapter';

const STORAGE_KEY = 'quiet-quadrant:meta:v1';

export class LocalStorageAdapter implements PersistenceAdapter {
  async loadMeta(): Promise<MetaStatePayload | null> {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MetaStatePayload;
      if (parsed.schemaVersion !== 1) return null;
      return parsed;
    } catch (err) {
      console.warn('Failed to load meta from localStorage', err);
      return null;
    }
  }

  async saveMeta(meta: MetaStatePayload): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch (err) {
      console.warn('Failed to save meta to localStorage', err);
    }
  }
}
