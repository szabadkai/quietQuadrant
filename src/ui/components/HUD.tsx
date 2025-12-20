import { useEffect, useState } from "react";
import { AFFIXES } from "../../config/affixes";
import { BOSSES } from "../../config/bosses";
import { gameManager } from "../../game/GameManager";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";

export const HUD = () => {
	const playerHealth = useRunStore((s) => s.playerHealth);
	const playerMaxHealth = useRunStore((s) => s.playerMaxHealth);
	const playerLevel = useRunStore((s) => s.playerLevel);
	const xp = useRunStore((s) => s.xp);
	const xpThreshold = useRunStore((s) => s.xpThreshold);
	const currentWave = useRunStore((s) => s.currentWave);
	const waveCap = useRunStore((s) => s.waveCap);
	const elapsedTime = useRunStore((s) => s.elapsedTime);
	const currentSeed = useRunStore((s) => s.seedId);
	const { openRunMenu } = useUIStore((s) => s.actions);
	const [seasonInfo, setSeasonInfo] = useState(() =>
		gameManager.getSeasonInfo(),
	);

	const healthPct =
		playerMaxHealth > 0
			? Math.max(0, Math.min(1, playerHealth / playerMaxHealth)) * 100
			: 0;
	const xpPct =
		xpThreshold > 0 ? Math.max(0, Math.min(1, xp / xpThreshold)) * 100 : 0;
	const time = Math.floor(elapsedTime);
	const minutes = Math.floor(time / 60)
		.toString()
		.padStart(2, "0");
	const seconds = Math.floor(time % 60)
		.toString()
		.padStart(2, "0");

	useEffect(() => {
		setSeasonInfo(gameManager.getSeasonInfo());
	}, [currentSeed]);

	const currentAffix = seasonInfo?.affix
		? AFFIXES.find((a) => a.id === seasonInfo.affix?.id)
		: null;

	const handleXpClick = () => {
		openRunMenu();
		gameManager.pause();
	};

	return (
		<div className="hud">
			<div className="hud-row">
				<div className="hud-block">
					<div className="hud-top-line">
						<span className="label">Hull</span>
						<span className="tiny">
							{playerHealth.toFixed(1)} / {playerMaxHealth}
						</span>
					</div>
					<div className="bar">
						<div
							className="bar-fill health"
							style={{ width: `${healthPct}%` }}
						/>
					</div>
				</div>
				<div 
					className="hud-block clickable"
					onClick={handleXpClick}
					title="View run status (Tab)"
				>
					<div className="hud-top-line">
						<span className="label">XP</span>
						<span className="tiny">
							Lv {playerLevel} · {Math.floor(xp)} / {xpThreshold}
						</span>
					</div>
					<div className="bar">
						<div className="bar-fill xp" style={{ width: `${xpPct}%` }} />
					</div>
				</div>
				<div className="hud-block compact">
					<div className="hud-top-line">
						<span className="label">Wave</span>
						<span className="metric">
							{currentWave}/{waveCap ?? "∞"}
						</span>
					</div>
				</div>
				<div className="hud-block compact">
					<div className="hud-top-line">
						<span className="label">Clock</span>
						<span className="metric">
							{minutes}:{seconds}
						</span>
					</div>
				</div>
				{seasonInfo && (
					<div 
						className="hud-block compact affix-block"
						title={currentAffix?.description ?? ""}
					>
						<div className="hud-top-line">
							<span className="label">Weekly</span>
							<span className="tiny truncate">Seed {seasonInfo.seedId}</span>
						</div>
						<div className="hud-bottom-line">
							<span className="tiny truncate">
								{seasonInfo.boss
									? (BOSSES.find((b) => b.id === seasonInfo.boss?.id)?.name ??
										seasonInfo.boss.id)
									: "Boss: —"}
							</span>
							<span className="tiny truncate" style={{ textAlign: "right" }}>
								{currentAffix?.name ?? "Affix: —"}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
