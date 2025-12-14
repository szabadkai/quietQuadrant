/**
 * Player Controller - Handles player input processing and movement
 * Extracted from PlayerSystem to improve modularity
 */

import * as Phaser from "phaser";
import type { ControlBinding } from "../../models/types";
import type { InputControls } from "../types/InputTypes";
import type { PilotRuntime } from "./PlayerSystem";

export class PlayerController {
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.setupInput();
    }

    private setupInput(): void {
        this.cursors = this.scene.input.keyboard?.createCursorKeys();
        this.wasd = this.scene.input.keyboard?.addKeys(
            "W,S,A,D,SHIFT"
        ) as Record<string, Phaser.Input.Keyboard.Key>;
    }

    readKeyboardDirection(): Phaser.Math.Vector2 {
        const dir = new Phaser.Math.Vector2(0, 0);

        if (this.cursors?.left.isDown || this.wasd?.A.isDown) dir.x -= 1;
        if (this.cursors?.right.isDown || this.wasd?.D.isDown) dir.x += 1;
        if (this.cursors?.up.isDown || this.wasd?.W.isDown) dir.y -= 1;
        if (this.cursors?.down.isDown || this.wasd?.S.isDown) dir.y += 1;

        return dir;
    }

    getAimDirection(
        pilot: PilotRuntime,
        controls: InputControls,
        useKeyboardMouse: boolean
    ): Phaser.Math.Vector2 {
        if (useKeyboardMouse) {
            return this.getPointerAim(pilot);
        } else if (controls.aim && controls.aim.lengthSq() > 0.1) {
            return controls.aim.clone().normalize();
        }

        return pilot.lastAimDirection.clone();
    }

    getPointerAim(pilot: PilotRuntime): Phaser.Math.Vector2 {
        if (!this.isPilotActive(pilot)) return pilot.lastAimDirection.clone();

        const pointer = this.scene.input.activePointer;

        if (pointer) {
            const worldPoint = this.scene.cameras.main.getWorldPoint(
                pointer.x,
                pointer.y
            );
            const dir = new Phaser.Math.Vector2(
                worldPoint.x - pilot.sprite.x,
                worldPoint.y - pilot.sprite.y
            );

            if (dir.lengthSq() > 1) {
                return dir.normalize();
            }
        }

        return pilot.lastAimDirection.clone();
    }

    isDashPressed(
        controlsOrState:
            | InputControls
            | { controls: InputControls; binding: ControlBinding },
        binding?: ControlBinding
    ): boolean {
        let controls: InputControls;
        let bindingToUse: ControlBinding;

        if ("controls" in controlsOrState) {
            controls = controlsOrState.controls;
            bindingToUse = controlsOrState.binding;
        } else {
            controls = controlsOrState;
            bindingToUse = binding!;
        }

        return (
            controls.dashPressed ||
            (bindingToUse.type === "keyboardMouse" &&
                this.wasd !== undefined &&
                Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT))
        );
    }

    private isPilotActive(pilot: PilotRuntime): boolean {
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body | null;
        return !!(body?.enable && pilot.sprite.active);
    }

    getWasd(): Record<string, Phaser.Input.Keyboard.Key> | undefined {
        return this.wasd;
    }

    getCursors(): Phaser.Types.Input.Keyboard.CursorKeys | undefined {
        return this.cursors;
    }

    processAimingInput(inputState: {
        pilot?: any;
        controls: InputControls;
        binding: ControlBinding;
    }): Phaser.Math.Vector2 {
        if (inputState.pilot) {
            return this.getAimDirection(
                inputState.pilot,
                inputState.controls,
                inputState.binding.type === "keyboardMouse"
            );
        }
        return new Phaser.Math.Vector2(1, 0);
    }

    isFirePressed(inputState: {
        controls: InputControls;
        binding: ControlBinding;
    }): boolean {
        if (inputState.controls.fireActive) {
            return true;
        }
        if (inputState.binding.type === "keyboardMouse") {
            return this.scene.input.activePointer?.isDown ?? false;
        }
        return false;
    }

    processMovementInput(inputState: {
        controls: InputControls;
        binding: ControlBinding;
    }): Phaser.Math.Vector2 {
        const dir = new Phaser.Math.Vector2(0, 0);
        if (
            inputState.controls.move &&
            inputState.controls.move.lengthSq() > 0
        ) {
            dir.copy(inputState.controls.move);
        } else if (inputState.binding.type === "keyboardMouse") {
            dir.copy(this.readKeyboardDirection());
        }
        return dir;
    }
}
