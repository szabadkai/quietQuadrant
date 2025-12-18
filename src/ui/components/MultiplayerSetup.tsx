import { useRef } from "react";
import { useUIStore } from "../../state/useUIStore";
import { useMultiplayerStore } from "../../state/useMultiplayerStore";
import { useMenuNavigation } from "../input/useMenuNavigation";

export const MultiplayerSetup = () => {
	const { setScreen } = useUIStore((s) => s.actions);
	const { setMode } = useMultiplayerStore((s: any) => s.actions);

	const localRef = useRef<HTMLButtonElement>(null);
	const hostRef = useRef<HTMLButtonElement>(null);
	const joinRef = useRef<HTMLButtonElement>(null);
	const backRef = useRef<HTMLButtonElement>(null);

	const nav = useMenuNavigation(
		[
			{
				ref: localRef,
				onActivate: () => {
					setMode("local");
					setScreen("twinSetup");
				}
			},
			{
				ref: hostRef,
				onActivate: () => {
					setMode("host");
					setScreen("hostGame");
				}
			},
			{
				ref: joinRef,
				onActivate: () => {
					setMode("join");
					setScreen("joinGame");
				}
			},
			{
				ref: backRef,
				onActivate: () => setScreen("title")
			}
		],
		{ enabled: true, columns: 1, onBack: () => setScreen("title") }
	);

	return (
		<div className="overlay info-screen multiplayer-setup">
			<div className="panel">
				<div className="panel-header">Multiplayer Mode</div>
				<p className="note">
					Choose how you want to play with another pilot. Local mode uses two controllers on the same device, 
					while online mode connects you with a friend over the internet.
				</p>
				
				<div className="actions">
					<button
						ref={localRef}
						tabIndex={0}
						className={`primary ${nav.focusedIndex === 0 ? "nav-focused" : ""}`}
						onClick={() => {
							setMode("local");
							setScreen("twinSetup");
						}}
					>
						Local Co-op
						<div className="tiny">Two controllers, same device</div>
					</button>
					
					<button
						ref={hostRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 1 ? "nav-focused" : ""}`}
						onClick={() => {
							setMode("host");
							setScreen("hostGame");
						}}
					>
						Host Online Game
						<div className="tiny">Create a room for a friend to join</div>
					</button>
					
					<button
						ref={joinRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 2 ? "nav-focused" : ""}`}
						onClick={() => {
							setMode("join");
							setScreen("joinGame");
						}}
					>
						Join Online Game
						<div className="tiny">Enter a room code to join a friend</div>
					</button>
					
					<button
						ref={backRef}
						tabIndex={0}
						className={`ghost ${nav.focusedIndex === 3 ? "nav-focused" : ""}`}
						onClick={() => setScreen("title")}
					>
						Back
					</button>
				</div>
			</div>
		</div>
	);
};