import { useRef, useState } from "react";
import { gameManager } from "../../game/GameManager";
import { useUIStore } from "../../state/useUIStore";
import { useMultiplayerStore } from "../../state/useMultiplayerStore";
import { useMenuNavigation } from "../input/useMenuNavigation";

export const JoinGame = () => {
	const { setScreen } = useUIStore((s) => s.actions);
	const { connectionState } = useMultiplayerStore();
	const { joinRoom, disconnect } = useMultiplayerStore((s: any) => s.actions);
	const [roomCode, setRoomCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isJoining, setIsJoining] = useState(false);
	const [inputFocused, setInputFocused] = useState(false);

	const handleJoinRoom = async () => {
		if (!roomCode.trim()) {
			setError("Please enter a room code");
			return;
		}

		setIsJoining(true);
		setError(null);

		try {
			await joinRoom(roomCode.trim().toUpperCase());
			setIsJoining(false);
			
			// Set up callback for when host starts the game
			const { setOnGameStart } = useMultiplayerStore.getState().actions;
			setOnGameStart(() => {
				const { connectedPeers } = useMultiplayerStore.getState();
				// Guest controls p2 locally, p1 is controlled remotely by host
				gameManager.startRun(undefined, {
					mode: "online",
					twinControls: {
						p1: { type: "remote", peerId: connectedPeers[0], label: "Host" },
						p2: { type: "keyboardMouse", label: "You (Guest)" }
					}
				});
			});
		} catch (err: unknown) {
			setIsJoining(false);
			setError("Failed to join room. Check the code and try again.");
			console.error(err);
		}
	};

	const joinRef = useRef<HTMLButtonElement>(null);
	const backRef = useRef<HTMLButtonElement>(null);

	const canJoin = roomCode.trim().length > 0 && !isJoining;

	const nav = useMenuNavigation(
		[
			{
				ref: joinRef,
				onActivate: handleJoinRoom,
				disabled: !canJoin
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
			enabled: !inputFocused, // Disable nav when input is focused
			columns: 1, 
			onBack: inputFocused ? undefined : () => {
				disconnect();
				setScreen("multiplayerSetup");
			}
		}
	);

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		// Stop propagation to prevent menu navigation from capturing these keys
		e.stopPropagation();
		
		// Handle Enter to submit
		if (e.key === "Enter" && canJoin) {
			handleJoinRoom();
		}
		
		// Handle Escape to blur input
		if (e.key === "Escape") {
			(e.target as HTMLInputElement).blur();
		}
	};

	return (
		<div className="overlay info-screen join-game">
			<div className="panel">
				<div className="panel-header">Join Online Game</div>
				
				<div className="room-code-input">
					<label htmlFor="roomCode" className="label">Room Code</label>
					<input
						id="roomCode"
						type="text"
						value={roomCode}
						onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
						onFocus={() => setInputFocused(true)}
						onBlur={() => setInputFocused(false)}
						onKeyDown={handleInputKeyDown}
						placeholder="Enter 6-character code"
						maxLength={6}
						className="code-input"
						disabled={isJoining}
						autoComplete="off"
					/>
					<p className="note">Ask your friend for their room code</p>
				</div>

				{isJoining && (
					<div className="status-message">
						<div className="spinner" />
						<p>Joining room...</p>
					</div>
				)}

				{connectionState === "connected" && (
					<div className="status-message success">
						<p>✓ Connected! Waiting for host to start...</p>
					</div>
				)}

				{error && (
					<div className="error-message">
						<p>{error}</p>
					</div>
				)}

				<div className="actions">
					<button
						ref={joinRef}
						tabIndex={0}
						className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
						onClick={handleJoinRoom}
						disabled={!canJoin}
					>
						Join Game
					</button>

					<button
						ref={backRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 1 ? "nav-focused" : ""}`}
						onClick={() => {
							disconnect();
							setScreen("multiplayerSetup");
						}}
					>
						Back
					</button>
				</div>
			</div>
		</div>
	);
};