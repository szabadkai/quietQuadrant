import { useEffect } from "react";
import "./App.css";
import { gameManager } from "./game/GameManager";
import { GAME_EVENT_KEYS, gameEvents } from "./game/events";
import type { RunSummary } from "./models/types";
import { useMetaStore } from "./state/useMetaStore";
import { useRunStore } from "./state/useRunStore";
import { useUIStore } from "./state/useUIStore";
import { GameCanvas } from "./ui/components/GameCanvas";
import { HUD } from "./ui/components/HUD";
import { HowToPlay } from "./ui/components/HowToPlay";
import { PauseMenu } from "./ui/components/PauseMenu";
import { SettingsPanel } from "./ui/components/SettingsPanel";
import { SummaryScreen } from "./ui/components/SummaryScreen";
import { TitleScreen } from "./ui/components/TitleScreen";
import { UpgradeOverlay } from "./ui/components/UpgradeOverlay";
import { WaveCountdown } from "./ui/components/WaveCountdown";

function App() {
  const screen = useUIStore((s) => s.screen);
  const { setScreen, openSettings } = useUIStore((s) => s.actions);

  useEffect(() => {
    useMetaStore.getState().actions.hydrateFromPersistence();
  }, []);

  useEffect(() => {
    const handler = (summary: RunSummary) => {
      useMetaStore.getState().actions.recordRun(summary);
    };
    gameEvents.on(GAME_EVENT_KEYS.runEnded, handler);
    return () => {
      gameEvents.off(GAME_EVENT_KEYS.runEnded, handler);
    };
  }, []);

  useEffect(() => {
    const { openPause: onOpenPause, closePause: onClosePause } = useUIStore.getState().actions;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        const runState = useRunStore.getState().status;
        if (runState === "paused") {
          onClosePause();
          gameManager.resume();
        } else if (runState === "running") {
          onOpenPause();
          gameManager.pause();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <GameCanvas />
      <HUD />
      <WaveCountdown />
      <UpgradeOverlay />
      <PauseMenu />
      <SettingsPanel />
      {screen === "title" && <TitleScreen />}
      {screen === "howToPlay" && <HowToPlay />}
      {screen === "summary" && <SummaryScreen />}
      <div className="corner">
        <button className="ghost tiny" onClick={openSettings}>
          Settings
        </button>
        <button
          className="ghost tiny"
          onClick={() => {
            setScreen("title");
            gameManager.pause();
            useRunStore.getState().actions.setStatus("paused");
          }}
        >
          Menu
        </button>
      </div>
    </div>
  );
}

export default App;
