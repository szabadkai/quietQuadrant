import { useEffect, useMemo, useRef, useState } from "react";
import { AFFIXES } from "../../config/affixes";
import { BOSSES } from "../../config/bosses";
import { gameManager } from "../../game/GameManager";
import { useMetaStore } from "../../state/useMetaStore";
import { useUIStore } from "../../state/useUIStore";
import { useMenuNavigation } from "../input/useMenuNavigation";

export const TitleScreen = () => {
	const { setScreen } = useUIStore((s) => s.actions);
	const [seasonInfo, setSeasonInfo] = useState(() =>
		gameManager.getSeasonInfo(),
	);
	const [seasonExpanded, setSeasonExpanded] = useState(false);
	const bestRunsBySeed = useMetaStore((s) => s.bestRunsBySeed);

	const weeklyBest = useMemo(() => {
		if (!seasonInfo?.seedId) return undefined;
		return bestRunsBySeed[seasonInfo.seedId];
	}, [bestRunsBySeed, seasonInfo?.seedId]);

	const start = () => {
		gameManager.startRun();
	};

	const startRandom = () => {
		gameManager.startRun(undefined, { randomSeed: true });
	};

	const startTwin = () => {
		setScreen("multiplayerSetup");
	};

	const startInfinite = () => {
		gameManager.startRun(undefined, { mode: "infinite" });
	};

	useEffect(() => {
		setSeasonInfo(gameManager.getSeasonInfo());
	}, []);

	const weeklyRef = useRef<HTMLButtonElement>(null);
	const randomRef = useRef<HTMLButtonElement>(null);
	const twinRef = useRef<HTMLButtonElement>(null);
	const infiniteRef = useRef<HTMLButtonElement>(null);
	const statsRef = useRef<HTMLButtonElement>(null);
	const howToRef = useRef<HTMLButtonElement>(null);

	const nav = useMenuNavigation(
		[
			{ ref: weeklyRef, onActivate: start },
			{ ref: randomRef, onActivate: startRandom },
			{ ref: twinRef, onActivate: startTwin },
			{ ref: infiniteRef, onActivate: startInfinite },
			{ ref: statsRef, onActivate: () => setScreen("stats") },
			{ ref: howToRef, onActivate: () => setScreen("howToPlay") },
		],
		{ enabled: true, columns: 1, onBack: undefined },
	);

	// Check if we're on mobile
	const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

	// Build version injected by Vite
	const buildVersion = typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev";

	return (
		<div className="overlay title-screen">
			<span className="build-version">v{buildVersion}</span>
			<div className="panel hero">
				<div className="eyebrow">Quiet Quadrant</div>
				<h1>One ship. One quadrant. Stay alive.</h1>
				<p className="hero-desc">
					Build a sharp
					loadout, weave through escalating waves, and survive the bullet-hell
					boss.
				</p>
				<div className="actions">
					<button
						ref={weeklyRef}
						tabIndex={0}
						className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
						onClick={start}
					>
						Weekly Run
					</button>
					<button
						ref={randomRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 1 ? "nav-focused" : ""}`}
						onClick={startRandom}
					>
						Random Run
					</button>
					<button
						ref={twinRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 2 ? "nav-focused" : ""}`}
						onClick={startTwin}
					>
						Multiplayer
					</button>
					<button
						ref={infiniteRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 3 ? "nav-focused" : ""}`}
						onClick={startInfinite}
					>
						Infinite Mode
					</button>
					<button
						ref={statsRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 4 ? "nav-focused" : ""}`}
						onClick={() => setScreen("stats")}
					>
						Stats
					</button>
					<button
						ref={howToRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 5 ? "nav-focused" : ""}`}
						onClick={() => setScreen("howToPlay")}
					>
						How to Play
					</button>
				</div>
				{seasonInfo && (
					<div className={`season-card ${seasonExpanded ? "expanded" : ""}`}>
						<button
							className="season-header"
							onClick={() => isMobile && setSeasonExpanded(!seasonExpanded)}
							aria-expanded={seasonExpanded}
						>
							<div className="tiny label">This Week</div>
							<div className="season-row">
								<span className="pill">Seed {seasonInfo.seedId}</span>
								{seasonInfo.boss && (
									<span className="pill">
										Boss:{" "}
										{BOSSES.find((b) => b.id === seasonInfo.boss?.id)?.name ??
											seasonInfo.boss.name}
									</span>
								)}
								{seasonInfo.affix && (
									<span className="pill">
										Affix:{" "}
										{AFFIXES.find((a) => a.id === seasonInfo.affix?.id)?.name ??
											seasonInfo.affix.name}
									</span>
								)}
							</div>
							{isMobile && (
								<span className="expand-icon">{seasonExpanded ? "▲" : "▼"}</span>
							)}
						</button>
						<div className="season-details">
							{seasonInfo.affix?.description && (
								<div className="note">{seasonInfo.affix.description}</div>
							)}
							{weeklyBest && (
								<div className="leaderboard-card">
									<div className="tiny label">Your Weekly High Score</div>
									<div className="metric">Wave {weeklyBest.wavesCleared}</div>
									<div className="tiny">
										Time {Math.floor(weeklyBest.durationSeconds)}s · Enemies{" "}
										{weeklyBest.enemiesDestroyed}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
