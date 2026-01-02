import { createRef } from "react";
import { getUpgradeDefinition } from "../../config/upgrades";
import { gameManager } from "../../game/GameManager";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { useMenuNavigation } from "../input/useMenuNavigation";
import { NewVersionBanner } from "./NewVersionBanner";

export const RunMenu = () => {
	const runMenuOpen = useUIStore((s) => s.runMenuOpen);
	const { closeRunMenu } = useUIStore((s) => s.actions);
	const currentUpgrades = useRunStore((s) => s.currentUpgrades);
	const playerLevel = useRunStore((s) => s.playerLevel);

	const loadout = currentUpgrades
		.map((u) => ({ def: getUpgradeDefinition(u.id), stacks: u.stacks }))
		.filter((u) => u.def !== undefined) as {
		def: NonNullable<ReturnType<typeof getUpgradeDefinition>>;
		stacks: number;
	}[];

	const resumeRef = createRef<HTMLButtonElement>();

	const nav = useMenuNavigation(
		[
			{
				ref: resumeRef,
				onActivate: () => {
					closeRunMenu();
					gameManager.resume();
				},
			},
		],
		{
			enabled: runMenuOpen,
			columns: 1,
			onBack: () => {
				closeRunMenu();
				gameManager.resume();
			},
		},
	);

	if (!runMenuOpen) return null;

	return (
		<div className="overlay run-menu">
			<NewVersionBanner />
			<div className="panel run-panel">
				<div className="panel-header">Run Status</div>
				<div className="run-level">Level {playerLevel}</div>

				{loadout.length > 0 ? (
					<div className="run-loadout">
						<div className="subheader">Current Upgrades ({loadout.length})</div>
						<div className="swatch-grid">
							{loadout.map(({ def, stacks }) => (
								<div key={def.id} className={`upgrade-swatch ${def.rarity}`}>
									<div className="swatch-top">
										<span className="pill rarity">{def.rarity}</span>
										<span className="pill stacks">x{stacks}</span>
									</div>
									<div className="swatch-name">{def.name}</div>
									<div className="swatch-desc">{def.description}</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="run-empty">No upgrades yet</div>
				)}

				<div className="run-actions">
					<button
						ref={resumeRef}
						tabIndex={0}
						className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
						onClick={() => {
							closeRunMenu();
							gameManager.resume();
						}}
					>
						Resume
					</button>
				</div>
				<div className="note">Press Tab or tap XP bar to toggle</div>
			</div>
		</div>
	);
};
