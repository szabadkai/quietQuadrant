import type { RunSummary, UpgradeDefinition } from "../models/types";

export type LevelUpEvent = {
    options: UpgradeDefinition[];
};

export type RunEndedEvent = RunSummary;

export type BossPhaseEvent = {
    phase: number;
};

// Simple EventEmitter implementation for testing
class SimpleEventEmitter {
    private listeners = new Map<string, Function[]>();

    emit(event: string, data?: any): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((listener) => listener(data));
        }
    }

    on(event: string, listener: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    off(event: string, listener: Function): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        }
    }
}

export const gameEvents = new SimpleEventEmitter();

export const GAME_EVENT_KEYS = {
    runStarted: "run-started",
    runEnded: "run-ended",
    waveStarted: "wave-started",
    levelUp: "level-up",
    bossPhaseChanged: "boss-phase-changed",
    synergyActivated: "synergy-activated",
} as const;
