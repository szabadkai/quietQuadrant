import { useEffect, useState } from "react";
import { useInputStore } from "../../state/useInputStore";
import { useUIStore } from "../../state/useUIStore";

export const MobileMenuButton = () => {
	const isMobile = useInputStore((s) => s.isMobile);
	const screen = useUIStore((s) => s.screen);
	const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
	const upgradeOpen = useUIStore((s) => s.upgradeSelectionOpen);
	const { openPause } = useUIStore((s) => s.actions);
	const [pressed, setPressed] = useState(false);

	useEffect(() => {
		if (!pauseOpen) {
			setPressed(false);
		}
	}, [pauseOpen]);

	if (!isMobile || screen !== "inGame" || pauseOpen || upgradeOpen) return null;

	return (
		<button
			className={`mobile-menu-button ${pressed ? "is-pressed" : ""}`}
			onPointerDown={() => setPressed(true)}
			onPointerUp={() => setPressed(false)}
			onPointerCancel={() => setPressed(false)}
			onClick={() => openPause()}
			type="button"
		>
			Menu
		</button>
	);
};
