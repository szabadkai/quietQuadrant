/**
 * Player system implementation
 * Handles player movement, input, stats, and abilities
 */

import * as Phaser from 'phaser';
import { soundManager } from '../../audio/SoundManager';
import type { ControlBinding } from '../../models/types';
import type { GamepadControlState } from '../input/GamepadAdapter';
import type { InputState } from '../types/InputTypes';
import { eventBus } from './EventBus';
import { BaseGameSystem } from './interfaces/GameSystem';
import type {
  AbilityState,
  IPlayerSystem,
  PlayerState,
  PlayerStats,
} from './interfaces/PlayerSystem';

const OBJECT_SCALE = 0.7;

export interface PilotRuntime {
  id: 'p1' | 'p2';
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

interface ChargeRuntime {
  ready: boolean;
  holdMs: number;
  damageBonus: number;
  sizeBonus: number;
  idleMs: number;
}

interface MomentumState {
  timerMs: number;
  bonus: number;
}

interface ShieldState {
  hp: number;
  activeUntil: number;
  nextReadyAt: number;
}

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
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;

  // Configuration objects (these would be managed by upgrade system in full implementation)
  private momentumConfig = { stacks: 0, ramp: 0.25, timeToMaxMs: 2000 };
  private capacitorConfig = {
    stacks: 0,
    damageBonus: 0.9,
    sizeBonus: 0.2,
    chargePierceBonus: 0,
  };

  constructor() {
    super('player-system', []);
  }

  protected onInitialize(): void {
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

    // Update each active pilot
    activePilots.forEach((pilot) => {
      this.updatePilot(pilot, time, dt);
    });
  }

  getPlayerStats(): PlayerStats {
    return { ...this.playerStats };
  }

  updatePlayerStats(stats: Partial<PlayerStats>): void {
    this.playerStats = { ...this.playerStats, ...stats };
    eventBus.emit('player:health-changed', {
      health: this.playerStats.health,
      maxHealth: this.playerStats.maxHealth,
    });
  }

  getPlayerState(): PlayerState | undefined {
    if (!this.playerState) return undefined;

    return {
      stats: this.getPlayerStats(),
      abilities: { ...this.playerState.ability },
      position: new Phaser.Math.Vector2(this.playerState.sprite.x, this.playerState.sprite.y),
      lastAimDirection: this.playerState.lastAimDirection.clone(),
      lastShotAt: this.playerState.lastShotAt,
      invulnUntil: this.playerState.invulnUntil,
    };
  }

  handleMovement(deltaTime: number, inputState: InputState): void {
    const activePilots = this.getActivePilots();
    activePilots.forEach((pilot) => {
      this.handlePlayerMovement(pilot, deltaTime, inputState.controls, inputState.binding);
    });
  }

  handleShooting(inputState: InputState): void {
    const activePilots = this.getActivePilots();
    activePilots.forEach((pilot) => {
      this.handlePlayerShooting(
        pilot,
        inputState.controls,
        inputState.binding,
        inputState.fireHeld
      );
    });
  }

  handleAbilities(inputState: InputState): void {
    const activePilots = this.getActivePilots();
    activePilots.forEach((pilot) => {
      this.handlePlayerAbilities(pilot, inputState.controls, inputState.binding);
    });
  }

  takeDamage(amount: number): void {
    this.playerStats.health = Math.max(0, this.playerStats.health - amount);

    eventBus.emit('player:health-changed', {
      health: this.playerStats.health,
      maxHealth: this.playerStats.maxHealth,
    });

    if (this.playerStats.health <= 0) {
      eventBus.emit('player:died', { playerId: 'p1' });
    }
  }

