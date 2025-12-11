import { WAVES } from "../../config/waves";
import { useRunStore } from "../../state/useRunStore";
import { useEffect, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { BOSSES } from "../../config/bosses";
import { AFFIXES } from "../../config/affixes";

export const HUD = () => {
  const playerHealth = useRunStore((s) => s.playerHealth);
  const playerMaxHealth = useRunStore((s) => s.playerMaxHealth);
  const playerLevel = useRunStore((s) => s.playerLevel);
  const xp = useRunStore((s) => s.xp);
  const xpThreshold = useRunStore((s) => s.xpThreshold);
  const currentWave = useRunStore((s) => s.currentWave);
  const elapsedTime = useRunStore((s) => s.elapsedTime);
  const currentSeed = useRunStore((s) => s.seedId);
  const [seasonInfo, setSeasonInfo] = useState(() => gameManager.getSeasonInfo());

  const healthPct =
    playerMaxHealth > 0 ? Math.max(0, Math.min(1, playerHealth / playerMaxHealth)) * 100 : 0;
  const xpPct = xpThreshold > 0 ? Math.max(0, Math.min(1, xp / xpThreshold)) * 100 : 0;
  const time = Math.floor(elapsedTime);
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");

  useEffect(() => {
    setSeasonInfo(gameManager.getSeasonInfo());
  }, [currentSeed]);

  return (
    <div className="hud">
      <div className="hud-row">
        <div className="hud-block">
          <div className="label">Hull</div>
          <div className="bar">
            <div className="bar-fill health" style={{ width: `${healthPct}%` }} />
          </div>
          <div className="tiny">
            {playerHealth.toFixed(1)} / {playerMaxHealth}
          </div>
        </div>
        <div className="hud-block">
          <div className="label">XP</div>
          <div className="bar">
            <div className="bar-fill xp" style={{ width: `${xpPct}%` }} />
          </div>
          <div className="tiny">
            Lv {playerLevel} · {Math.floor(xp)} / {xpThreshold}
          </div>
        </div>
        <div className="hud-block compact">
          <div className="label">Wave</div>
          <div className="metric">
            {currentWave}/{WAVES.length}
          </div>
        </div>
        <div className="hud-block compact">
          <div className="label">Clock</div>
          <div className="metric">
            {minutes}:{seconds}
          </div>
        </div>
        {seasonInfo && (
          <div className="hud-block compact affix-block">
            <div className="label">Weekly</div>
            <div className="tiny truncate">
              Seed {seasonInfo.seedId} ·{" "}
              {seasonInfo.boss
                ? BOSSES.find((b) => b.id === seasonInfo.boss?.id)?.name ?? seasonInfo.boss.id
                : "—"}
            </div>
            <div className="tiny truncate">
              Affix:{" "}
              {seasonInfo.affix
                ? AFFIXES.find((a) => a.id === seasonInfo.affix?.id)?.name ?? seasonInfo.affix.id
                : "—"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
