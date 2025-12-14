/**
 * Player system implementation
 * Handles player movement, input, stats, and abilities
 */

import * as Phaser from "phaser";
import { soundManager } from "../../audio/SoundManager";
import type { ControlBinding } from "../../models/types";
import type { InputControls, InputState } from "../types/InputTypes";
import { eventBus } from "./EventBus";
import { BaseGameSystem } from "./interfaces/GameSystem";
import type {
    IPlayerSystem,
    PlayerState,
    PlayerStats,
} from "./interfaces/PlayerSystem";
import {
    PilotStateManager,
    type PilotRuntime,
    updateMomentum,
    updateChargeState,
} from "./PilotStateManager";
import { PlayerSpawner } from "./PlayerSpawner";

// Re-export PilotRuntime for external use
export type { PilotRuntime } from "./PilotStateManager";

export class PlayerSystem extends BaseGameSystem implements IPlayerSystem {
    private playerStats: PlayerStats = {
        moveSpeed: 240,
        damage: 12,
        fireRate: 4,
        projectileSpeed: 520,
        projectiles: 1,
        pierce: 0,
        bounce: 0,
        maxHealth: 5,
        health: 5,
        critChance: 0.05,
        critMultiplier: 2,
    };

    private player?: Phaser.Physics.Arcade.Image;
    private player2?: Phaser.Physics.Arcade.Image;
    private playersGroup?: Phaser.Physics.Arcade.Group;
    private playerState?: PilotRuntime;
    private playerTwoState?: PilotRuntime;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
    private pilotStateManager?: PilotStateManager;
    private playerSpawner?: PlayerSpawner;

    // Configuration objects (these would be managed by upgrade system in full implementation)
    private momentumConfig = { stacks: 0, ramp: 0.25, timeToMaxMs: 2000 };
    private capacitorConfig = {
        stacks: 0,
        damageBonus: 0.9,
        sizeBonus: 0.2,
        chargePierceBonus: 0,
    };

    constructor() {
        super("player-system", []);
    }

    protected onInitialize(): void {
        const scene = this.getScene();
        this.pilotStateManager = new PilotStateManager(scene);
        this.playerSpawner = new PlayerSpawner(scene);
        this.setupInput();
        this.setupPlayersGroup();
        this.spawnPlayers();
        this.setupEventListeners();
    }

    protected onShutdown(): void {
        this.playersGroup?.destroy();
        eventBus.removeAllListeners();
    }

    update(time: number, delta: number): void {
        const dt = delta / 1000;

        if (!this.playerState) return;

        const activePilots = this.getActivePilots();
        if (activePilots.length === 0) return;

        // Handle input-driven updates for each pilot
        activePilots.forEach((pilot) => {
            // Create input state from current keyboard/mouse state
            const moveDir = this.readKeyboardDirection();
            const inputState: InputState = {
                controls: {
                    up: this.cursors?.up.isDown || this.wasd?.W.isDown || false,
                    down:
                        this.cursors?.down.isDown ||
                        this.wasd?.S.isDown ||
                        false,
                    left:
                        this.cursors?.left.isDown ||
                        this.wasd?.A.isDown ||
                        false,
                    right:
                        this.cursors?.right.isDown ||
                        this.wasd?.D.isDown ||
                        false,
                    fire: this.isFireActive(),
                    dash: this.isDashPressed(),
                    move: moveDir,
                    aim: this.getPointerAim(pilot),
                    fireActive: this.isFireActive(),
                    dashPressed: this.isDashPressed(),
                },
                binding: pilot.control,
                fireHeld: this.isFireActive(),
            };

            // Handle movement
            this.handlePlayerMovement(
                pilot,
                dt,
                inputState.controls,
                inputState.binding
            );

            // Handle shooting
            this.handlePlayerShooting(
                pilot,
                inputState.controls,
                inputState.binding,
                inputState.fireHeld || false
            );

            // Update pilot state (momentum, charge, shield)
            this.updatePilot(pilot, time, dt);
        });
    }

