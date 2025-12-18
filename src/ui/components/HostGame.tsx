import { useEffect, useRef, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { useUIStore } from "../../state/useUIStore";
import { useMultiplayerStore } from "../../state/useMultiplayerStore";
import { useMenuNavigation } from "../input/useMenuNavigation";

export const HostGame = () => {
	const { setScreen } = useUIStore((s) => s.actions);
	const { connectionState, roomCode, connectedPeers } = useMultiplayerStore();
	const { createRoom, disconnect } = useMultiplayerStore((s: any) => s.actions);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Auto-create room when component mounts
		if (connectionState === "disconnected" && !isCreating) {
			setIsCreating(true);
			createRoom()
				.then(() => {
					setIsCreating(false);
					setError(null);
				})
				.catch((err: unknown) => {
					setIsCreating(false);
					setError("Failed to create room. Please try again.");
					console.error(err);
				});
		}

		return () => {
			// Cleanup on unmount
			if (connectionState !== "disconnected") {
				disconnect();
			}
		};
	}, []);

	const startGame = () => {
		if (connectedPeers.length === 0) return;
		
		// Signal guest to start
		const { startGame: signalStart } = useMultiplayerStore.getState().actions;
		signalStart();
		
		// Host controls p1 locally, p2 is controlled remotely
		gameManager.startRun(undefined, {
			mode: "online",
			twinControls: {
				p1: { type: "keyboardMouse", label: "You (Host)" },
				p2: { type: "remote", peerId: connectedPeers[0], label: "Guest" }
			}
		});
	};

	const copyRoomCode = () => {
		if (roomCode) {
			navigator.clipboard.writeText(roomCode);
		}
	};

	const startRef = useRef<HTMLButtonElement>(null);
	const copyRef = useRef<HTMLButtonElement>(null);
	const backRef = useRef<HTMLButtonElement>(null);

	const canStart = connectedPeers.length > 0;

	const nav = useMenuNavigation(
		[
			{
				ref: startRef,
				onActivate: startGame,
				disabled: !canStart
			},
			{
				ref: copyRef,
				onActivate: copyRoomCode,
				disabled: !roomCode
			},
			{
				ref: backRef,
				onActivate: () => {
					disconnect();
					setScreen("multiplayerSetup");
				}
			}
		],
		{ 
			enabled: true, 
			columns: 1, 
			onBack: () => {
				disconnect();
				setScreen("multiplayerSetup");
			}
		}
	);

	return (
		<div className="overlay info-screen host-game">
			<div className="panel">
				<div className="panel-header">Host Online Game</div>
				
				{isCreating && (
					<div className="status-message">
						<div className="spinner" />
						<p>Creating room...</p>
					</div>
				)}

				{error && (
					<div className="error-message">
						<p>{error}</p>
					</div>
				)}

				{roomCode && !error && (
					<>
						<div className="room-code-display">
							<div className="label">Room Code</div>
							<div className="code">{roomCode}</div>
							<p className="note">Share this code with your friend to let them join</p>
						</div>

						<div className="connection-status">
							<div className="label">Connection Status</div>
							<div className="status">
								{connectionState === "connecting" && "Waiting for connection..."}
								{connectionState === "connected" && connectedPeers.length === 0 && "Waiting for player..."}
								{connectionState === "connected" && connectedPeers.length > 0 && (
									<span className="success">✓ Player connected!</span>
								)}
							</div>
						</div>
					</>
				)}

				<div className="actions">
					<button
						ref={startRef}
						tabIndex={0}
						className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
						onClick={startGame}
						disabled={!canStart}
					>
						Start Game
					</button>

					<button
						ref={copyRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 1 ? "nav-focused" : ""}`}
						onClick={copyRoomCode}
						disabled={!roomCode}
					>
						Copy Room Code
					</button>

					<button
						ref={backRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 2 ? "nav-focused" : ""}`}
						onClick={() => {
							disconnect();
							setScreen("multiplayerSetup");
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
};