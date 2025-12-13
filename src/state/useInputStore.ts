import { create } from "zustand";

type StickState = {
  active: boolean;
  x: number;
  y: number;
  magnitude: number;
};

type InputState = {
  isMobile: boolean;
  leftStick: StickState;
  rightStick: StickState;
  actions: {
    setIsMobile: (isMobile: boolean) => void;
    updateLeftStick: (state: StickState) => void;
    updateRightStick: (state: StickState) => void;
    releaseLeftStick: () => void;
    releaseRightStick: () => void;
    reset: () => void;
  };
};

const DEFAULT_STICK: StickState = {
  active: false,
  x: 0,
  y: 0,
  magnitude: 0,
};

export const useInputStore = create<InputState>()((set) => ({
  isMobile: false,
  leftStick: DEFAULT_STICK,
  rightStick: DEFAULT_STICK,
  actions: {
    setIsMobile: (isMobile) => set(() => ({ isMobile })),
    updateLeftStick: (state) => set(() => ({ leftStick: state })),
    updateRightStick: (state) => set(() => ({ rightStick: state })),
    releaseLeftStick: () => set(() => ({ leftStick: DEFAULT_STICK })),
    releaseRightStick: () => set(() => ({ rightStick: DEFAULT_STICK })),
    reset: () =>
      set(() => ({
        leftStick: DEFAULT_STICK,
        rightStick: DEFAULT_STICK,
      })),
  },
}));
