import { create } from "zustand";
import type {
    LifetimeStats,
    PerSeedBest,
    RunSummary,
    Settings,
} from "../models/types";
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

const defaultLifetimeStats: LifetimeStats = {
    totalRuns: 0,
    totalPlaytimeSeconds: 0,
    totalEnemiesDestroyed: 0,
    totalWavesCleared: 0,
    totalBossesDefeated: 0,
    totalVictories: 0,
    totalDeaths: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentDailyStreak: 0,
    bestDailyStreak: 0,
    lastPlayedDate: "",
    highestWave: 0,
    fastestVictorySeconds: Infinity,
    mostEnemiesInRun: 0,
    mostUpgradesInRun: 0,
    upgradePickCounts: {},
    synergyUnlockCounts: {},
    bossKillCounts: {},
    bossEncounterCounts: {},
    affixPlayCounts: {},
    affixWinCounts: {},
    modePlayCounts: {},
    modeWinCounts: {},
};

function getTodayDateString(): string {
    return new Date().toISOString().split("T")[0];
}

type StreakUpdateResult = {
    stats: LifetimeStats;
    showPopup: boolean;
    isNewStreak: boolean;
    previousStreak: number;
};

function updateDailyStreak(stats: LifetimeStats): StreakUpdateResult {
    const today = getTodayDateString();
    const lastPlayed = stats.lastPlayedDate;

    if (!lastPlayed) {
        // First time playing - don't show popup for day 1
        return {
            stats: {
                ...stats,
                currentDailyStreak: 1,
                bestDailyStreak: Math.max(1, stats.bestDailyStreak),
                lastPlayedDate: today,
            },
            showPopup: false,
            isNewStreak: true,
            previousStreak: 0,
        };
    }

    if (lastPlayed === today) {
        // Already played today, no change
        return {
            stats,
            showPopup: false,
            isNewStreak: false,
            previousStreak: stats.currentDailyStreak,
        };
    }

    const lastDate = new Date(lastPlayed);
    const todayDate = new Date(today);
    const diffDays = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
        // Consecutive day
        const newStreak = stats.currentDailyStreak + 1;
        return {
            stats: {
                ...stats,
                currentDailyStreak: newStreak,
                bestDailyStreak: Math.max(newStreak, stats.bestDailyStreak),
                lastPlayedDate: today,
            },
            showPopup: true, // Show popup for day 2+
            isNewStreak: false,
            previousStreak: stats.currentDailyStreak,
        };
    } else {
        // Streak broken - reset to 1, don't show popup
        return {
            stats: {
                ...stats,
                currentDailyStreak: 1,
                lastPlayedDate: today,
            },
            showPopup: false,
            isNewStreak: true,
            previousStreak: stats.currentDailyStreak,
        };
    }
}

