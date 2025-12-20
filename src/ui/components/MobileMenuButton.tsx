import { useEffect, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { useInputStore } from "../../state/useInputStore";
import { useUIStore } from "../../state/useUIStore";

export const MobileMenuButton = () => {
	const isMobile = useInputStore((s) => s.isMobile);
	const screen = useUIStore((s) => s.screen);
	const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
	const runMenuOpen = useUIStore((s) => s.runMenuOpen);
	const upgradeOpen = useUIStore((s) => s.upgradeSelectionOpen);
	const { openPause, openRunMenu } = useUIStore((s) => s.actions);
	const [pressedBtn, setPressedBtn] = useState<string | null>(null);

	useEffect(() => {
		if (!pauseOpen && !runMenuOpen) {
			setPressedBtn(null);
		}
	}, [pauseOpen, runMenuOpen]);

	if (!isMobile || screen !== "inGame" || pauseOpen || runMenuOpen || upgradeOpen) return null;

	return (
		<div className="mobile-menu-buttons">
			<button
				className={`mobile-menu-btn ${pressedBtn === "run" ? "is-pressed" : ""}`}
				onPointerDown={() => setPressedBtn("run")}
				onPointerUp={() => setPressedBtn(null)}
				onPointerCancel={() => setPressedBtn(null)}
				onClick={() => {
					openRunMenu();
					gameManager.pause();
				}}
				type="button"
			>
				Run
			</button>
			<button
				className={`mobile-menu-btn ${pressedBtn === "pause" ? "is-pressed" : ""}`}
				onPointerDown={() => setPressedBtn("pause")}
				onPointerUp={() => setPressedBtn(null)}
				onPointerCancel={() => setPressedBtn(null)}
				onClick={() => {
					openPause();
					gameManager.pause();
				}}
				type="button"
			>
				⏸
			</button>
		</div>
	);
};
