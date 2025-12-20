import { useMemo } from "react";
import { UPGRADE_CATALOG } from "../../config/upgrades";
import { useMetaStore } from "../../state/useMetaStore";

export const CardRewardOverlay = () => {
	const pendingReward = useMetaStore((s) => s.pendingCardReward);
	const cardCollection = useMetaStore((s) => s.cardCollection);
	const { selectCardReward } = useMetaStore((s) => s.actions);

	const options = useMemo(() => {
		return pendingReward.options.map((id) => {
			const upgrade = UPGRADE_CATALOG.find((u) => u.id === id);
			const isLocked = !cardCollection.unlockedUpgrades.includes(id);
			const currentBoost = cardCollection.upgradeBoosts[id] ?? 0;
			return {
				id,
				upgrade,
				isLocked,
				currentBoost,
				action: isLocked ? "unlock" : "boost",
			};
		});
	}, [pendingReward.options, cardCollection]);

	if (!pendingReward.active || options.length === 0) return null;

	return (
		<div className="overlay card-reward-overlay">
			<div className="panel card-reward-panel">
				<div className="card-reward-header">
					<div className="eyebrow">Boss Defeated!</div>
					<h2>Choose a Card</h2>
					<p className="card-reward-desc">
						Unlock new upgrades or boost existing ones to increase their drop rate.
					</p>
				</div>

				<div className="card-reward-options">
					{options.map(({ id, upgrade, isLocked, currentBoost, action }) => (
						<button
							key={id}
							className={`card-reward-card ${upgrade?.rarity ?? "common"} ${action}`}
							onClick={() => selectCardReward(id)}
						>
							<div className="card-action-badge">
								{isLocked ? "🔓 Unlock" : `⬆ Boost ${currentBoost + 1}/5`}
							</div>
							<div className="card-rarity-badge">{upgrade?.rarity}</div>
							<div className="card-name">{upgrade?.name ?? id}</div>
							<div className="card-description">{upgrade?.description}</div>
							<div className="card-category">{upgrade?.category}</div>
						</button>
					))}
				</div>

				<div className="card-reward-hint">
					Unlocked cards appear in your upgrade pool. Boosted cards drop more often.
				</div>
			</div>
		</div>
	);
};
