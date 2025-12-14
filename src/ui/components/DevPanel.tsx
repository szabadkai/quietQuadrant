import { useEffect, useMemo, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { UPGRADE_CATALOG } from "../../config/upgrades";
import { SYNERGY_DEFINITIONS } from "../../config/synergies";
import { WAVES } from "../../config/waves";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";

const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, common: 2 };

export const DevPanel = () => {
  const screen = useUIStore((s) => s.screen);
  const runStatus = useRunStore((s) => s.status);
  const [waveInput, setWaveInput] = useState(1);
  const [count, setCount] = useState(1);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (!ev.shiftKey) return;
      if (ev.key.toLowerCase() !== "d") return;
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const maxWave = WAVES.length;
  const filteredUpgrades = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const sorted = [...UPGRADE_CATALOG].sort((a, b) => {
      const rarityDiff = (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99);
      if (rarityDiff !== 0) return rarityDiff;
      return a.name.localeCompare(b.name);
    });
    if (!query) return sorted;
    return sorted.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query) ||
        u.category.toLowerCase().includes(query)
    );
  }, [filter]);

  const disabled = runStatus !== "running";

  const applyUpgrade = (id: string) => {
    if (disabled) return;
    const times = Math.max(1, Math.min(10, Math.floor(count) || 1));
    for (let i = 0; i < times; i++) {
      gameManager.applyUpgrade(id);
    }
  };

  const applySynergy = (synId: string) => {
    if (disabled) return;
    const syn = SYNERGY_DEFINITIONS.find((s) => s.id === synId);
    if (!syn) return;
    syn.requires.forEach((id) => gameManager.applyUpgrade(id));
  };

  const jumpWave = () => {
    if (disabled) return;
    const wave = Math.max(1, Math.min(maxWave, waveInput));
    setWaveInput(wave);
    gameManager.debugSetWave(wave);
  };

  if (screen !== "inGame" || !open) return null;

  return (
    <div className="dev-panel">
      <div className="dev-header">
        <span>Dev Controls</span>
        <button className="dev-close" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div className="dev-row">
        <label>Wave</label>
        <input
          type="number"
          min={1}
          max={maxWave}
          value={waveInput}
          onChange={(e) => setWaveInput(Number(e.target.value))}
        />
        <button onClick={jumpWave} disabled={disabled}>
          Jump
        </button>
      </div>
      <div className="dev-row">
        <label>Stacks</label>
        <input
          type="number"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <label>Filter</label>
        <input
          type="text"
          placeholder="id/name/category"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="dev-synergies">
        {SYNERGY_DEFINITIONS.map((syn) => (
          <button key={syn.id} onClick={() => applySynergy(syn.id)} disabled={disabled} title={syn.description}>
            {syn.name}
          </button>
        ))}
      </div>
      <div className="dev-upgrade-grid">
        {filteredUpgrades.map((u) => (
          <button
            key={u.id}
            className={`dev-upgrade ${u.rarity}`}
            onClick={() => applyUpgrade(u.id)}
            disabled={disabled}
            title={u.description}
          >
            <span className="pill rarity">{u.rarity}</span>
            <span className="pill category">{u.category}</span>
            <div className="dev-upgrade-name">{u.name}</div>
            <div className="dev-upgrade-id">{u.id}</div>
          </button>
        ))}
      </div>
      {disabled && <div className="dev-note">Start a run to use dev controls.</div>}
    </div>
  );
};
