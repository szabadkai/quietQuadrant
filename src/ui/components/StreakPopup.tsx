import { useEffect, useState } from "react";
import { useMetaStore } from "../../state/useMetaStore";

export const StreakPopup = () => {
	const { show, streak, isNewStreak, previousStreak } = useMetaStore(
		(s) => s.streakPopup
	);
	const { dismissStreakPopup } = useMetaStore((s) => s.actions);
	const bestStreak = useMetaStore((s) => s.lifetimeStats.bestDailyStreak);
	const [animating, setAnimating] = useState(false);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (show) {
			// Small delay before showing for smoother entrance
			const showTimer = setTimeout(() => {
				setVisible(true);
				setAnimating(true);
			}, 300);
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
			dismissStreakPopup();
		}, 300);
	};

	if (!visible) return null;

	const isNewRecord = streak === bestStreak && streak > 1;
	const streakBroken = isNewStreak && previousStreak > 1;

	return (
		<div
			className={`streak-popup-overlay ${animating ? "visible" : ""}`}
			onClick={handleDismiss}
		>
			<div
				className={`streak-popup ${animating ? "animate-in" : "animate-out"}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="streak-icon">🔥</div>
				<div className="streak-count">{streak}</div>
				<div className="streak-label">
					{streak === 1 ? "Day Streak Started!" : "Day Streak!"}
				</div>

				{streakBroken && (
					<div className="streak-broken">
						Previous streak: {previousStreak} days
					</div>
				)}

				{isNewRecord && <div className="streak-record">🏆 New Record!</div>}

				{streak > 1 && !isNewRecord && (
					<div className="streak-message">
						{streak >= 30
							? "Legendary dedication!"
							: streak >= 14
								? "Two weeks strong!"
								: streak >= 7
									? "One week streak!"
									: streak >= 3
										? "Keep it going!"
										: "Nice consistency!"}
					</div>
				)}

				<button className="streak-dismiss" onClick={handleDismiss}>
					Continue
				</button>
			</div>
		</div>
	);
};
