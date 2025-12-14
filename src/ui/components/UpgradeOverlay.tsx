import { createRef, useEffect, useMemo, useState } from "react";
import type { UpgradeDefinition } from "../../models/types";
import { gameManager } from "../../game/GameManager";
import { GAME_EVENT_KEYS, gameEvents } from "../../game/events";
import { useUIStore } from "../../state/useUIStore";
import { useMenuNavigation } from "../input/useMenuNavigation";

export const UpgradeOverlay = () => {
  const upgradeOpen = useUIStore((s) => s.upgradeSelectionOpen);
  const [options, setOptions] = useState<UpgradeDefinition[]>([]);

  useEffect(() => {
    const handler = (payload: { options: UpgradeDefinition[] }) => {
      setOptions(payload.options);
    };
    gameEvents.on(GAME_EVENT_KEYS.levelUp, handler);
    return () => {
      gameEvents.off(GAME_EVENT_KEYS.levelUp, handler);
    };
  }, []);

  const optionRefs = useMemo(() => options.map(() => createRef<HTMLButtonElement>()), [options]);

  const nav = useMenuNavigation(
    options.map((opt, idx) => ({
      ref: optionRefs[idx],
      onActivate: () => gameManager.applyUpgrade(opt.id),
    })),
    {
      enabled: true,
      columns: Math.min(3, Math.max(1, options.length)),
      onBack: undefined,
      loop: true,
    }
  );

  if (!upgradeOpen) return null;

  return (
    <div className="overlay upgrade-overlay">
      <div className="panel">
        <div className="panel-header">Choose an Upgrade</div>
        <div className="upgrade-grid">
          {options.map((opt, idx) => (
            <button
              ref={optionRefs[idx]}
              tabIndex={0}
              key={opt.id}
              className={`upgrade-card ${opt.rarity} ${nav.focusedIndex === idx ? "nav-focused" : ""}`}
              onClick={() => gameManager.applyUpgrade(opt.id)}
            >
              <div className="rarity">{opt.rarity.toUpperCase()}</div>
              <div className="name">{opt.name}</div>
              <div className="desc">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