    private isFireActive(): boolean {
        const scene = this.getScene();
        return (
            scene.input.activePointer?.isDown ||
            scene.input.mousePointer?.isDown ||
            false
        );
    }

    private isDashPressed(): boolean {
        return this.wasd?.SHIFT
            ? Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT)
            : false;
    }

    getPlayerStats(): PlayerStats {
        return { ...this.playerStats };
    }

    getPlayer(): Phaser.Physics.Arcade.Image | undefined {
        return this.player;
    }

    getPlayersGroup(): Phaser.Physics.Arcade.Group | undefined {
        return this.playersGroup;
    }

    updatePlayerStats(stats: Partial<PlayerStats>): void {
        this.playerStats = { ...this.playerStats, ...stats };
        eventBus.emit("player:health-changed", {
            health: this.playerStats.health,
            maxHealth: this.playerStats.maxHealth,
        });
    }

    getPlayerState(): PlayerState | undefined {
        if (!this.playerState) return undefined;

        return {
            stats: this.getPlayerStats(),
            abilities: { ...this.playerState.ability },
            position: new Phaser.Math.Vector2(
                this.playerState.sprite.x,
                this.playerState.sprite.y
            ),
            lastAimDirection: this.playerState.lastAimDirection.clone(),
            lastShotAt: this.playerState.lastShotAt,
            invulnUntil: this.playerState.invulnUntil,
        };
    }

    handleMovement(deltaTime: number, inputState: InputState): void {
        const activePilots = this.getActivePilots();
        activePilots.forEach((pilot) => {
            this.handlePlayerMovement(
                pilot,
                deltaTime,
                inputState.controls,
                inputState.binding
            );
        });
    }

    handleShooting(inputState: InputState): void {
        const activePilots = this.getActivePilots();
        activePilots.forEach((pilot) => {
            this.handlePlayerShooting(
                pilot,
                inputState.controls,
                inputState.binding,
                inputState.fireHeld || false
            );
        });
    }

    handleAbilities(inputState: InputState): void {
        const activePilots = this.getActivePilots();
        activePilots.forEach((pilot) => {
            this.handlePlayerAbilities(
                pilot,
                inputState.controls,
                inputState.binding
            );
        });
    }

    takeDamage(amount: number): void {
        this.playerStats.health = Math.max(0, this.playerStats.health - amount);

        eventBus.emit("player:health-changed", {
            health: this.playerStats.health,
            maxHealth: this.playerStats.maxHealth,
        });

        if (this.playerStats.health <= 0) {
            eventBus.emit("player:died", { playerId: "p1" });
        }
    }

    heal(amount: number): void {
        this.playerStats.health = Math.min(
            this.playerStats.maxHealth,
            this.playerStats.health + amount
        );

        eventBus.emit("player:health-changed", {
            health: this.playerStats.health,
            maxHealth: this.playerStats.maxHealth,
        });
    }

    isAlive(): boolean {
        return this.playerStats.health > 0;
    }

    // Private methods
    private setupInput(): void {
        const scene = this.getScene();
        this.cursors = scene.input.keyboard?.createCursorKeys();
        this.wasd = scene.input.keyboard?.addKeys("W,S,A,D,SHIFT") as Record<
            string,
            Phaser.Input.Keyboard.Key
        >;
    }

    private setupPlayersGroup(): void {
        const scene = this.getScene();
        this.playersGroup = scene.physics.add.group();
    }

    private spawnPlayers(): void {
        if (!this.playerSpawner) return;

        const { width, height } = this.playerSpawner.getGameDimensions();

        // Create player 1
        this.player = this.playerSpawner.createPlayer(
            width / 2 - 20,
            height / 2
        );

        // Create player 2 (initially inactive)
        this.player2 = this.playerSpawner.createInactivePlayer(
            width / 2 + 20,
            height / 2
        );

        this.playersGroup?.addMultiple([this.player, this.player2]);

        // Initialize pilot states
        if (this.pilotStateManager) {
            this.playerState = this.pilotStateManager.makePilotRuntime(
                "p1",
                this.player,
                {
                    type: "keyboardMouse",
                }
            );

            this.playerTwoState = this.pilotStateManager.makePilotRuntime(
                "p2",
                this.player2,
                {
                    type: "gamepad",
                }
            );
        }
    }

    private isPilotActive(pilot?: PilotRuntime): boolean {
        return this.pilotStateManager?.isPilotActive(pilot) ?? false;
    }

    private getActivePilots(): PilotRuntime[] {
        const pilots: PilotRuntime[] = [];

        if (this.isPilotActive(this.playerState) && this.playerState) {
            pilots.push(this.playerState);
        }

        // Twin mode would be handled by game mode configuration
        // if (this.runMode === 'twin' && this.isPilotActive(this.playerTwoState)) {
        //   pilots.push(this.playerTwoState!);
        // }

        return pilots;
    }

    private updatePilot(
        pilot: PilotRuntime,
        _time: number,
        deltaTime: number
    ): void {
        this.updateMomentumState(pilot, deltaTime);
        this.updateChargeStateForPilot(pilot, deltaTime, false); // fireHeld would come from input
        this.updateShieldVisual(pilot);
    }

    private handlePlayerMovement(
        pilot: PilotRuntime,
        _dt: number,
        controls: InputControls,
        binding: ControlBinding
    ): void {
        if (!this.isPilotActive(pilot)) return;

        const scene = this.getScene();
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
        const dir = new Phaser.Math.Vector2(0, 0);

        if (controls.move && controls.move.lengthSq() > 0) {
            dir.copy(controls.move);
        } else if (binding.type === "keyboardMouse") {
            dir.copy(this.readKeyboardDirection());
        }

        if (dir.lengthSq() > 0) {
            dir.normalize();
            body.setAcceleration(
                dir.x * this.playerStats.moveSpeed * 5,
                dir.y * this.playerStats.moveSpeed * 5
            );
        } else {
            body.setAcceleration(0, 0);
        }

        const isDashing = scene.time.now < pilot.ability.activeUntil;
        const speed = isDashing
            ? this.playerStats.moveSpeed * 2.2
            : this.playerStats.moveSpeed;
        body.setMaxSpeed(speed);

        const dashPressed =
            controls.dashPressed ||
            (binding.type === "keyboardMouse" &&
                this.wasd &&
                Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT));

        if (dashPressed) {
            this.tryDash(pilot, dir);
        }

        const aimDir = this.getAimDirection(
            pilot,
            controls,
            binding.type === "keyboardMouse"
        );
        pilot.sprite.rotation = Phaser.Math.Angle.Between(
            0,
            0,
            aimDir.x,
            aimDir.y
        );
        pilot.lastAimDirection.copy(aimDir);
    }

    private handlePlayerShooting(
        pilot: PilotRuntime,
        controls: InputControls,
        binding: ControlBinding,
        fireHeld: boolean
    ): void {
        if (!this.isPilotActive(pilot)) return;

        const fireRequested = fireHeld || controls.fireActive;
        if (!fireRequested) return;

        const scene = this.getScene();
        const fireRateBonus = 1 + pilot.momentum.bonus;
        const adjustedFireRate = this.playerStats.fireRate * fireRateBonus;
        const cooldown = 1000 / adjustedFireRate;

        if (scene.time.now < pilot.lastShotAt + cooldown) return;

        const useChargeMode = this.capacitorConfig.stacks > 0;
        const isCharged = useChargeMode && pilot.charge.ready;

        soundManager.playSfx("shoot");
        pilot.lastShotAt = scene.time.now;

        if (useChargeMode && isCharged) {
            pilot.charge.ready = false;
            pilot.charge.holdMs = 0;
        }

        // Get aim direction for the projectile
        const dir = this.getAimDirection(
            pilot,
            controls,
            binding.type === "keyboardMouse"
        );

        const baseDamage = this.playerStats.damage;
        const chargeDamageMultiplier = isCharged
            ? 1 + this.capacitorConfig.damageBonus
            : 1;
        const pierce =
            this.playerStats.pierce +
            (isCharged ? this.capacitorConfig.chargePierceBonus : 0);
        const bounce = this.playerStats.bounce;

        // Emit projectile fire event for projectile system to handle
        eventBus.emit("projectile:fired", {
            projectileId: `player-${Date.now()}`,
            type: "player",
            position: { x: pilot.sprite.x, y: pilot.sprite.y },
            direction: { x: dir.x, y: dir.y },
            damage: baseDamage * chargeDamageMultiplier,
            speed: this.playerStats.projectileSpeed,
            pierce: pierce,
            bounce: bounce,
            charged: isCharged,
        });
    }

    private handlePlayerAbilities(
        pilot: PilotRuntime,
        controls: InputControls,
        binding: ControlBinding
    ): void {
        // Handle dash ability
        const dashPressed =
            controls.dashPressed ||
            (binding.type === "keyboardMouse" &&
                this.wasd &&
                Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT));

        if (dashPressed) {
            const dir = new Phaser.Math.Vector2(0, 0);
            if (controls.move && controls.move.lengthSq() > 0) {
                dir.copy(controls.move);
            } else {
                dir.copy(this.readKeyboardDirection());
            }
            this.tryDash(pilot, dir);
        }
    }

    private readKeyboardDirection(): Phaser.Math.Vector2 {
        const dir = new Phaser.Math.Vector2(0, 0);

        if (this.cursors?.left.isDown || this.wasd?.A.isDown) dir.x -= 1;
        if (this.cursors?.right.isDown || this.wasd?.D.isDown) dir.x += 1;
        if (this.cursors?.up.isDown || this.wasd?.W.isDown) dir.y -= 1;
        if (this.cursors?.down.isDown || this.wasd?.S.isDown) dir.y += 1;

        return dir;
    }

    private getAimDirection(
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

    private getPointerAim(pilot: PilotRuntime): Phaser.Math.Vector2 {
        if (!this.isPilotActive(pilot)) return pilot.lastAimDirection.clone();

        const scene = this.getScene();
        const pointer = scene.input.activePointer;

        if (pointer) {
            const worldPoint = scene.cameras.main.getWorldPoint(
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

    private tryDash(pilot: PilotRuntime, direction: Phaser.Math.Vector2): void {
        const scene = this.getScene();
        const now = scene.time.now;

        if (now < pilot.ability.nextDashAt) return;
        if (direction.lengthSq() === 0) return;

        pilot.ability.nextDashAt = now + pilot.ability.dashCooldownMs;
        pilot.ability.activeUntil = now + pilot.ability.dashDurationMs;

        // Apply dash impulse
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
        const dashForce = 400;
        body.setVelocity(direction.x * dashForce, direction.y * dashForce);
    }

    private updateMomentumState(pilot: PilotRuntime, deltaTime: number): void {
        updateMomentum(
            pilot,
            deltaTime,
            this.momentumConfig,
            this.isPilotActive(pilot)
        );
    }

    private updateChargeStateForPilot(
        pilot: PilotRuntime,
        deltaTime: number,
        fireHeld: boolean
    ): void {
        updateChargeState(pilot, deltaTime, fireHeld, this.capacitorConfig);
    }

    private updateShieldVisual(pilot: PilotRuntime): void {
        this.pilotStateManager?.updateShieldVisual(pilot);
    }

    private setupEventListeners(): void {
        // Listen for upgrade events to update player stats
        eventBus.on("player:upgrade-selected", (data) => {
            this.handleUpgradeSelected(data.upgradeId);
        });
    }

    private handleUpgradeSelected(upgradeId: string): void {
        // This would be expanded to handle all upgrade types
        switch (upgradeId) {
            case "damage-boost":
                this.updatePlayerStats({ damage: this.playerStats.damage + 2 });
                break;
            case "speed-boost":
                this.updatePlayerStats({
                    moveSpeed: this.playerStats.moveSpeed + 20,
                });
                break;
            case "health-boost":
                this.updatePlayerStats({
                    maxHealth: this.playerStats.maxHealth + 1,
                    health: this.playerStats.health + 1,
                });
                break;
        }
    }
}
