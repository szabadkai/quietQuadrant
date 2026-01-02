import { createRef, useMemo } from "react";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { useMenuNavigation } from "../input/useMenuNavigation";
import { NewVersionBanner } from "./NewVersionBanner";

export const PauseMenu = () => {
	const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
	const { closePause, setScreen } = useUIStore((s) => s.actions);
	const resetRun = useRunStore((s) => s.actions.reset);
	const settings = useMetaStore((s) => s.settings);
	const { updateSettings } = useMetaStore((s) => s.actions);

	const sliders = useMemo(
		() => [
			{
				key: "masterVolume" as const,
				label: "Master",
				min: 0,
				max: 1,
				step: 0.05,
				format: (v: number) => `${Math.round(v * 100)}%`,
			},
			{
				key: "musicVolume" as const,
				label: "Music",
				min: 0,
				max: 1,
				step: 0.05,
				format: (v: number) => `${Math.round(v * 100)}%`,
			},
			{
				key: "sfxVolume" as const,
				label: "SFX",
				min: 0,
				max: 1,
				step: 0.05,
				format: (v: number) => `${Math.round(v * 100)}%`,
			},
		],
		[],
	);

	const sliderRefs = sliders.map(() => createRef<HTMLInputElement>());
	const resumeRef = createRef<HTMLButtonElement>();
	const quitRef = createRef<HTMLButtonElement>();

	const nav = useMenuNavigation(
		[
			...sliders.map((slider, idx) => ({
				ref: sliderRefs[idx],
				lockHorizontal: true,
				onAdjust: (dir: -1 | 1) => {
					const next = Math.min(
						slider.max,
						Math.max(
							slider.min,
							Number((settings[slider.key] + dir * slider.step).toFixed(2)),
						),
					);
					updateSettings({ [slider.key]: next });
				},
			})),
			{
				ref: resumeRef,
				onActivate: () => {
					closePause();
					gameManager.resume();
				},
			},
			{
				ref: quitRef,
				onActivate: () => {
					closePause();
					resetRun();
					setScreen("title");
				},
			},
		],
		{
			enabled: pauseOpen,
			columns: 1,
			onBack: () => {
				closePause();
				gameManager.resume();
			},
		},
	);

	if (!pauseOpen) return null;

	return (
		<div className="overlay pause-menu">
			<NewVersionBanner />
			<div className="panel pause-panel">
				<div className="panel-header">Paused</div>

				<div className="pause-settings">
					<div className="settings-grid">
						{sliders.map((slider, idx) => (
							<div key={slider.key} className="setting-row">
								<div className="label">{slider.label}</div>
								<input
									ref={sliderRefs[idx]}
									tabIndex={0}
									type="range"
									min={slider.min}
									max={slider.max}
									step={slider.step}
									value={settings[slider.key]}
									onChange={(e) =>
										updateSettings({ [slider.key]: Number(e.target.value) })
									}
									className={nav.focusedIndex === idx ? "nav-focused" : ""}
								/>
								<div className="tiny">
									{slider.format?.(settings[slider.key]) ??
										settings[slider.key]}
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="pause-actions">
					<button
						ref={resumeRef}
						tabIndex={0}
						className={`primary ${nav.focusedIndex === sliders.length ? "nav-focused" : ""}`}
						onClick={() => {
							closePause();
							gameManager.resume();
						}}
					>
						Resume
					</button>
					<button
						ref={quitRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === sliders.length + 1 ? "nav-focused" : ""}`}
						onClick={() => {
							closePause();
							resetRun();
							setScreen("title");
						}}
					>
						Quit
					</button>
				</div>
			</div>
		</div>
	);
};
