import { useEffect, useState } from "react";
import { useMetaStore } from "../../state/useMetaStore";

export const AchievementPopup = () => {
	const { show, synergyName, synergyDescription } = useMetaStore(
		(s) => s.achievementPopup
	);
	const { dismissAchievementPopup } = useMetaStore((s) => s.actions);
	const [animating, setAnimating] = useState(false);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (show) {
			const showTimer = setTimeout(() => {
				setVisible(true);
				setAnimating(true);
			}, 100);
			return () => clearTimeout(showTimer);
		} else {
			setVisible(false);
			setAnimating(false);
		}
	}, [show]);

	const handleDismiss = () => {
		setAnimating(false);
		setTimeout(() => {
			setVisible(false);
			dismissAchievementPopup();
		}, 300);
	};

	// Auto-dismiss after 5 seconds
	useEffect(() => {
		if (visible) {
			const timer = setTimeout(handleDismiss, 5000);
			return () => clearTimeout(timer);
		}
	}, [visible]);

	if (!visible) return null;

	return (
		<div
			className={`achievement-popup-overlay ${animating ? "visible" : ""}`}
			onClick={handleDismiss}
		>
			<div
				className={`achievement-popup ${animating ? "animate-in" : "animate-out"}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="achievement-badge">
					<span className="achievement-icon">🏆</span>
					<span className="achievement-label">Achievement Unlocked!</span>
				</div>

				<div className="achievement-title">{synergyName}</div>

				<div className="achievement-description">{synergyDescription}</div>

				<div className="achievement-hint">Synergy discovered!</div>

				<button className="achievement-dismiss" onClick={handleDismiss}>
					Awesome!
				</button>
			</div>
		</div>
	);
};
