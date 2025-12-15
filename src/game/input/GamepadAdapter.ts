import Phaser from "phaser";

export type GamepadControlState = {
	hasGamepad: boolean;
	usingGamepad: boolean;
	move: Phaser.Math.Vector2;
	aim: Phaser.Math.Vector2;
	fireActive: boolean;
	dashPressed: boolean;
	pausePressed: boolean;
	swapRequested: boolean;
	activeGamepadId?: string;
};

const DEADZONE = 0.16;
const AIM_DEADZONE = 0.14;
const FIRE_STICK_THRESHOLD = 0.15;

export class GamepadAdapter {
	private scene: Phaser.Scene;
	private activePad?: Phaser.Input.Gamepad.Gamepad;
	private lastDashHeld = false;
	private lastPauseHeld = false;
	private lastSwapHeld = false;
	private lockedPadId?: string;
	private lockedPadIndex?: number;

	constructor(
		scene: Phaser.Scene,
		opts?: { lockedPadId?: string; lockedPadIndex?: number },
	) {
		this.scene = scene;
		this.lockedPadId = opts?.lockedPadId;
		this.lockedPadIndex = opts?.lockedPadIndex;
	}

	setLockedPad(id?: string, index?: number) {
		this.lockedPadId = id;
		this.lockedPadIndex = index;
		if (this.activePad && id && this.activePad.id !== id) {
			this.activePad = undefined;
		}
	}

	update(
		preferredPadId?: string,
		preferredPadIndex?: number,
	): GamepadControlState {
		const base: GamepadControlState = {
			hasGamepad: !!this.scene.input.gamepad,
			usingGamepad: false,
			move: new Phaser.Math.Vector2(0, 0),
			aim: new Phaser.Math.Vector2(0, 0),
			fireActive: false,
			dashPressed: false,
			pausePressed: false,
			swapRequested: false,
		};

		const plugin = this.scene.input.gamepad;
		if (!plugin) return base;

		const connectedPads = plugin.gamepads.filter(
			(p) => p && p.connected,
		) as Phaser.Input.Gamepad.Gamepad[];
		const lockedId = preferredPadId ?? this.lockedPadId;
		const lockedIndex = preferredPadIndex ?? this.lockedPadIndex;
		const locked = lockedId !== undefined || lockedIndex !== undefined;

		if (locked) {
			this.activePad =
				connectedPads.find(
					(p) =>
						(lockedId && p.id === lockedId) ||
						(lockedIndex !== undefined && p.index === lockedIndex),
				) ?? this.activePad;
			if (!this.activePad || !this.activePad.connected) {
				this.activePad =
					connectedPads.find(
						(p) =>
							(lockedId && p.id === lockedId) ||
							(lockedIndex !== undefined && p.index === lockedIndex),
					) ?? connectedPads[0];
			}
		} else {
			if (!this.activePad || !this.activePad.connected) {
				this.activePad =
					connectedPads.find((p) => p && p.id === this.activePad?.id) ??
					connectedPads[0];
			}

			for (const pad of connectedPads) {
				if (!pad) continue;
				const activity = this.getPadActivity(pad);
				if (activity > 0.3 && pad !== this.activePad) {
					this.activePad = pad;
				}
			}
		}

		const pad = this.activePad;
		if (!pad) return base;

		const move = this.getStick(pad, [0, 1], undefined, DEADZONE);
		const aim = this.getStick(pad, [2, 3], [4, 5], AIM_DEADZONE);
		const aimActive = aim.lengthSq() > 0;
		if (move.lengthSq() > 1) move.setLength(1);
		if (aim.lengthSq() > 1) aim.setLength(1);

		const fireButton =
			this.buttonValue(pad, 5) > 0.3 || // RB / R1
			this.buttonValue(pad, 7) > 0.3 || // RT / R2 analog (or ZR on Switch)
			this.buttonValue(pad, 0) > 0.4 || // Face bottom (A/B)
			this.buttonValue(pad, 1) > 0.4; // Face right (B/A)
		const dashHeld =
			this.buttonValue(pad, 4) > 0.35 || // LB / L1
			this.buttonValue(pad, 6) > 0.35; // LT / L2 analog (or ZL)
		const pauseHeld =
			this.buttonValue(pad, 9) > 0.5 || // Start / Plus / Options
			this.buttonValue(pad, 10) > 0.5; // Sometimes Plus maps here on Switch
		const swapHeld =
			this.buttonValue(pad, 8) > 0.5 || // Back / Minus
			this.buttonValue(pad, 16) > 0.5; // View on some controllers

		const dashPressed = dashHeld && !this.lastDashHeld;
		const pausePressed = pauseHeld && !this.lastPauseHeld;
		const swapRequested = locked ? false : swapHeld && !this.lastSwapHeld;

		this.lastDashHeld = dashHeld;
		this.lastPauseHeld = pauseHeld;
		this.lastSwapHeld = swapHeld;

		if (!locked && swapRequested && connectedPads.length > 1) {
			const currentIndex = connectedPads.findIndex((p) => p === pad);
			const nextPad =
				connectedPads[(currentIndex + 1) % connectedPads.length] ??
				connectedPads[0];
			if (nextPad) {
				this.activePad = nextPad;
			}
		}

		const fireActive = aim.length() > FIRE_STICK_THRESHOLD || fireButton;

		return {
			hasGamepad: true,
			usingGamepad:
				move.lengthSq() > 0 ||
				aimActive ||
				fireButton ||
				dashHeld ||
				pauseHeld ||
				swapHeld,
			move,
			aim,
			fireActive,
			dashPressed,
			pausePressed,
			swapRequested,
			activeGamepadId: this.activePad?.id ?? pad.id,
		};
	}

	private axis(
		pad: Phaser.Input.Gamepad.Gamepad,
		index: number,
		deadzone: number,
	) {
		const val = pad.axes.length > index ? pad.axes[index]!.getValue() : 0;
		return Math.abs(val) < deadzone ? 0 : val;
	}

	private getStick(
		pad: Phaser.Input.Gamepad.Gamepad,
		primary: [number, number],
		fallback: [number, number] | undefined,
		deadzone: number,
	) {
		let x = this.axis(pad, primary[0], deadzone);
		let y = this.axis(pad, primary[1], deadzone);
		if (x === 0 && y === 0 && fallback) {
			x = this.axis(pad, fallback[0], deadzone);
			y = this.axis(pad, fallback[1], deadzone);
		}
		const vec = new Phaser.Math.Vector2(x, y);
		if (vec.lengthSq() > 1) vec.setLength(1);
		return vec;
	}

	private buttonValue(pad: Phaser.Input.Gamepad.Gamepad, index: number) {
		return pad.buttons.length > index ? pad.buttons[index]!.value : 0;
	}

	private getPadActivity(pad: Phaser.Input.Gamepad.Gamepad) {
		const axesActivity = pad.axes.reduce(
			(max, axis) => Math.max(max, Math.abs(axis.getValue())),
			0,
		);
		const buttonActivity = pad.buttons.reduce(
			(max, btn) => Math.max(max, btn.value),
			0,
		);
		return Math.max(axesActivity, buttonActivity);
	}
}
