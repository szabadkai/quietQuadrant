import { create } from "zustand";

export type UIScreen = "title" | "inGame" | "summary" | "howToPlay";

interface UIState {
  screen: UIScreen;
  upgradeSelectionOpen: boolean;
  pauseMenuOpen: boolean;
  settingsOpen: boolean;
  recentRareUpgradeSeen?: string;
  actions: {
    setScreen: (screen: UIScreen) => void;
    openUpgradeSelection: () => void;
    closeUpgradeSelection: () => void;
    openPause: () => void;
    closePause: () => void;
    openSettings: () => void;
    closeSettings: () => void;
    setRecentRare: (id?: string) => void;
  };
}

export const useUIStore = create<UIState>()((set) => ({
  screen: "title",
  upgradeSelectionOpen: false,
  pauseMenuOpen: false,
  settingsOpen: false,
  actions: {
    setScreen: (screen) => set(() => ({ screen })),
    openUpgradeSelection: () => set(() => ({ upgradeSelectionOpen: true })),
    closeUpgradeSelection: () => set(() => ({ upgradeSelectionOpen: false })),
    openPause: () => set(() => ({ pauseMenuOpen: true })),
    closePause: () => set(() => ({ pauseMenuOpen: false })),
    openSettings: () => set(() => ({ settingsOpen: true })),
    closeSettings: () => set(() => ({ settingsOpen: false })),
    setRecentRare: (id) => set(() => ({ recentRareUpgradeSeen: id })),
  },
}));
