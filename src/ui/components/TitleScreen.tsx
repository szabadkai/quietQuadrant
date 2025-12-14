import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../../state/useUIStore";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { BOSSES } from "../../config/bosses";
import { AFFIXES } from "../../config/affixes";
import { useMenuNavigation } from "../input/useMenuNavigation";
import { useRef } from "react";

export const TitleScreen = () => {
  const { setScreen } = useUIStore((s) => s.actions);
  const [seasonInfo, setSeasonInfo] = useState(() => gameManager.getSeasonInfo());
  const bestRunsBySeed = useMetaStore((s) => s.bestRunsBySeed);

  const weeklyBest = useMemo(() => {
    if (!seasonInfo?.seedId) return undefined;
    return bestRunsBySeed[seasonInfo.seedId];
  }, [bestRunsBySeed, seasonInfo?.seedId]);

  const start = () => {
    gameManager.startRun();
  };

  const startRandom = () => {
    gameManager.startRun(undefined, { randomSeed: true });
  };

  const startTwin = () => {
    setScreen("twinSetup");
  };

  const startInfinite = () => {
    gameManager.startRun(undefined, { mode: "infinite" });
  };

  useEffect(() => {
    setSeasonInfo(gameManager.getSeasonInfo());
  }, []);

  const weeklyRef = useRef<HTMLButtonElement>(null);
  const randomRef = useRef<HTMLButtonElement>(null);
  const twinRef = useRef<HTMLButtonElement>(null);
  const infiniteRef = useRef<HTMLButtonElement>(null);
  const howToRef = useRef<HTMLButtonElement>(null);

  const nav = useMenuNavigation(
    [
      { ref: weeklyRef, onActivate: start },
      { ref: randomRef, onActivate: startRandom },
      { ref: twinRef, onActivate: startTwin },
      { ref: infiniteRef, onActivate: startInfinite },
      { ref: howToRef, onActivate: () => setScreen("howToPlay") },
    ],
    { enabled: true, columns: 1, onBack: undefined }
  );

  return (
    <div className="overlay title-screen">
      <div className="panel hero">
        <div className="eyebrow">Quiet Quadrant</div>
        <h1>One ship. One quadrant. Stay alive.</h1>
        <p>
          Minimalist roguelike shooter in a contained arena. Build a sharp loadout,
          weave through escalating waves, and survive the bullet-hell boss.
        </p>
        <div className="actions">
          <button
            ref={weeklyRef}
            tabIndex={0}
            className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
            onClick={start}
          >
            Weekly Run
          </button>
          <button
            ref={randomRef}
            tabIndex={0}
            className={`ghost ${nav.focusedIndex === 1 ? "nav-focused" : ""}`}
            onClick={startRandom}
          >
            Random Run
          </button>
          <button
            ref={twinRef}
            tabIndex={0}
            className={`ghost ${nav.focusedIndex === 2 ? "nav-focused" : ""}`}
            onClick={startTwin}
          >
            Twin Mode
          </button>
          <button
            ref={infiniteRef}
            tabIndex={0}
            className={`ghost ${nav.focusedIndex === 3 ? "nav-focused" : ""}`}
            onClick={startInfinite}
          >
            Infinite Mode
          </button>
          <button
            ref={howToRef}
            tabIndex={0}
            className={`ghost ${nav.focusedIndex === 4 ? "nav-focused" : ""}`}
            onClick={() => setScreen("howToPlay")}
          >
            How to Play
          </button>
        </div>
        <br></br>
        <div className="note">
          Twin Mode now flies two ships at once. Pick who is on keyboard/mouse or which controller each pilot uses before
          launching.
        </div>
        <div className="note">Infinite Mode keeps looping past wave 11 with fast-scaling enemies.</div>
        {seasonInfo && (
          <div className="season-card">
            <div className="tiny label">This Week</div>
            <div className="season-row">
              <span className="pill">Seed {seasonInfo.seedId}</span>
              {seasonInfo.boss && <span className="pill">Boss: {BOSSES.find((b) => b.id === seasonInfo.boss?.id)?.name ?? seasonInfo.boss.name}</span>}
            {seasonInfo.affix && <span className="pill">Affix: {AFFIXES.find((a) => a.id === seasonInfo.affix?.id)?.name ?? seasonInfo.affix.name}</span>}
          </div>
          {seasonInfo.affix?.description && <div className="note">{seasonInfo.affix.description}</div>}
          {weeklyBest && (
            <div className="leaderboard-card">
                <div className="tiny label">Weekly High Score</div>
                <div className="metric">Wave {weeklyBest.wavesCleared}</div>
                <div className="tiny">
                  Time {Math.floor(weeklyBest.durationSeconds)}s · Enemies {weeklyBest.enemiesDestroyed}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
