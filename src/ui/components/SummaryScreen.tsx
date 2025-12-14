import { useMemo } from "react";
import { gameManager } from "../../game/GameManager";
import { BOSSES } from "../../config/bosses";
import { AFFIXES } from "../../config/affixes";
import { useMetaStore } from "../../state/useMetaStore";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { SYNERGY_DEFINITIONS } from "../../config/synergies";

export const SummaryScreen = () => {
  const lastRun = useRunStore((s) => s.lastRunSummary);
  const bestRun = useMetaStore((s) => s.bestRun);
  const bestRunsBySeed = useMetaStore((s) => s.bestRunsBySeed);
  const { setScreen } = useUIStore((s) => s.actions);
  const isVictory = lastRun?.bossDefeated && lastRun?.mode !== "infinite";
  const synergies = lastRun?.synergies ?? [];
  const synergyDefs = synergies
    .map((id) => SYNERGY_DEFINITIONS.find((s) => s.id === id))
    .filter((s): s is (typeof SYNERGY_DEFINITIONS)[number] => Boolean(s));

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

  const seedBest = lastRun.seedId ? bestRunsBySeed[lastRun.seedId] : undefined;
  const modeLabel =
    lastRun.mode === "infinite" ? "Infinite run" : lastRun.mode === "standard" ? "Standard run" : null;

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
        <div className="note">
          Seed: {lastRun.seedId}
          {lastRun.bossId ? ` · Boss: ${BOSSES.find((b) => b.id === lastRun.bossId)?.name ?? lastRun.bossId}` : ""}
          {lastRun.affixId ? ` · Affix: ${AFFIXES.find((a) => a.id === lastRun.affixId)?.name ?? lastRun.affixId}` : ""}
          {modeLabel ? ` · ${modeLabel}` : ""}
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
        {synergyDefs.length > 0 && (
          <div className="achievements-list">
            <div className="label">Synergies Discovered</div>
            <div className="pill-row">
              {synergyDefs.map((syn) => (
                <span className="pill achievement" key={syn.id} title={syn.description}>
                  {syn.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {bestRun && (
          <div className="note">
            Best: Wave {bestRun.wavesCleared} · {Math.floor(bestRun.durationSeconds)}s
          </div>
        )}
        {seedBest && seedBest.runId !== lastRun.runId && (
          <div className="note">
            Weekly best (Seed {lastRun.seedId}): Wave {seedBest.wavesCleared} · {Math.floor(seedBest.durationSeconds)}s
          </div>
        )}
        <div className="actions">
          <button
            className="primary"
            onClick={() => gameManager.startRun(undefined, { mode: lastRun.mode })}
          >
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
