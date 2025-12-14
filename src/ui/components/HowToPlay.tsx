import { gameManager } from "../../game/GameManager";
import { useUIStore } from "../../state/useUIStore";
import { useMenuNavigation } from "../input/useMenuNavigation";
import { useRef } from "react";

export const HowToPlay = () => {
  const { setScreen } = useUIStore((s) => s.actions);
  const weeklyRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const nav = useMenuNavigation(
    [
      { ref: weeklyRef, onActivate: () => gameManager.startRun() },
      { ref: backRef, onActivate: () => setScreen("title") },
    ],
    {
      enabled: true,
      columns: 2,
      onBack: () => setScreen("title"),
    }
  );

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
          <div>
            <div className="label">Controller</div>
            <div className="desc">
              Left Stick to move · Right Stick aims & auto-fires · LB/LT to dash · Start pauses. Twin Mode supports two
              controllers or one keyboard plus a controller.
            </div>
          </div>
        </div>
        <p className="note">
          Runs are 10–15 waves capped by a bullet-hell boss. Upgrades stack; rare picks
          create spikes in power. Stay light on your feet and watch projectile patterns.
        </p>
        <div className="actions">
          <button
            ref={weeklyRef}
            tabIndex={0}
            className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
            onClick={() => gameManager.startRun()}
          >
            Weekly Run
          </button>
          <button
            ref={backRef}
            tabIndex={0}
            className={`ghost ${nav.focusedIndex === 1 ? "nav-focused" : ""}`}
            onClick={() => setScreen("title")}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
