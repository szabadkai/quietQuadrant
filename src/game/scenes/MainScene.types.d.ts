import type Phaser from "phaser";
import type { GamepadControlState } from "../input/GamepadAdapter";
import type { ControlBinding } from "../../models/types";

export type PlayerStats = {
    moveSpeed: number;
    damage: number;
    fireRate: number; // shots per second
    projectileSpeed: number;
    projectiles: number;
    pierce: number;
    bounce: number;
    maxHealth: number;
    health: number;
    critChance: number;
    critMultiplier: number;
};

export type AbilityState = {
    dashCooldownMs: number;
    dashDurationMs: number;
    nextDashAt: number;
    activeUntil: number;
};

export type ChargeRuntime = {
    ready: boolean;
    holdMs: number;
    damageBonus: number;
    sizeBonus: number;
    idleMs: number;
};

export type ShieldState = {
    hp: number;
    activeUntil: number;
    nextReadyAt: number;
};

export type MomentumState = {
    timerMs: number;
    bonus: number;
};

export type PilotRuntime = {
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
};

export type UpgradeState = {
    [id: string]: number;
};
