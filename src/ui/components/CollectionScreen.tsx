import { useMemo, useState } from "react";
import { UPGRADE_CATALOG } from "../../config/upgrades";
import { useMetaStore } from "../../state/useMetaStore";
import { useUIStore } from "../../state/useUIStore";

type FilterRarity = "all" | "common" | "rare" | "legendary";

export const CollectionScreen = () => {
	const { setScreen } = useUIStore((s) => s.actions);
	const cardCollection = useMetaStore((s) => s.cardCollection);
	const [filter, setFilter] = useState<FilterRarity>("all");

	// Only show unlocked upgrades - don't reveal locked ones
	const unlockedUpgradeData = useMemo(() => {
		return UPGRADE_CATALOG.filter((u) => cardCollection.unlockedUpgrades.includes(u.id));
	}, [cardCollection.unlockedUpgrades]);

	const collectionStats = useMemo(() => {
		const unlocked = cardCollection.unlockedUpgrades.length;
		const legendaryUnlocked = unlockedUpgradeData.filter((u) => u.rarity === "legendary").length;
		const totalBoosts = Object.values(cardCollection.upgradeBoosts).reduce((sum, b) => sum + b, 0);
		const maxBoosts = unlocked * 5;
		return { unlocked, legendaryUnlocked, totalBoosts, maxBoosts };
	}, [cardCollection, unlockedUpgradeData]);

	const upgrades = useMemo(() => {
		let filtered = [...unlockedUpgradeData];
		if (filter !== "all") {
			filtered = filtered.filter((u) => u.rarity === filter);
		}
		// Sort by rarity (legendary > rare > common), then by name
		const rarityOrder = { legendary: 0, rare: 1, common: 2 };
		return filtered.sort((a, b) => {
			const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
			if (rarityDiff !== 0) return rarityDiff;
			return a.name.localeCompare(b.name);
		});
	}, [filter, unlockedUpgradeData]);

	return (
		<div className="overlay collection-screen">
			<div className="panel collection-panel">
				<div className="panel-header">Card Collection</div>

				<div className="collection-summary">
					<div className="collection-stat">
						<span className="collection-stat-value">
							{collectionStats.unlocked}
						</span>
						<span className="collection-stat-label">Cards Unlocked</span>
					</div>
					<div className="collection-stat legendary">
						<span className="collection-stat-value">
							{collectionStats.legendaryUnlocked}
						</span>
						<span className="collection-stat-label">Legendaries</span>
					</div>
					<div className="collection-stat">
						<span className="collection-stat-value">{cardCollection.totalCardsCollected}</span>
						<span className="collection-stat-label">Cards Collected</span>
					</div>
				</div>

				<div className="collection-filters">
					<button
						className={`filter-btn ${filter === "all" ? "active" : ""}`}
						onClick={() => setFilter("all")}
					>
						All
					</button>
					<button
						className={`filter-btn ${filter === "common" ? "active" : ""}`}
						onClick={() => setFilter("common")}
					>
						Common
					</button>
					<button
						className={`filter-btn ${filter === "rare" ? "active" : ""}`}
						onClick={() => setFilter("rare")}
					>
						Rare
					</button>
					<button
						className={`filter-btn ${filter === "legendary" ? "active" : ""}`}
						onClick={() => setFilter("legendary")}
					>
						Legendary
					</button>
				</div>

				<div className="collection-grid">
					{upgrades.map((upgrade) => {
						const boostLevel = cardCollection.upgradeBoosts[upgrade.id] ?? 0;
						return (
							<div
								key={upgrade.id}
								className={`collection-card ${upgrade.rarity} unlocked`}
							>
								<div className="collection-card-header">
									<span className="collection-card-rarity">{upgrade.rarity}</span>
									{boostLevel > 0 && (
										<span className="collection-card-boost">+{boostLevel}</span>
									)}
								</div>
								<div className="collection-card-name">
									{upgrade.name}
								</div>
								<div className="collection-card-desc">
									{upgrade.description}
								</div>
								<div className="collection-card-boost-bar">
									{[1, 2, 3, 4, 5].map((level) => (
										<div
											key={level}
											className={`boost-pip ${level <= boostLevel ? "filled" : ""}`}
										/>
									))}
								</div>
								<div className="collection-card-category">{upgrade.category}</div>
							</div>
						);
					})}
					{/* Show mystery cards hint if there are more to unlock */}
					{filter === "all" && upgrades.length < 30 && (
						<div className="collection-card mystery locked">
							<div className="lock-overlay">?</div>
							<div className="collection-card-name">More to discover...</div>
							<div className="collection-card-desc">Defeat bosses to unlock new cards</div>
						</div>
					)}
				</div>

				<div className="collection-hint">
					Defeat bosses to unlock new cards and boost existing ones. Boosted cards appear more often!
				</div>

				<div className="actions">
					<button className="primary" onClick={() => setScreen("title")}>
						Back
					</button>
				</div>
			</div>
		</div>
	);
};
