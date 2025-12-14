import { useEffect, useMemo, useRef, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { useUIStore } from "../../state/useUIStore";
import { useMenuNavigation } from "../input/useMenuNavigation";
import type { ControlBinding } from "../../models/types";

type ControlOption = {
  id: string;
  label: string;
  type: "keyboardMouse" | "gamepad";
  index?: number;
};

const keyboardOption: ControlOption = {
  id: "keyboardMouse",
  label: "Keyboard + Mouse",
  type: "keyboardMouse",
};

export const TwinSetup = () => {
  const { setScreen } = useUIStore((s) => s.actions);
  const [gamepads, setGamepads] = useState<ControlOption[]>([]);
  const [p1Choice, setP1Choice] = useState<ControlOption>(keyboardOption);
  const [p2Choice, setP2Choice] = useState<ControlOption | null>(null);

  useEffect(() => {
    const poll = () => {
      const pads = Array.from(navigator.getGamepads?.() ?? [])
        .filter((pad): pad is Gamepad => Boolean(pad && pad.connected))
        .map<ControlOption>((pad) => ({
          id: `gamepad-${pad.index}`,
          label: pad.id?.split("(")[0]?.trim() || `Gamepad ${pad.index + 1}`,
          type: "gamepad",
          index: pad.index,
        }));
      setGamepads(pads);
      setP2Choice((current) => {
        if (current && current.type === "gamepad") {
          const stillExists = pads.some((p) => p.id === current.id);
          if (!stillExists) {
            return pads.find((p) => p.id !== p1Choice.id) ?? null;
          }
          return current;
        }
        if (!current) {
          return pads.find((p) => p.id !== p1Choice.id) ?? current;
        }
        return current;
      });
    };
    poll();
    const interval = window.setInterval(poll, 600);
    window.addEventListener("gamepadconnected", poll);
    window.addEventListener("gamepaddisconnected", poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener("gamepadconnected", poll);
      window.removeEventListener("gamepaddisconnected", poll);
    };
  }, [p1Choice.id]);

  const options = useMemo<ControlOption[]>(() => {
    return [keyboardOption, ...gamepads];
  }, [gamepads]);

  const convert = (opt: ControlOption): ControlBinding => {
    if (opt.type === "keyboardMouse") {
      return { type: "keyboardMouse", label: opt.label };
    }
    return { type: "gamepad", id: opt.id, index: opt.index, label: opt.label };
  };

  const isTakenByOther = (candidate: ControlOption, target: "p1" | "p2") => {
    const other = target === "p1" ? p2Choice : p1Choice;
    if (!other) return false;
    return other.id === candidate.id;
  };

  const canLaunch = p1Choice && p2Choice && p1Choice.id !== p2Choice.id;

  const launchRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const nav = useMenuNavigation(
    [
      {
        ref: launchRef,
        onActivate: () => {
          if (!canLaunch || !p2Choice) return;
          gameManager.startRun(undefined, {
            mode: "twin",
            twinControls: {
              p1: convert(p1Choice),
              p2: convert(p2Choice),
            },
          });
        },
        disabled: !canLaunch,
      },
      { ref: backRef, onActivate: () => setScreen("title") },
    ],
    { enabled: true, columns: 2, onBack: () => setScreen("title") }
  );

  return (
    <div className="overlay info-screen twin-setup">
      <div className="panel">
        <div className="panel-header">Twin Mode Setup</div>
        <p className="note">
          Pick who flies on keyboard/mouse versus which controller. Each pilot gets their own ship, but upgrades are
          shared. Devices can&apos;t be used by both players at once.
        </p>
        <div className="setup-grid">
          <div className="setup-column">
            <div className="subheader">Player One</div>
            <div className="option-list">
              {options.map((opt) => (
                <button
                  key={`p1-${opt.id}`}
                  className={`option-chip ${p1Choice.id === opt.id ? "selected" : ""}`}
                  disabled={isTakenByOther(opt, "p1")}
                  onClick={() => setP1Choice(opt)}
                >
                  {opt.label}
                  {opt.type === "keyboardMouse" ? " (Keyboard)" : ""}
                  {isTakenByOther(opt, "p1") && <span className="tiny">Taken</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="setup-column">
            <div className="subheader">Player Two</div>
            <div className="option-list">
              {options.map((opt) => (
                <button
                  key={`p2-${opt.id}`}
                  className={`option-chip ${p2Choice?.id === opt.id ? "selected" : ""}`}
                  disabled={isTakenByOther(opt, "p2")}
                  onClick={() => setP2Choice(opt)}
                >
                  {opt.label}
                  {opt.type === "keyboardMouse" ? " (Keyboard)" : ""}
                  {isTakenByOther(opt, "p2") && <span className="tiny">Taken</span>}
                </button>
              ))}
              {options.length === 1 && (
                <div className="tiny muted">Plug in a second controller to start co-op.</div>
              )}
            </div>
          </div>
        </div>
        <div className="actions">
          <button
            ref={launchRef}
            tabIndex={0}
            className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
            onClick={() => {
              if (!canLaunch || !p2Choice) return;
              gameManager.startRun(undefined, {
                mode: "twin",
                twinControls: { p1: convert(p1Choice), p2: convert(p2Choice) },
              });
            }}
            disabled={!canLaunch}
          >
            Launch Twin Run
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
