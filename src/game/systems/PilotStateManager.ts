/**
 * Pilot State Manager - Handles pilot runtime state and defaults
 * Extracted from PlayerSystem to improve modularity
 */

import * as Phaser from "phaser";
import type { ControlBinding } from "../../models/types";
import type { GamepadControlState } from "../input/GamepadAdapter";
import type { AbilityState } from "./interfaces/PlayerSystem";

export interface ChargeRuntime {
    ready: boolean;
    holdMs: number;
    damageBonus: number;
    sizeBonus: number;
    idleMs: number;
}

export interface MomentumState {
    timerMs: number;
    bonus: number;
}

export interface ShieldState {
    hp: number;
    activeUntil: number;
    nextReadyAt: number;
}

export interface PilotRuntime {
    id: "p1" | "p2";
    sprite: Phaser.Physics.Arcade.Image;
    ability: AbilityState;
    charge: ChargeRuntime;
    momentum: MomentumState;
    shield: ShieldState;
    lastAimDirection: Phaser.Math.Vector2;
    lastShotAt: number;
    invulnUntil: number;
    gamepadState: GamepadControlState;
    control: ControlBinding;
    shieldRing?: Phaser.GameObjects.Arc;
}

export class PilotStateManager {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    makePilotRuntime(
        id: "p1" | "p2",
        sprite: Phaser.Physics.Arcade.Image,
        control: ControlBinding
    ): PilotRuntime {
        return {
            id,
            sprite,
            ability: this.defaultAbility(),
            charge: this.defaultChargeRuntime(),
            momentum: this.defaultMomentumState(),
            shield: this.defaultShieldState(),
            lastAimDirection: new Phaser.Math.Vector2(1, 0),
            lastShotAt: 0,
            invulnUntil: 0,
            control,
            gamepadState: {
                hasGamepad: !!this.scene.input.gamepad,
                usingGamepad: false,
                move: new Phaser.Math.Vector2(0, 0),
                aim: new Phaser.Math.Vector2(0, 0),
                fireActive: false,
                dashPressed: false,
                pausePressed: false,
                swapRequested: false,
            },
        };
    }

    defaultAbility(): AbilityState {
        return {
            dashCooldownMs: 1600,
            dashDurationMs: 200,
            nextDashAt: 0,
            activeUntil: 0,
        };
    }

    defaultChargeRuntime(): ChargeRuntime {
        return {
            ready: false,
            holdMs: 0,
            damageBonus: 0.9,
            sizeBonus: 0.2,
            idleMs: 1000,
        };
    }

    defaultShieldState(): ShieldState {
        return { hp: 0, activeUntil: 0, nextReadyAt: 0 };
    }

    defaultMomentumState(): MomentumState {
        return { timerMs: 0, bonus: 0 };
    }

    isPilotActive(pilot?: PilotRuntime): boolean {
        if (!pilot) return false;
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body | null;
        return !!(body?.enable && pilot.sprite.active);
    }

    updateShieldVisual(pilot: PilotRuntime): void {
        const now = this.scene.time.now;
        const hasShield = pilot.shield.hp > 0 && now < pilot.shield.activeUntil;

        if (hasShield && !pilot.shieldRing) {
            pilot.shieldRing = this.scene.add.arc(
                pilot.sprite.x,
                pilot.sprite.y,
                30,
                0,
                360,
                false,
                0x9ff0ff,
                0.3
            );
            pilot.shieldRing.setStrokeStyle(2, 0x9ff0ff, 0.8);
            pilot.shieldRing.setDepth(0.5);
        } else if (!hasShield && pilot.shieldRing) {
            pilot.shieldRing.destroy();
            pilot.shieldRing = undefined;
        }

        if (pilot.shieldRing) {
            pilot.shieldRing.setPosition(pilot.sprite.x, pilot.sprite.y);
        }
    }
}

export interface MomentumConfig {
    stacks: number;
    ramp: number;
    timeToMaxMs: number;
}

export interface CapacitorConfig {
    stacks: number;
    damageBonus: number;
    sizeBonus: number;
    chargePierceBonus: number;
}

export function updateMomentum(
    pilot: PilotRuntime,
    deltaTime: number,
    momentumConfig: MomentumConfig,
    isPilotActive: boolean
): void {
    if (momentumConfig.stacks === 0 || !isPilotActive) return;

    const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
    const isMoving = body.velocity.lengthSq() > 100;

    if (isMoving) {
        pilot.momentum.timerMs += deltaTime * 1000;
        const progress = Math.min(
            1,
            pilot.momentum.timerMs / momentumConfig.timeToMaxMs
        );
        pilot.momentum.bonus =
            progress * momentumConfig.ramp * momentumConfig.stacks;
    } else {
        pilot.momentum.timerMs = Math.max(
            0,
            pilot.momentum.timerMs - deltaTime * 1000 * 2
        );
        const progress = pilot.momentum.timerMs / momentumConfig.timeToMaxMs;
        pilot.momentum.bonus =
            progress * momentumConfig.ramp * momentumConfig.stacks;
    }
}

export function updateChargeState(
    pilot: PilotRuntime,
    deltaTime: number,
    fireHeld: boolean,
    capacitorConfig: CapacitorConfig
): void {
    if (capacitorConfig.stacks === 0) return;

    if (fireHeld && !pilot.charge.ready) {
        pilot.charge.holdMs += deltaTime * 1000;
        if (pilot.charge.holdMs >= pilot.charge.idleMs) {
            pilot.charge.ready = true;
        }
    } else if (!fireHeld) {
        pilot.charge.holdMs = 0;
    }
}
