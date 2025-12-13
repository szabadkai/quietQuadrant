import { useEffect, useMemo, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { useUIStore } from "../../state/useUIStore";
import { useMetaStore } from "../../state/useMetaStore";
import { SYNERGY_DEFINITIONS } from "../../config/synergies";
import { UPGRADE_CATALOG } from "../../config/upgrades";

type LeaderboardTab = "weekly" | "all";

export const LeaderboardModal = () => {
  const open = useUIStore((s) => s.leaderboardOpen);
  const { closeLeaderboard } = useUIStore((s) => s.actions);
  const bestRun = useMetaStore((s) => s.bestRun);
  const bestRunsBySeed = useMetaStore((s) => s.bestRunsBySeed);
  const topRuns = useMetaStore((s) => s.topRuns);
  const isHydrated = useMetaStore((s) => s.isHydrated);
  const [seasonInfo, setSeasonInfo] = useState(() => gameManager.getSeasonInfo());
  const [tab, setTab] = useState<LeaderboardTab>("weekly");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    setSeasonInfo(gameManager.getSeasonInfo());
  }, []);

  if (!open) return null;

  const weeklyBest = seasonInfo?.seedId ? bestRunsBySeed[seasonInfo.seedId] : undefined;

  const formattedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const top10 = useMemo(() => {
    const sorted = [...topRuns].sort((a, b) => {
      if (b.wavesCleared !== a.wavesCleared) return b.wavesCleared - a.wavesCleared;
      return a.durationSeconds - b.durationSeconds;
    });
    while (sorted.length < 10) {
      sorted.push({
        runId: `empty-${sorted.length}`,
        timestamp: 0,
        durationSeconds: 0,
        wavesCleared: 0,
        bossDefeated: false,
        enemiesDestroyed: 0,
        upgrades: [],
        seedId: "",
      });
    }
    return sorted.slice(0, 10);
  }, [topRuns]);

  const renderRunDetails = (runId: string) => {
    const run = topRuns.find((r) => r.runId === runId);
    if (!run) return null;
    const synergies = (run.synergies ?? []).map((id) => SYNERGY_DEFINITIONS.find((s) => s.id === id)?.name ?? id);
    return (
      <div className="run-details">
        <div className="pill-row">
          {run.seedId && <span className="pill">Seed {run.seedId}</span>}
          {run.bossId && <span className="pill">Boss {run.bossId}</span>}
          {run.affixId && <span className="pill">Affix {run.affixId}</span>}
          {synergies.length > 0 && <span className="pill achievement">Synergies: {synergies.join(", ")}</span>}
        </div>
        <div className="swatch-grid">
          {run.upgrades.map((u) => {
            const def = UPGRADE_CATALOG.find((d) => d.id === u.id);
            return (
              <div key={u.id} className={`upgrade-swatch ${def?.rarity ?? "common"}`}>
                <div className="swatch-top">
                  <span className="pill rarity">{def?.rarity ?? "?"}</span>
                  <span className="pill category">{def?.category ?? "?"}</span>
                  <span className="pill stacks">x{u.stacks}</span>
                </div>
                <div className="swatch-name">{def?.name ?? u.id}</div>
                <div className="swatch-desc">{def?.description ?? "Unknown upgrade"}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const rows =
    tab === "weekly"
      ? top10.filter((r) => r.seedId === seasonInfo?.seedId || r.runId.startsWith("empty-"))
      : top10;

  return (
    <div className="overlay leaderboard-overlay">
      <div className="panel leaderboard-panel">
        <div className="panel-header">
          Leaderboards
          <button className="dev-close" onClick={closeLeaderboard}>
            ✕
          </button>
        </div>
        {seasonInfo && (
          <div className="note">
            Seed {seasonInfo.seedId}
            {seasonInfo.boss ? ` · Boss ${seasonInfo.boss.name}` : ""}
            {seasonInfo.affix ? ` · Affix ${seasonInfo.affix.name}` : ""}
          </div>
        )}
        {!isHydrated && <div className="tiny">Loading leaderboard…</div>}
        {isHydrated && (
          <>
            <div className="tab-row">
              <button className={`tab ${tab === "weekly" ? "active" : ""}`} onClick={() => setTab("weekly")}>
                Weekly
              </button>
              <button className={`tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
                All-Time
              </button>
            </div>
            <div className="leaderboard-card top-list">
              <div className="tiny label">{tab === "weekly" ? "Weekly Top 10" : "All-Time Top 10"}</div>
              <div className="leaderboard-list">
                {rows.map((run, idx) => {
                  const isEmpty = run.wavesCleared === 0 && run.runId.startsWith("empty-");
                  const expanded = expandedRunId === run.runId;
                  return (
                    <div key={`${tab}-${run.runId}`} className={`leaderboard-row ${expanded ? "expanded" : ""}`}>
                      <button
                        className="leaderboard-row-main"
                        disabled={isEmpty}
                        onClick={() => setExpandedRunId(expanded ? null : run.runId)}
                      >
                        <span className="pill">{idx + 1}</span>
                        {isEmpty ? (
                          <span className="tiny">Empty slot</span>
                        ) : (
                          <>
                            <span className="metric">Wave {run.wavesCleared}</span>
                            <span className="tiny">
                              {formattedTime(run.durationSeconds)} · {run.enemiesDestroyed} enemies
                            </span>
                            <span className="tiny">Seed {run.seedId}</span>
                          </>
                        )}
                      </button>
                      {expanded && !isEmpty && renderRunDetails(run.runId)}
                    </div>
                  );
                })}
              </div>
              {tab === "weekly" && !weeklyBest && <div className="tiny">No runs on this seed yet. Finish a run to claim it.</div>}
              {tab === "all" && !bestRun && <div className="tiny">No runs recorded yet.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
