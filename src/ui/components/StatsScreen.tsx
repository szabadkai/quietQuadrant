import { useMemo } from "react";
import { AFFIXES } from "../../config/affixes";
import { BOSSES } from "../../config/bosses";
import { SYNERGY_DEFINITIONS } from "../../config/synergies";
import { UPGRADE_CATALOG } from "../../config/upgrades";
import { useMetaStore } from "../../state/useMetaStore";
import { useUIStore } from "../../state/useUIStore";

function formatTime(seconds: number): string {
	if (!isFinite(seconds) || seconds <= 0) return "—";
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	if (hrs > 0) {
		return `${hrs}h ${mins}m`;
	}
	return `${mins}m ${secs}s`;
}

function formatNumber(n: number): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return n.toString();
}

export const StatsScreen = () => {
	const { setScreen } = useUIStore((s) => s.actions);
	const stats = useMetaStore((s) => s.lifetimeStats);

	const winRate = useMemo(() => {
		if (stats.totalRuns === 0) return 0;
		return Math.round((stats.totalVictories / stats.totalRuns) * 100);
	}, [stats.totalRuns, stats.totalVictories]);

	const topUpgrades = useMemo(() => {
		return Object.entries(stats.upgradePickCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([id, count]) => ({
				upgrade: UPGRADE_CATALOG.find((u) => u.id === id),
				count,
			}))
			.filter((x) => x.upgrade);
	}, [stats.upgradePickCounts]);

	const topSynergies = useMemo(() => {
		return Object.entries(stats.synergyUnlockCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([id, count]) => ({
				synergy: SYNERGY_DEFINITIONS.find((s) => s.id === id),
				count,
			}))
			.filter((x) => x.synergy);
	}, [stats.synergyUnlockCounts]);

	const bossStats = useMemo(() => {
		return BOSSES.map((boss) => ({
			boss,
			encounters: stats.bossEncounterCounts[boss.id] ?? 0,
			kills: stats.bossKillCounts[boss.id] ?? 0,
		})).filter((x) => x.encounters > 0);
	}, [stats.bossEncounterCounts, stats.bossKillCounts]);

	const affixStats = useMemo(() => {
		return AFFIXES.map((affix) => ({
			affix,
			plays: stats.affixPlayCounts[affix.id] ?? 0,
			wins: stats.affixWinCounts[affix.id] ?? 0,
		}))
			.filter((x) => x.plays > 0)
			.sort((a, b) => b.plays - a.plays);
	}, [stats.affixPlayCounts, stats.affixWinCounts]);

	return (
		<div className="overlay stats-screen">
			<div className="panel stats-panel">
				<div className="panel-header">Lifetime Stats</div>

				<div className="stats-section">
					<div className="stats-section-title">Overview</div>
					<div className="stats-grid">
						<div className="stat-card">
							<div className="stat-value">{formatNumber(stats.totalRuns)}</div>
							<div className="stat-label">Total Runs</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{formatTime(stats.totalPlaytimeSeconds)}</div>
							<div className="stat-label">Time Played</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.totalVictories}</div>
							<div className="stat-label">Victories</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{winRate}%</div>
							<div className="stat-label">Win Rate</div>
						</div>
					</div>
				</div>

				<div className="stats-section">
					<div className="stats-section-title">Combat</div>
					<div className="stats-grid">
						<div className="stat-card">
							<div className="stat-value">{formatNumber(stats.totalEnemiesDestroyed)}</div>
							<div className="stat-label">Enemies Destroyed</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{formatNumber(stats.totalWavesCleared)}</div>
							<div className="stat-label">Waves Cleared</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.totalBossesDefeated}</div>
							<div className="stat-label">Bosses Defeated</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.highestWave}</div>
							<div className="stat-label">Highest Wave</div>
						</div>
					</div>
				</div>

				<div className="stats-section">
					<div className="stats-section-title">Records</div>
					<div className="stats-grid">
						<div className="stat-card">
							<div className="stat-value">{formatTime(stats.fastestVictorySeconds)}</div>
							<div className="stat-label">Fastest Victory</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.mostEnemiesInRun}</div>
							<div className="stat-label">Most Kills (Run)</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.mostUpgradesInRun}</div>
							<div className="stat-label">Most Upgrades</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.bestWinStreak}</div>
							<div className="stat-label">Best Win Streak</div>
						</div>
					</div>
				</div>

				<div className="stats-section">
					<div className="stats-section-title">Streaks</div>
					<div className="stats-grid">
						<div className="stat-card highlight">
							<div className="stat-value">{stats.currentDailyStreak}</div>
							<div className="stat-label">Daily Streak 🔥</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.bestDailyStreak}</div>
							<div className="stat-label">Best Daily Streak</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.currentWinStreak}</div>
							<div className="stat-label">Current Win Streak</div>
						</div>
						<div className="stat-card">
							<div className="stat-value">{stats.bestWinStreak}</div>
							<div className="stat-label">Best Win Streak</div>
						</div>
					</div>
				</div>

				{topUpgrades.length > 0 && (
					<div className="stats-section">
						<div className="stats-section-title">Favorite Upgrades</div>
						<div className="stats-list">
							{topUpgrades.map(({ upgrade, count }) => (
								<div key={upgrade!.id} className="stats-list-item">
									<span className={`pill ${upgrade!.rarity}`}>{upgrade!.name}</span>
									<span className="stat-count">×{count}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{topSynergies.length > 0 && (
					<div className="stats-section">
						<div className="stats-section-title">Synergies Unlocked</div>
						<div className="stats-list">
							{topSynergies.map(({ synergy, count }) => (
								<div key={synergy!.id} className="stats-list-item">
									<span className="pill synergy">{synergy!.name}</span>
									<span className="stat-count">×{count}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{bossStats.length > 0 && (
					<div className="stats-section">
						<div className="stats-section-title">Boss Record</div>
						<div className="stats-list">
							{bossStats.map(({ boss, encounters, kills }) => (
								<div key={boss.id} className="stats-list-item">
									<span className="boss-name">{boss.name}</span>
									<span className="stat-count">
										{kills}/{encounters} ({encounters > 0 ? Math.round((kills / encounters) * 100) : 0}%)
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{affixStats.length > 0 && (
					<div className="stats-section">
						<div className="stats-section-title">Affix Experience</div>
						<div className="stats-list compact">
							{affixStats.slice(0, 6).map(({ affix, plays, wins }) => (
								<div key={affix.id} className="stats-list-item" title={affix.description}>
									<span className="affix-name">{affix.name}</span>
									<span className="stat-count">
										{wins}W / {plays}P
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				<div className="actions">
					<button className="primary" onClick={() => setScreen("title")}>
						Back
					</button>
				</div>
			</div>
		</div>
	);
};
