import { create } from "zustand";

export type UIScreen =
    | "title"
    | "inGame"
    | "summary"
    | "howToPlay"
    | "twinSetup"
    | "multiplayerSetup"
    | "hostGame"
    | "joinGame"
    | "stats"
    | "collection";

interface UIState {
    screen: UIScreen;
    upgradeSelectionOpen: boolean;
    pauseMenuOpen: boolean;
    leaderboardOpen: boolean;
    actions: {
        setScreen: (screen: UIScreen) => void;
        openUpgradeSelection: () => void;
        closeUpgradeSelection: () => void;
        openPause: () => void;
        closePause: () => void;
        openLeaderboard: () => void;
        closeLeaderboard: () => void;
    };
}

export const useUIStore = create<UIState>()((set) => ({
    screen: "title",
    upgradeSelectionOpen: false,
    pauseMenuOpen: false,
    leaderboardOpen: false,
    actions: {
        setScreen: (screen) => set(() => ({ screen })),
        openUpgradeSelection: () => set(() => ({ upgradeSelectionOpen: true })),
        closeUpgradeSelection: () =>
            set(() => ({ upgradeSelectionOpen: false })),
        openPause: () => set(() => ({ pauseMenuOpen: true })),
        closePause: () => set(() => ({ pauseMenuOpen: false })),
        openLeaderboard: () => set(() => ({ leaderboardOpen: true })),
        closeLeaderboard: () => set(() => ({ leaderboardOpen: false })),
    },
}));
