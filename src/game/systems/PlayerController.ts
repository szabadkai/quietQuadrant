/**
 * Player controller implementation
 * Handles input processing for player movement and actions
 */

import * as Phaser from 'phaser';
import type { InputState, PilotState } from '../types/InputTypes';
import type { IPlayerController } from './interfaces/PlayerSystem';

export class PlayerController implements IPlayerController {
  private scene: Phaser.Scene;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInput();
  }

  processMovementInput(inputState: InputState): Phaser.Math.Vector2 {
    const { controls, binding } = inputState;
    const dir = new Phaser.Math.Vector2(0, 0);

    if (controls.move.lengthSq() > 0) {
      dir.copy(controls.move);
    } else if (binding.type === 'keyboardMouse') {
      dir.copy(this.readKeyboardDirection());
    }

    return dir.lengthSq() > 0 ? dir.normalize() : dir;
  }

  processAimingInput(inputState: InputState): Phaser.Math.Vector2 {
    const { controls, binding, pilot } = inputState;

    if (binding.type === 'keyboardMouse') {
      return this.getPointerAim(pilot);
    } else if (controls.aim.lengthSq() > 0.1) {
      return controls.aim.clone().normalize();
    }

    return pilot.lastAimDirection.clone();
  }

  isFirePressed(inputState: InputState): boolean {
    const { controls, binding } = inputState;

    return (
      controls.fireActive ||
      (binding.type === 'keyboardMouse' && this.scene.input.activePointer?.isDown)
    );
  }

  isDashPressed(inputState: InputState): boolean {
    const { controls, binding } = inputState;

    return (
      controls.dashPressed ||
      (binding.type === 'keyboardMouse' &&
        this.wasd &&
        Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT))
    );
  }

  private setupInput(): void {
    this.cursors = this.scene.input.keyboard?.createCursorKeys();
    this.wasd = this.scene.input.keyboard?.addKeys('W,S,A,D,SHIFT') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  private readKeyboardDirection(): Phaser.Math.Vector2 {
    const dir = new Phaser.Math.Vector2(0, 0);

    if (this.cursors?.left.isDown || this.wasd?.A.isDown) dir.x -= 1;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) dir.x += 1;
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) dir.y -= 1;
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) dir.y += 1;

    return dir;
  }

  private getPointerAim(pilot: PilotState): Phaser.Math.Vector2 {
    const pointer = this.scene.input.activePointer;

    if (pointer && pilot?.sprite) {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const dir = new Phaser.Math.Vector2(
        worldPoint.x - pilot.sprite.x,
        worldPoint.y - pilot.sprite.y
      );

      if (dir.lengthSq() > 1) {
        return dir.normalize();
      }
    }

    return pilot?.lastAimDirection?.clone() || new Phaser.Math.Vector2(1, 0);
  }
}
