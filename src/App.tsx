import { useEffect } from "react";
import "./App.css";
import { soundManager } from "./audio/SoundManager";
import { GAME_EVENT_KEYS, gameEvents } from "./game/events";
import { gameManager } from "./game/GameManager";
import type { RunSummary } from "./models/types";
import { useMetaStore } from "./state/useMetaStore";
import { useRunStore } from "./state/useRunStore";
import { useUIStore } from "./state/useUIStore";
import { CardRewardOverlay } from "./ui/components/CardRewardOverlay";
import { CollectionScreen } from "./ui/components/CollectionScreen";
import { DevPanel } from "./ui/components/DevPanel";
import { GameCanvas } from "./ui/components/GameCanvas";
import { HowToPlay } from "./ui/components/HowToPlay";
import { HUD } from "./ui/components/HUD";
import { PauseMenu } from "./ui/components/PauseMenu";
import { RunMenu } from "./ui/components/RunMenu";
import { SummaryScreen } from "./ui/components/SummaryScreen";
import { StatsScreen } from "./ui/components/StatsScreen";
import { TitleScreen } from "./ui/components/TitleScreen";
import { TwinSetup } from "./ui/components/TwinSetup";
import { MultiplayerSetup } from "./ui/components/MultiplayerSetup";
import { HostGame } from "./ui/components/HostGame";
import { JoinGame } from "./ui/components/JoinGame";
import { UpgradeOverlay } from "./ui/components/UpgradeOverlay";
import { WaveCountdown } from "./ui/components/WaveCountdown";
import { TouchControls } from "./ui/components/TouchControls";
import { MobileMenuButton } from "./ui/components/MobileMenuButton";
import { StreakPopup } from "./ui/components/StreakPopup";
import { AchievementPopup } from "./ui/components/AchievementPopup";
import { useInputStore } from "./state/useInputStore";
import { isMobileBrowser } from "./utils/device";
import { isNativeMobile } from "./utils/mobile";

function App() {
	const screen = useUIStore((s) => s.screen);
	const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
	const runMenuOpen = useUIStore((s) => s.runMenuOpen);

	useEffect(() => {
		useMetaStore.getState().actions.hydrateFromPersistence();
	}, []);

	// Detect mobile and enable touch controls
	useEffect(() => {
		if (isMobileBrowser() || isNativeMobile()) {
			useInputStore.getState().actions.setIsMobile(true);
		}
	}, []);

	useEffect(() => {
		soundManager.setSettings(useMetaStore.getState().settings);
		const unsub = useMetaStore.subscribe((state) => {
			soundManager.setSettings(state.settings);
		});
		return () => unsub();
	}, []);

	useEffect(() => {
		const armAudio = () => {
			soundManager.resume();
			soundManager.startSoundtrack();
		};
		window.addEventListener("pointerdown", armAudio, { once: true });
		window.addEventListener("keydown", armAudio, { once: true });
		return () => {
			window.removeEventListener("pointerdown", armAudio);
			window.removeEventListener("keydown", armAudio);
		};
	}, []);

	useEffect(() => {
		if (screen === "title") {
			soundManager.playTitleMusic();
		}
	}, [screen]);

	useEffect(() => {
		let lastHoverButton: HTMLElement | null = null;
		const onPointerOver = (ev: PointerEvent) => {
			const target = (ev.target as HTMLElement | null)?.closest("button");
			if (!target || target === lastHoverButton) return;
			lastHoverButton = target;
			soundManager.playSfx("uiHover");
		};
		const onPointerOut = (ev: PointerEvent) => {
			const target = (ev.target as HTMLElement | null)?.closest("button");
			const next = ev.relatedTarget as Node | null;
			if (
				target &&
				target === lastHoverButton &&
				(!next || !target.contains(next))
			) {
				lastHoverButton = null;
			}
		};
		const onClick = (ev: MouseEvent) => {
			const target = (ev.target as HTMLElement | null)?.closest("button");
			if (!target) return;
			soundManager.playSfx("uiSelect");
		};
		document.addEventListener("pointerover", onPointerOver);
		document.addEventListener("pointerout", onPointerOut);
		document.addEventListener("click", onClick);
		return () => {
			document.removeEventListener("pointerover", onPointerOver);
			document.removeEventListener("pointerout", onPointerOut);
			document.removeEventListener("click", onClick);
		};
	}, []);

	useEffect(() => {
		const handler = (summary: RunSummary) => {
			useMetaStore.getState().actions.recordRun(summary);
		};
		gameEvents.on(GAME_EVENT_KEYS.runEnded, handler);
		return () => {
			gameEvents.off(GAME_EVENT_KEYS.runEnded, handler);
		};
	}, []);

	useEffect(() => {
		const { openPause: onOpenPause, closePause: onClosePause, openRunMenu, closeRunMenu } =
			useUIStore.getState().actions;
		const onKeyDown = (ev: KeyboardEvent) => {
			// Tab key toggles run menu
			if (ev.key === "Tab") {
				ev.preventDefault();
				const uiState = useUIStore.getState();
				const runState = useRunStore.getState().status;
				
				if (uiState.runMenuOpen) {
					closeRunMenu();
					gameManager.resume();
					return;
				}
				
				if (runState === "running" && uiState.screen === "inGame" && !uiState.pauseMenuOpen) {
					openRunMenu();
					gameManager.pause();
				}
				return;
			}

			if (ev.key !== "Escape") return;

			const uiState = useUIStore.getState();
			
			// Close run menu first if open
			if (uiState.runMenuOpen) {
				closeRunMenu();
				gameManager.resume();
				return;
			}

			if (uiState.pauseMenuOpen) {
				onClosePause();
				gameManager.resume();
				return;
			}

			const runState = useRunStore.getState().status;
			if (runState === "running") {
				onOpenPause();
				gameManager.pause();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		if (pauseOpen || runMenuOpen) {
			gameManager.pause();
			useRunStore.getState().actions.setStatus("paused");
			return;
		}

		const runState = useRunStore.getState().status;
		const uiScreen = useUIStore.getState().screen;
		if (runState === "paused" && uiScreen === "inGame") {
			gameManager.resume();
			useRunStore.getState().actions.setStatus("running");
		}
	}, [pauseOpen, runMenuOpen]);

	return (
		<div className="app-shell">
			<div className="playfield">
				<GameCanvas />
				<HUD />
				<WaveCountdown />
				<UpgradeOverlay />
				<PauseMenu />
				<RunMenu />
				<CardRewardOverlay />
				{import.meta.env.DEV && <DevPanel />}
			</div>
			{screen === "title" && <TitleScreen />}
			{screen === "howToPlay" && <HowToPlay />}
			{screen === "summary" && <SummaryScreen />}
			{screen === "stats" && <StatsScreen />}
			{screen === "collection" && <CollectionScreen />}
			{screen === "twinSetup" && <TwinSetup />}
			{screen === "multiplayerSetup" && <MultiplayerSetup />}
			{screen === "hostGame" && <HostGame />}
			{screen === "joinGame" && <JoinGame />}
			<TouchControls />
			<MobileMenuButton />
			<StreakPopup />
			<AchievementPopup />
		</div>
	);
}

export default App;
