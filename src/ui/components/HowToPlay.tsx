import { gameManager } from "../../game/GameManager";
import { useUIStore } from "../../state/useUIStore";

export const HowToPlay = () => {
  const { setScreen } = useUIStore((s) => s.actions);

  return (
    <div className="overlay info-screen">
      <div className="panel">
        <div className="panel-header">How to Play</div>
        <div className="info-grid">
          <div>
            <div className="label">Move</div>
            <div className="desc">WASD / Arrow Keys</div>
          </div>
          <div>
            <div className="label">Aim & Fire</div>
            <div className="desc">Mouse aim, hold Left Click to shoot</div>
          </div>
          <div>
            <div className="label">Dash</div>
            <div className="desc">Shift to burst through danger (cooldown)</div>
          </div>
          <div>
            <div className="label">Loop</div>
            <div className="desc">Clear waves, collect XP, pick 1 of 3 upgrades</div>
          </div>
        </div>
        <p className="note">
          Runs are 10–15 waves capped by a bullet-hell boss. Upgrades stack; rare picks
          create spikes in power. Stay light on your feet and watch projectile patterns.
        </p>
        <div className="actions">
          <button className="primary" onClick={() => gameManager.startRun()}>
            Begin Run
          </button>
          <button className="ghost" onClick={() => setScreen("title")}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