  heal(amount: number): void {
    this.playerStats.health = Math.min(
      this.playerStats.maxHealth,
      this.playerStats.health + amount
    );

    eventBus.emit('player:health-changed', {
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
    this.wasd = scene.input.keyboard?.addKeys('W,S,A,D,SHIFT') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  private setupPlayersGroup(): void {
    const scene = this.getScene();
    this.playersGroup = scene.physics.add.group();
  }

  private spawnPlayers(): void {
    const scene = this.getScene();
    const GAME_WIDTH = scene.scale.width;
    const GAME_HEIGHT = scene.scale.height;

    // Create player 1
    this.player = scene.physics.add
      .image(GAME_WIDTH / 2 - 20, GAME_HEIGHT / 2, 'player')
      .setScale(OBJECT_SCALE)
      .setDepth(1);

    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(0.95, 0.95);

    (this.player.body as Phaser.Physics.Arcade.Body).setSize(
      28 * OBJECT_SCALE,
      28 * OBJECT_SCALE,
      true
    );

    // Create player 2 (initially inactive)
    this.player2 = scene.physics.add
      .image(GAME_WIDTH / 2 + 20, GAME_HEIGHT / 2, 'player')
      .setScale(OBJECT_SCALE)
      .setDepth(1);

    this.player2.setCollideWorldBounds(true);
    this.player2.setDamping(true);
    this.player2.setDrag(0.95, 0.95);
    this.player2.setVisible(false);
    this.player2.setActive(false);

    (this.player2.body as Phaser.Physics.Arcade.Body).setSize(
      28 * OBJECT_SCALE,
      28 * OBJECT_SCALE,
      true
    );
    (this.player2.body as Phaser.Physics.Arcade.Body).enable = false;

    this.playersGroup?.addMultiple([this.player, this.player2]);

    // Initialize pilot states
    this.playerState = this.makePilotRuntime('p1', this.player, {
      type: 'keyboardMouse',
    });

    this.playerTwoState = this.makePilotRuntime('p2', this.player2, {
      type: 'gamepad',
    });
  }

  private makePilotRuntime(
    id: 'p1' | 'p2',
    sprite: Phaser.Physics.Arcade.Image,
    control: ControlBinding
  ): PilotRuntime {
    const scene = this.getScene();

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
        hasGamepad: !!scene.input.gamepad,
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

  private defaultAbility(): AbilityState {
    return {
      dashCooldownMs: 1600,
      dashDurationMs: 200,
      nextDashAt: 0,
      activeUntil: 0,
    };
  }

  private defaultChargeRuntime(): ChargeRuntime {
    return {
      ready: false,
      holdMs: 0,
      damageBonus: 0.9,
      sizeBonus: 0.2,
      idleMs: 1000,
    };
  }

  private defaultShieldState(): ShieldState {
    return { hp: 0, activeUntil: 0, nextReadyAt: 0 };
  }

  private defaultMomentumState(): MomentumState {
    return { timerMs: 0, bonus: 0 };
  }

  private isPilotActive(pilot?: PilotRuntime): boolean {
    if (!pilot) return false;
    const body = pilot.sprite.body as Phaser.Physics.Arcade.Body | null;
    return !!(body?.enable && pilot.sprite.active);
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

  private updatePilot(pilot: PilotRuntime, _time: number, deltaTime: number): void {
    this.updateMomentum(pilot, deltaTime);
    this.updateChargeState(pilot, deltaTime, false); // fireHeld would come from input
    this.updateShieldVisual(pilot);
  }

  private handlePlayerMovement(
    pilot: PilotRuntime,
    _dt: number,
    controls: GamepadControlState,
    binding: ControlBinding
  ): void {
    if (!this.isPilotActive(pilot)) return;

    const scene = this.getScene();
    const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
    const dir = new Phaser.Math.Vector2(0, 0);

    if (controls.move.lengthSq() > 0) {
      dir.copy(controls.move);
    } else if (binding.type === 'keyboardMouse') {
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
    const speed = isDashing ? this.playerStats.moveSpeed * 2.2 : this.playerStats.moveSpeed;
    body.setMaxSpeed(speed);

    const dashPressed =
      controls.dashPressed ||
      (binding.type === 'keyboardMouse' &&
        this.wasd &&
        Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT));

    if (dashPressed) {
      this.tryDash(pilot, dir);
    }

    const aimDir = this.getAimDirection(pilot, controls, binding.type === 'keyboardMouse');
    pilot.sprite.rotation = Phaser.Math.Angle.Between(0, 0, aimDir.x, aimDir.y);
    pilot.lastAimDirection.copy(aimDir);
  }

  private handlePlayerShooting(
    pilot: PilotRuntime,
    controls: GamepadControlState,
    binding: ControlBinding,
    fireHeld: boolean
  ): void {
    if (!this.isPilotActive(pilot)) return;

    const fireRequested = fireHeld || controls.fireActive;
    if (!fireRequested) return;

    const scene = this.getScene();
    const useChargeMode = this.capacitorConfig.stacks > 0;
    const isCharged = useChargeMode && pilot.charge.ready;

    const _dir = this.getAimDirection(pilot, controls, binding.type === 'keyboardMouse');
    const _spreadCount = this.playerStats.projectiles;

    soundManager.playSfx('shoot');

    const _baseDamage = this.playerStats.damage;
    const _chargeDamageMultiplier = isCharged ? 1 + this.capacitorConfig.damageBonus : 1;
    const _pierce =
      this.playerStats.pierce + (isCharged ? this.capacitorConfig.chargePierceBonus : 0);
    const _bounce = this.playerStats.bounce;

    const fireRateBonus = 1 + pilot.momentum.bonus;
    const adjustedFireRate = this.playerStats.fireRate * fireRateBonus;
    const cooldown = 1000 / adjustedFireRate;

    if (scene.time.now < pilot.lastShotAt + cooldown) return;

    pilot.lastShotAt = scene.time.now;

    if (useChargeMode && isCharged) {
      pilot.charge.ready = false;
      pilot.charge.holdMs = 0;
    }

    // Emit projectile fire event for projectile system to handle
    eventBus.emit('projectile:fired', {
      projectileId: `player-${Date.now()}`,
      type: 'player',
      position: { x: pilot.sprite.x, y: pilot.sprite.y },
    });
  }

  private handlePlayerAbilities(
    pilot: PilotRuntime,
    controls: GamepadControlState,
    binding: ControlBinding
  ): void {
    // Handle dash ability
    const dashPressed =
      controls.dashPressed ||
      (binding.type === 'keyboardMouse' &&
        this.wasd &&
        Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT));

    if (dashPressed) {
      const dir = controls.move.lengthSq() > 0 ? controls.move : this.readKeyboardDirection();
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
    controls: GamepadControlState,
    useKeyboardMouse: boolean
  ): Phaser.Math.Vector2 {
    if (useKeyboardMouse) {
      return this.getPointerAim(pilot);
    } else if (controls.aim.lengthSq() > 0.1) {
      return controls.aim.clone().normalize();
    }

    return pilot.lastAimDirection.clone();
  }

  private getPointerAim(pilot: PilotRuntime): Phaser.Math.Vector2 {
    if (!this.isPilotActive(pilot)) return pilot.lastAimDirection.clone();

    const scene = this.getScene();
    const pointer = scene.input.activePointer;

    if (pointer) {
      const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
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

  private updateMomentum(pilot: PilotRuntime, deltaTime: number): void {
    if (this.momentumConfig.stacks === 0 || !this.isPilotActive(pilot)) return;

    const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
    const isMoving = body.velocity.lengthSq() > 100;

    if (isMoving) {
      pilot.momentum.timerMs += deltaTime * 1000;
      const progress = Math.min(1, pilot.momentum.timerMs / this.momentumConfig.timeToMaxMs);
      pilot.momentum.bonus = progress * this.momentumConfig.ramp * this.momentumConfig.stacks;
    } else {
      pilot.momentum.timerMs = Math.max(0, pilot.momentum.timerMs - deltaTime * 1000 * 2);
      const progress = pilot.momentum.timerMs / this.momentumConfig.timeToMaxMs;
      pilot.momentum.bonus = progress * this.momentumConfig.ramp * this.momentumConfig.stacks;
    }
  }

  private updateChargeState(pilot: PilotRuntime, deltaTime: number, fireHeld: boolean): void {
    if (this.capacitorConfig.stacks === 0) return;

    if (fireHeld && !pilot.charge.ready) {
      pilot.charge.holdMs += deltaTime * 1000;
      if (pilot.charge.holdMs >= pilot.charge.idleMs) {
        pilot.charge.ready = true;
      }
    } else if (!fireHeld) {
      pilot.charge.holdMs = 0;
    }
  }

  private updateShieldVisual(pilot: PilotRuntime): void {
    const scene = this.getScene();
    const now = scene.time.now;
    const hasShield = pilot.shield.hp > 0 && now < pilot.shield.activeUntil;

    if (hasShield && !pilot.shieldRing) {
      pilot.shieldRing = scene.add.arc(
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

  private setupEventListeners(): void {
    // Listen for upgrade events to update player stats
    eventBus.on('player:upgrade-selected', (data) => {
      this.handleUpgradeSelected(data.upgradeId);
    });
  }

  private handleUpgradeSelected(upgradeId: string): void {
    // This would be expanded to handle all upgrade types
    switch (upgradeId) {
      case 'damage-boost':
        this.updatePlayerStats({ damage: this.playerStats.damage + 2 });
        break;
      case 'speed-boost':
        this.updatePlayerStats({
          moveSpeed: this.playerStats.moveSpeed + 20,
        });
        break;
      case 'health-boost':
        this.updatePlayerStats({
          maxHealth: this.playerStats.maxHealth + 1,
          health: this.playerStats.health + 1,
        });
        break;
    }
  }
}