function accumulateStats(
    current: LifetimeStats,
    run: RunSummary
): LifetimeStats {
    const isVictory = run.bossDefeated && run.mode !== "infinite";
    const mode = run.mode ?? "standard";
    const totalUpgrades = run.upgrades.reduce((sum, u) => sum + u.stacks, 0);

    // Update win streak
    let newWinStreak = current.currentWinStreak;
    if (isVictory) {
        newWinStreak = current.currentWinStreak + 1;
    } else {
        newWinStreak = 0;
    }

    // Update upgrade pick counts
    const upgradePickCounts = { ...current.upgradePickCounts };
    for (const upgrade of run.upgrades) {
        upgradePickCounts[upgrade.id] =
            (upgradePickCounts[upgrade.id] ?? 0) + upgrade.stacks;
    }

    // Update synergy counts
    const synergyUnlockCounts = { ...current.synergyUnlockCounts };
    for (const synergy of run.synergies ?? []) {
        synergyUnlockCounts[synergy] = (synergyUnlockCounts[synergy] ?? 0) + 1;
    }

    // Update boss counts
    const bossEncounterCounts = { ...current.bossEncounterCounts };
    const bossKillCounts = { ...current.bossKillCounts };
    if (run.bossId) {
        bossEncounterCounts[run.bossId] =
            (bossEncounterCounts[run.bossId] ?? 0) + 1;
        if (run.bossDefeated) {
            bossKillCounts[run.bossId] = (bossKillCounts[run.bossId] ?? 0) + 1;
        }
    }

    // Update affix counts
    const affixPlayCounts = { ...current.affixPlayCounts };
    const affixWinCounts = { ...current.affixWinCounts };
    if (run.affixId) {
        affixPlayCounts[run.affixId] = (affixPlayCounts[run.affixId] ?? 0) + 1;
        if (isVictory) {
            affixWinCounts[run.affixId] =
                (affixWinCounts[run.affixId] ?? 0) + 1;
        }
    }

    // Update mode counts
    const modePlayCounts = { ...current.modePlayCounts };
    const modeWinCounts = { ...current.modeWinCounts };
    modePlayCounts[mode] = (modePlayCounts[mode] ?? 0) + 1;
    if (isVictory) {
        modeWinCounts[mode] = (modeWinCounts[mode] ?? 0) + 1;
    }

    return {
        totalRuns: current.totalRuns + 1,
        totalPlaytimeSeconds:
            current.totalPlaytimeSeconds + run.durationSeconds,
        totalEnemiesDestroyed:
            current.totalEnemiesDestroyed + run.enemiesDestroyed,
        totalWavesCleared: current.totalWavesCleared + run.wavesCleared,
        totalBossesDefeated:
            current.totalBossesDefeated + (run.bossDefeated ? 1 : 0),
        totalVictories: current.totalVictories + (isVictory ? 1 : 0),
        totalDeaths: current.totalDeaths + (isVictory ? 0 : 1),
        currentWinStreak: newWinStreak,
        bestWinStreak: Math.max(newWinStreak, current.bestWinStreak),
        currentDailyStreak: current.currentDailyStreak,
        bestDailyStreak: current.bestDailyStreak,
        lastPlayedDate: current.lastPlayedDate,
        highestWave: Math.max(run.wavesCleared, current.highestWave),
        fastestVictorySeconds: isVictory
            ? Math.min(run.durationSeconds, current.fastestVictorySeconds)
            : current.fastestVictorySeconds,
        mostEnemiesInRun: Math.max(
            run.enemiesDestroyed,
            current.mostEnemiesInRun
        ),
        mostUpgradesInRun: Math.max(totalUpgrades, current.mostUpgradesInRun),
        upgradePickCounts,
        synergyUnlockCounts,
        bossKillCounts,
        bossEncounterCounts,
        affixPlayCounts,
        affixWinCounts,
        modePlayCounts,
        modeWinCounts,
    };
}

interface MetaState {
    bestRun?: RunSummary;
    totalRuns: number;
    settings: Settings;
    isHydrated: boolean;
    bestRunsBySeed: PerSeedBest;
    topRuns: RunSummary[];
    lifetimeStats: LifetimeStats;
    streakPopup: {
        show: boolean;
        streak: number;
        isNewStreak: boolean;
        previousStreak: number;
    };
    achievementPopup: {
        show: boolean;
        synergyId: string;
        synergyName: string;
        synergyDescription: string;
    };
    actions: {
        hydrateFromPersistence: () => Promise<void>;
        recordRun: (summary: RunSummary) => Promise<void>;
        updateSettings: (patch: Partial<Settings>) => Promise<void>;
        dismissStreakPopup: () => void;
        showAchievement: (
            synergyId: string,
            name: string,
            description: string
        ) => void;
        dismissAchievementPopup: () => void;
    };
}

