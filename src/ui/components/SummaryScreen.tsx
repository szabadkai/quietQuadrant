import { useMemo } from "react";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";

export const SummaryScreen = () => {
  const lastRun = useRunStore((s) => s.lastRunSummary);
  const bestRun = useMetaStore((s) => s.bestRun);
  const { setScreen } = useUIStore((s) => s.actions);
  const isVictory = lastRun?.bossDefeated;

  const formattedDuration = useMemo(() => {
    if (!lastRun) return "--:--";
    const minutes = Math.floor(lastRun.durationSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(lastRun.durationSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [lastRun]);

  if (!lastRun) return null;

  return (
    <div className={`overlay summary-screen ${isVictory ? "is-victory" : ""}`}>
      <div className="panel">
        {isVictory ? (
          <div className="victory-hero">
            <div className="eyebrow">Boss Down</div>
            <div className="victory-title">You Won</div>
            <div className="victory-sub">Run complete · Final score below</div>
          </div>
        ) : (
          <div className="panel-header">Defeat</div>
        )}
        <div className="summary-grid">
          <div>
            <div className="label">Time</div>
            <div className="metric">{formattedDuration}</div>
          </div>
          <div>
            <div className="label">Waves</div>
            <div className="metric">{lastRun.wavesCleared}</div>
          </div>
          <div>
            <div className="label">Enemies</div>
            <div className="metric">{lastRun.enemiesDestroyed}</div>
          </div>
        </div>
        <div className="upgrades-list">
          <div className="label">Upgrades</div>
          <div className="pill-row">
            {lastRun.upgrades.map((u) => (
              <span className="pill" key={u.id}>
                {u.id} ×{u.stacks}
              </span>
            ))}
          </div>
        </div>
        {bestRun && (
          <div className="note">
            Best: Wave {bestRun.wavesCleared} · {Math.floor(bestRun.durationSeconds)}s
          </div>
        )}
        <div className="actions">
          <button className="primary" onClick={() => gameManager.startRun()}>
            Run Again
          </button>
          <button className="ghost" onClick={() => setScreen("title")}>
            Title
          </button>
        </div>
      </div>
    </div>
  );
};
