import { useMemo } from "react";
import { getUpgradeDefinition } from "../../config/upgrades";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";

export const PauseMenu = () => {
  const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
  const { closePause, setScreen } = useUIStore((s) => s.actions);
  const resetRun = useRunStore((s) => s.actions.reset);
  const currentUpgrades = useRunStore((s) => s.currentUpgrades);
  const settings = useMetaStore((s) => s.settings);
  const { updateSettings } = useMetaStore((s) => s.actions);

  const loadout = currentUpgrades
    .map((u) => ({ def: getUpgradeDefinition(u.id), stacks: u.stacks }))
    .filter((u) => u.def !== undefined) as { def: NonNullable<ReturnType<typeof getUpgradeDefinition>>; stacks: number }[];

  const sliders = useMemo(
    () => [
      { key: "masterVolume" as const, label: "Master", min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
      { key: "musicVolume" as const, label: "Music", min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
      { key: "sfxVolume" as const, label: "SFX", min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
    ],
    []
  );

  if (!pauseOpen) return null;

  return (
    <div className="overlay pause-menu">
      <div className="panel">
        <div className="panel-header">Paused</div>
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              closePause();
              gameManager.resume();
            }}
          >
            Resume
          </button>
          <button
            onClick={() => {
              closePause();
              resetRun();
              gameManager.startRun();
            }}
          >
            Restart Run
          </button>
          <button
            onClick={() => {
              closePause();
              resetRun();
              setScreen("howToPlay");
            }}
          >
            How to Play
          </button>
          <button
            className="ghost"
            onClick={() => {
              closePause();
              resetRun();
              setScreen("title");
            }}
          >
            Main Menu
          </button>
        </div>

        {loadout.length > 0 && (
          <div className="pause-loadout">
            <div className="subheader">Current Upgrades</div>
            <div className="swatch-grid">
              {loadout.map(({ def, stacks }) => (
                <div key={def.id} className={`upgrade-swatch ${def.rarity}`}>
                  <div className="swatch-top">
                    <span className="pill rarity">{def.rarity}</span>
                    <span className="pill category">{def.category}</span>
                    <span className="pill stacks">x{stacks}</span>
                  </div>
                  <div className="swatch-name">{def.name}</div>
                  <div className="swatch-desc">{def.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pause-settings">
          <div className="subheader">Settings</div>
          <div className="settings-grid">
            <div className="setting-row">
              <div className="label">Mute All</div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.muteAll}
                  onChange={(e) => updateSettings({ muteAll: e.target.checked })}
                />
                <span>Silence all game audio</span>
              </label>
            </div>
            <div className="setting-row">
              <div className="label">Mute Music</div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.muteMusic}
                  onChange={(e) => updateSettings({ muteMusic: e.target.checked })}
                />
                <span>Silence soundtrack only</span>
              </label>
            </div>
            {sliders.map((slider) => (
              <div key={slider.key} className="setting-row">
                <div className="label">{slider.label}</div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={settings[slider.key]}
                  onChange={(e) =>
                    updateSettings({ [slider.key]: Number(e.target.value) })
                  }
                />
                <div className="tiny">
                  {slider.format?.(settings[slider.key]) ?? settings[slider.key]}
                </div>
              </div>
            ))}
            <div className="setting-row">
              <div className="label">Low Graphics</div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.lowGraphicsMode}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettings({ lowGraphicsMode: enabled });
                    gameManager.setLowGraphicsMode(enabled);
                  }}
                />
                <span>Reduce effects for performance</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