export const useMetaStore = create<MetaState>()((set, get) => ({
    totalRuns: 0,
    settings: defaultSettings,
    isHydrated: false,
    bestRunsBySeed: {},
    topRuns: [],
    lifetimeStats: defaultLifetimeStats,
    streakPopup: {
        show: false,
        streak: 0,
        isNewStreak: false,
        previousStreak: 0,
    },
    achievementPopup: {
        show: false,
        synergyId: "",
        synergyName: "",
        synergyDescription: "",
    },
    actions: {
        hydrateFromPersistence: async () => {
            const payload = await adapter.loadMeta();
            const settings = {
                ...defaultSettings,
                ...(payload?.settings ?? {}),
            };
            const bestRun = payload?.bestRun
                ? {
                      ...payload.bestRun,
                      seedId: payload.bestRun.seedId ?? "legacy",
                  }
                : undefined;
            const bestRunsBySeed = payload?.bestRunsBySeed ?? {};
            const topRuns = payload?.topRuns ?? [];
            const lifetimeStats = {
                ...defaultLifetimeStats,
                ...(payload?.lifetimeStats ?? {}),
            };

            // Update daily streak on load
            const streakResult = updateDailyStreak(lifetimeStats);

            if (!payload) {
                set(() => ({
                    isHydrated: true,
                    settings,
                    bestRunsBySeed,
                    topRuns,
                    lifetimeStats: streakResult.stats,
                    streakPopup: {
                        show: streakResult.showPopup,
                        streak: streakResult.stats.currentDailyStreak,
                        isNewStreak: streakResult.isNewStreak,
                        previousStreak: streakResult.previousStreak,
                    },
                }));
                return;
            }
            set(() => ({
                bestRun,
                totalRuns: payload.totalRuns,
                settings,
                isHydrated: true,
                bestRunsBySeed,
                topRuns,
                lifetimeStats: streakResult.stats,
                streakPopup: {
                    show: streakResult.showPopup,
                    streak: streakResult.stats.currentDailyStreak,
                    isNewStreak: streakResult.isNewStreak,
                    previousStreak: streakResult.previousStreak,
                },
            }));

            // Persist updated streak if it changed
            if (streakResult.showPopup) {
                const meta: MetaStatePayload = {
                    schemaVersion: 1,
                    bestRun,
                    totalRuns: payload.totalRuns,
                    settings,
                    bestRunsBySeed,
                    topRuns,
                    lifetimeStats: streakResult.stats,
                };
                await adapter.saveMeta(meta);
            }
        },
        recordRun: async (summary) => {
            const state = get();
            const bestRun =
                !state.bestRun ||
                summary.wavesCleared > state.bestRun.wavesCleared
                    ? summary
                    : state.bestRun;
            const currentSeedBest = state.bestRunsBySeed[summary.seedId];
            const betterSeedRun =
                !currentSeedBest ||
                summary.wavesCleared > currentSeedBest.wavesCleared
                    ? summary
                    : currentSeedBest;
            const bestRunsBySeed = {
                ...state.bestRunsBySeed,
                [summary.seedId]: betterSeedRun,
            };
            const topRuns = [
                ...state.topRuns.filter((r) => r.runId !== summary.runId),
                summary,
            ]
                .sort((a, b) => {
                    if (b.wavesCleared !== a.wavesCleared)
                        return b.wavesCleared - a.wavesCleared;
                    return a.durationSeconds - b.durationSeconds;
                })
                .slice(0, 20);

            // Accumulate lifetime stats
            const lifetimeStats = accumulateStats(state.lifetimeStats, summary);

            const meta: MetaStatePayload = {
                schemaVersion: 1,
                bestRun,
                totalRuns: state.totalRuns + 1,
                settings: state.settings,
                bestRunsBySeed,
                topRuns,
                lifetimeStats,
            };
            await adapter.saveMeta(meta);
            set(() => ({
                bestRun,
                totalRuns: meta.totalRuns,
                bestRunsBySeed,
                topRuns,
                lifetimeStats,
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
                lifetimeStats: state.lifetimeStats,
            };
            await adapter.saveMeta(meta);
            set(() => ({ settings }));
        },
        dismissStreakPopup: () => {
            set(() => ({
                streakPopup: {
                    show: false,
                    streak: 0,
                    isNewStreak: false,
                    previousStreak: 0,
                },
            }));
        },
        showAchievement: (synergyId, name, description) => {
            set(() => ({
                achievementPopup: {
                    show: true,
                    synergyId,
                    synergyName: name,
                    synergyDescription: description,
                },
            }));
        },
        dismissAchievementPopup: () => {
            set(() => ({
                achievementPopup: {
                    show: false,
                    synergyId: "",
                    synergyName: "",
                    synergyDescription: "",
                },
            }));
        },
    },
}));
