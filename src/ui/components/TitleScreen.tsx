import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../../state/useUIStore";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { BOSSES } from "../../config/bosses";
import { AFFIXES } from "../../config/affixes";

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

  useEffect(() => {
    setSeasonInfo(gameManager.getSeasonInfo());
  }, []);

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
          <button className="primary" onClick={start}>
            Begin Run
          </button>
          <button className="ghost" onClick={startRandom}>
            Random Seed Run
          </button>
          <button className="ghost" onClick={() => setScreen("howToPlay")}>
            How to Play
          </button>
        </div>
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
