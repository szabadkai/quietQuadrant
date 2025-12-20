import { useEffect, useMemo, useState } from "react";
import { AFFIXES } from "../../config/affixes";
import { BOSSES } from "../../config/bosses";
import { SYNERGY_DEFINITIONS } from "../../config/synergies";
import { UPGRADE_CATALOG } from "../../config/upgrades";
import { gameManager } from "../../game/GameManager";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";

const rarityOrder: Record<string, number> = {
	legendary: 0,
	rare: 1,
	common: 2,
};

type DevTab = "upgrades" | "config";

export const DevPanel = () => {
	const screen = useUIStore((s) => s.screen);
	const runStatus = useRunStore((s) => s.status);
	const [waveInput, setWaveInput] = useState(1);
	const [count, setCount] = useState(1);
	const [filter, setFilter] = useState("");
	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<DevTab>("upgrades");
	const [selectedAffix, setSelectedAffix] = useState<string>("none");
	const [selectedBoss, setSelectedBoss] = useState<string>("none");

	if (!import.meta.env.DEV) return null;

	useEffect(() => {
		const onKeyDown = (ev: KeyboardEvent) => {
			if (!ev.shiftKey) return;
			if (ev.key.toLowerCase() !== "d") return;
			setOpen((prev) => !prev);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// Sync dev overrides on mount
	useEffect(() => {
		const overrides = gameManager.getDevOverrides();
		setSelectedAffix(overrides.affix?.id ?? "none");
		setSelectedBoss(overrides.boss?.id ?? "none");
	}, [open]);

	const waveCap = useRunStore((s) => s.waveCap);
	const maxWave = waveCap ?? 999;
	const filteredUpgrades = useMemo(() => {
		const query = filter.trim().toLowerCase();
		const sorted = [...UPGRADE_CATALOG].sort((a, b) => {
			const rarityDiff =
				(rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99);
			if (rarityDiff !== 0) return rarityDiff;
			return a.name.localeCompare(b.name);
		});
		if (!query) return sorted;
		return sorted.filter(
			(u) =>
				u.name.toLowerCase().includes(query) ||
				u.id.toLowerCase().includes(query) ||
				u.category.toLowerCase().includes(query),
		);
	}, [filter]);

	const disabled = runStatus !== "running";

	const applyUpgrade = (id: string) => {
		if (disabled) return;
		const times = Math.max(1, Math.min(10, Math.floor(count) || 1));
		for (let i = 0; i < times; i++) {
			gameManager.applyUpgrade(id);
		}
	};

	const applySynergy = (synId: string) => {
		if (disabled) return;
		const syn = SYNERGY_DEFINITIONS.find((s) => s.id === synId);
		if (!syn) return;
		syn.requires.forEach((id) => gameManager.applyUpgrade(id));
	};

	const jumpWave = () => {
		if (disabled) return;
		const wave = Math.max(1, Math.min(maxWave, waveInput));
		setWaveInput(wave);
		gameManager.debugSetWave(wave);
	};

	const handleAffixChange = (affixId: string) => {
		setSelectedAffix(affixId);
		gameManager.setDevAffixOverride(affixId === "none" ? null : affixId);
	};

	const handleBossChange = (bossId: string) => {
		setSelectedBoss(bossId);
		gameManager.setDevBossOverride(bossId === "none" ? null : bossId);
	};

	const startDevRun = () => {
		gameManager.startRun(undefined, { randomSeed: true });
	};

	const clearOverrides = () => {
		setSelectedAffix("none");
		setSelectedBoss("none");
		gameManager.clearDevOverrides();
	};

	if (!open) return null;

	// Show config tab on title screen, upgrades tab in game
	const showConfigTab = screen === "title" || screen === "inGame";
	const showUpgradesTab = screen === "inGame";
	
	// Default to config tab when on title screen
	const effectiveTab = screen === "title" && activeTab === "upgrades" ? "config" : activeTab;

	return (
		<div className="dev-panel">
			<div className="dev-header">
				<span>Dev Console</span>
				<div className="dev-tabs">
					{showConfigTab && (
						<button
							className={`dev-tab ${effectiveTab === "config" ? "active" : ""}`}
							onClick={() => setActiveTab("config")}
						>
							Config
						</button>
					)}
					{showUpgradesTab && (
						<button
							className={`dev-tab ${effectiveTab === "upgrades" ? "active" : ""}`}
							onClick={() => setActiveTab("upgrades")}
						>
							Upgrades
						</button>
					)}
				</div>
				<button className="dev-close" onClick={() => setOpen(false)}>
					✕
				</button>
			</div>

			{effectiveTab === "config" && (
				<div className="dev-config">
					<div className="dev-section">
						<div className="dev-section-title">Run Configuration</div>
						<div className="dev-row">
							<label>Affix Override</label>
							<select
								value={selectedAffix}
								onChange={(e) => handleAffixChange(e.target.value)}
							>
								<option value="none">— Default (from seed) —</option>
								{AFFIXES.map((a) => (
									<option key={a.id} value={a.id}>
										{a.name}
									</option>
								))}
							</select>
						</div>
						{selectedAffix !== "none" && (
							<div className="dev-affix-desc">
								{AFFIXES.find((a) => a.id === selectedAffix)?.description}
							</div>
						)}
						<div className="dev-row">
							<label>Boss Override</label>
							<select
								value={selectedBoss}
								onChange={(e) => handleBossChange(e.target.value)}
							>
								<option value="none">— Default (from seed) —</option>
								{BOSSES.map((b) => (
									<option key={b.id} value={b.id}>
										{b.name}
									</option>
								))}
							</select>
						</div>
						{selectedBoss !== "none" && (
							<div className="dev-affix-desc">
								{BOSSES.find((b) => b.id === selectedBoss)?.description}
							</div>
						)}
						<div className="dev-row dev-actions">
							<button className="dev-btn primary" onClick={startDevRun}>
								Start Dev Run
							</button>
							<button className="dev-btn" onClick={clearOverrides}>
								Clear Overrides
							</button>
						</div>
					</div>

					{screen === "inGame" && (
						<div className="dev-section">
							<div className="dev-section-title">Wave Control</div>
							<div className="dev-row">
								<label>Wave</label>
								<input
									type="number"
									min={1}
									max={maxWave}
									value={waveInput}
									onChange={(e) => setWaveInput(Number(e.target.value))}
								/>
								<button onClick={jumpWave} disabled={disabled}>
									Jump
								</button>
							</div>
						</div>
					)}

					<div className="dev-section">
						<div className="dev-section-title">All Affixes Reference</div>
						<div className="dev-affix-list">
							{AFFIXES.map((a) => (
								<div
									key={a.id}
									className={`dev-affix-item ${selectedAffix === a.id ? "selected" : ""}`}
									onClick={() => handleAffixChange(a.id)}
								>
									<div className="dev-affix-name">{a.name}</div>
									<div className="dev-affix-desc">{a.description}</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{effectiveTab === "upgrades" && screen === "inGame" && (
				<>
					<div className="dev-row">
						<label>Wave</label>
						<input
							type="number"
							min={1}
							max={maxWave}
							value={waveInput}
							onChange={(e) => setWaveInput(Number(e.target.value))}
						/>
						<button onClick={jumpWave} disabled={disabled}>
							Jump
						</button>
					</div>
					<div className="dev-row">
						<label>Stacks</label>
						<input
							type="number"
							min={1}
							max={10}
							value={count}
							onChange={(e) => setCount(Number(e.target.value))}
						/>
						<label>Filter</label>
						<input
							type="text"
							placeholder="id/name/category"
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
						/>
					</div>
					<div className="dev-synergies">
						{SYNERGY_DEFINITIONS.map((syn) => (
							<button
								key={syn.id}
								onClick={() => applySynergy(syn.id)}
								disabled={disabled}
								title={syn.description}
							>
								{syn.name}
							</button>
						))}
					</div>
					<div className="dev-upgrade-grid">
						{filteredUpgrades.map((u) => (
							<button
								key={u.id}
								className={`dev-upgrade ${u.rarity}`}
								onClick={() => applyUpgrade(u.id)}
								disabled={disabled}
								title={u.description}
							>
								<span className="pill rarity">{u.rarity}</span>
								<span className="pill category">{u.category}</span>
								<div className="dev-upgrade-name">{u.name}</div>
								<div className="dev-upgrade-id">{u.id}</div>
							</button>
						))}
					</div>
					{disabled && (
						<div className="dev-note">Start a run to use dev controls.</div>
					)}
				</>
			)}
		</div>
	);
};
