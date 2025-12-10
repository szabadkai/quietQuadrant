import { useMemo } from "react";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { useUIStore } from "../../state/useUIStore";

export const SettingsPanel = () => {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const { closeSettings } = useUIStore((s) => s.actions);
  const settings = useMetaStore((s) => s.settings);
  const { updateSettings } = useMetaStore((s) => s.actions);

  const sliders = useMemo(
    () => [
      { key: "masterVolume" as const, label: "Master", min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
      { key: "musicVolume" as const, label: "Music", min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
      { key: "sfxVolume" as const, label: "SFX", min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
    ],
    []
  );

  if (!settingsOpen) return null;

  return (
    <div className="overlay settings-panel">
      <div className="panel">
        <div className="panel-header">Settings</div>
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
        <div className="actions">
          <button className="primary" onClick={closeSettings}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
