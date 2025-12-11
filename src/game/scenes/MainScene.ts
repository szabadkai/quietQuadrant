import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../GameConfig";
import { WAVES } from "../../config/waves";
import { getEnemyDefinition } from "../../config/enemies";
import {
  UPGRADE_CATALOG,
  getUpgradeDefinition,
} from "../../config/upgrades";
import { soundManager } from "../../audio/SoundManager";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { useMetaStore } from "../../state/useMetaStore";
import type { EnemySpawn, UpgradeDefinition } from "../../models/types";
import { GAME_EVENT_KEYS, gameEvents } from "../events";

const OBJECT_SCALE = 0.7;
const COLOR_ACCENT = 0x9ff0ff;
const COLOR_CHARGE = 0xf7d46b;
const COLOR_PULSE = 0xa0f4ff;
const COLOR_OVERLOAD = 0xffd7a6;
const XP_ATTRACT_RADIUS = 180;
const XP_ATTRACT_MIN_SPEED = 320;
const XP_ATTRACT_MAX_SPEED = 760;
const XP_ATTRACT_LERP_RATE = 10; // per-second factor for smoothing toward target velocity

type PlayerStats = {
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

type AbilityState = {
  dashCooldownMs: number;
  dashDurationMs: number;
  nextDashAt: number;
  activeUntil: number;
};

type UpgradeState = {
  [id: string]: number;
};

export class MainScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Image;
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
    critChance: 0.08,
    critMultiplier: 1.5,
  };
  private ability: AbilityState = {
    dashCooldownMs: 1600,
    dashDurationMs: 160,
    nextDashAt: 0,
    activeUntil: 0,
  };
  private chargeState = { ready: false, holdMs: 0, damageBonus: 0.9, sizeBonus: 0.2, idleMs: 1000 };
  private capacitorConfig = { stacks: 0, idleMs: 1000, damageBonus: 0.9, sizeBonus: 0.2, chargePierceBonus: 0 };
  private slowConfig = { stacks: 0, slowPercent: 0, durationMs: 0 };
  private overloadConfig = { stacks: 0, damage: 0, radius: 0, cooldownMs: 0, lastTriggerAt: 0 };
  private vacuumConfig = { stacks: 0, pullStrength: 0, durationMs: 0 };
  private afterimageConfig = { stacks: 0, trailShots: 0, shotDamage: 0 };
  private phaseConfig = { stacks: 0, pierce: 0, bounce: 0, damagePenaltyPerPierce: 0 };
  private threadConfig = { unlocked: false, refundPercent: 0.3, windowMs: 300, nextReadyAt: 0, cooldownMs: 1500 };
  private forkConfig = { stacks: 0, forks: 0, spreadDegrees: 18, forkDamagePercent: 55 };
  private edgeConfig = { stacks: 0, chargeExtensionMs: 0, bonusForks: 0, critBonusMultiplier: 0, critChanceBonus: 0 };
  private shieldConfig = { stacks: 0, shieldHp: 60, durationMs: 0, cooldownMs: 0, activeUntil: 0, hp: 0, nextReadyAt: 0 };
  private conductiveConfig = { stacks: 0, damage: 0, radius: 0, cooldownMs: 0, nextPulseAt: 0 };
  private iframeConfig = { unlocked: false, durationMs: 0, cooldownMs: 0, nextReadyAt: 0 };
  private pulseInheritance = { stacks: 0, potency: 0 };
  private explosiveConfig = { stacks: 0, radius: 0, damageMultiplier: 0 };
  private splitConfig = { enabled: false, forks: 2, spreadDegrees: 12, damageMultiplier: 0.5 };
  private chainArcConfig = { stacks: 0, range: 180, damagePercent: 0.6, cooldownMs: 150, lastAt: 0 };
  private kineticConfig = { stacks: 0, healAmount: 0.3, cooldownMs: 1200, nextReadyAt: 0 };
  private momentumConfig = { stacks: 0, ramp: 0.25, timeToMaxMs: 2000, timerMs: 0, bonus: 0 };
  private spreadConfig = { stacks: 0, spreadDegrees: 6, critBonus: 0 };
  private projectileScale = 1;
  private invulnUntil = 0;
  private difficulty = 1;
  private bossMaxHealth = 0;

  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private xpPickups!: Phaser.Physics.Arcade.Group;
  private lowGraphics = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private waveIndex = 0;
  private runActive = false;
  private runStartTime = 0;
  private xp = 0;
  private level = 1;
  private nextXpThreshold = 12;
  private pendingUpgradeOptions: UpgradeDefinition[] = [];
  private upgradeStacks: UpgradeState = {};
  private lastShotAt = 0;
  private nextWaveCheckAt = 0;
  private intermissionActive = false;
  private intermissionRemainingMs = 0;
  private pendingWaveIndex: number | null = null;
  private lastCountdownBroadcast = 0;
  private bossPhase = 1;
  private boss?: Phaser.Physics.Arcade.Image;
  private bossNextPatternAt = 0;
  private screenBounds!: Phaser.Geom.Rectangle;
  private elapsedAccumulator = 0;
  private shieldRing?: Phaser.GameObjects.Arc;

  constructor() {
    super("MainScene");
  }

  create() {
    this.screenBounds = new Phaser.Geom.Rectangle(32, 32, GAME_WIDTH - 64, GAME_HEIGHT - 64);
    this.physics.world.setBounds(
      this.screenBounds.x,
      this.screenBounds.y,
      this.screenBounds.width,
      this.screenBounds.height
    );
    this.setupVisuals();
    this.setupInput();
    this.setupGroups();
    this.setupCollisions();
  }

  startNewRun() {
    this.physics.world.resume();
    useRunStore.getState().actions.startRun();
    this.resetState();
    useUIStore.getState().actions.setScreen("inGame");
    gameEvents.emit(GAME_EVENT_KEYS.runStarted);
    this.runActive = true;
    this.runStartTime = this.time.now;
    this.beginWaveIntermission(0);
  }

  setPaused(paused: boolean) {
    if (paused) {
      this.physics.world.pause();
      useRunStore.getState().actions.setStatus("paused");
    } else {
      this.physics.world.resume();
      useRunStore.getState().actions.setStatus("running");
    }
  }

  private handleExplosiveImpact(
    projectile: Phaser.Physics.Arcade.Image,
    enemy: Phaser.Physics.Arcade.Image
  ) {
    if (this.explosiveConfig.stacks <= 0) return;
    const radius = this.explosiveConfig.radius;
    if (radius <= 0) return;
    const dmgMultiplier = this.explosiveConfig.damageMultiplier;
    const damage = (projectile.getData("damage") as number) * dmgMultiplier;
    const tags = (projectile.getData("tags") as string[] | undefined) ?? [];
    this.applyAoeDamage(enemy.x, enemy.y, radius, damage, tags, false);
    this.spawnBurstVisual(enemy.x, enemy.y, radius, COLOR_OVERLOAD, 0.8);
  }

  update(_: number, delta: number) {
    if (!this.runActive || !this.player) return;
    if (useRunStore.getState().status !== "running") return;
    const dt = delta / 1000;
    this.elapsedAccumulator += dt;
    if (this.elapsedAccumulator >= 0.2) {
      useRunStore.getState().actions.tick(this.elapsedAccumulator);
      this.elapsedAccumulator = 0;
    }

    this.handlePlayerMovement(dt);
    this.updateMomentum(dt);
    this.updateChargeState(dt);
    this.tickShieldTimers();
    this.handleShooting();
    this.handleEnemies();
    this.handleProjectileBounds();
    this.handleXpAttraction(dt);
    this.handleBossPatterns();
    this.handleWaveIntermission(dt);
    this.updateShieldVisual();

    if (!this.intermissionActive && this.enemies.countActive(true) === 0 && this.time.now > this.nextWaveCheckAt) {
      if (this.waveIndex < WAVES.length - 1) {
        this.beginWaveIntermission(this.waveIndex + 1);
      }
    }
  }

  applyUpgrade(id: string) {
    const def = getUpgradeDefinition(id);
    if (!def) return;
    const current = this.upgradeStacks[id] ?? 0;
    if (def.maxStacks && current >= def.maxStacks) return;
    this.upgradeStacks[id] = current + 1;
    this.pendingUpgradeOptions = [];
    useUIStore.getState().actions.closeUpgradeSelection();
    this.setPaused(false);
    this.applyUpgradeEffects(def);
    useRunStore.getState().actions.addUpgrade({
      id: def.id,
      stacks: this.upgradeStacks[id],
    });
  }

  private setupVisuals() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 16, GAME_HEIGHT - 16, 0x0b0f13, 1).setStrokeStyle(2, 0x1d2330);
    this.createTexture("player", (g) => {
      const c = 32;
      g.fillStyle(0x0f1b2d, 1);
      g.fillTriangle(c + 20, c, c - 12, c - 14, c - 12, c + 14);
      g.lineStyle(2, 0x9ff0ff);
      g.strokeTriangle(c + 20, c, c - 12, c - 14, c - 12, c + 14);
      g.fillStyle(0x7ad1ff, 1);
      g.fillTriangle(c + 6, c, c - 4, c - 6, c - 4, c + 6);
      g.fillStyle(0x11344d, 1);
      g.fillRect(c - 18, c - 8, 8, 4);
      g.fillRect(c - 18, c + 4, 8, 4);
      g.lineStyle(2, 0x9ff0ff, 0.9);
      g.lineBetween(c - 12, c - 10, c + 4, c - 4);
      g.lineBetween(c - 12, c + 10, c + 4, c + 4);
      g.fillStyle(0x9ff0ff, 0.8);
      g.fillRect(c - 6, c - 5, 10, 10);
    });
    this.createTexture("drifter", (g) => {
      const c = 32;
      g.lineStyle(3, 0xa8b0c2);
      g.strokeCircle(c, c, 16);
      g.lineStyle(2, 0x6dd6ff, 0.9);
      g.strokeCircle(c, c, 11);
      g.fillStyle(0x0d1a28, 1);
      g.fillCircle(c, c, 9);
      g.fillStyle(0x6dd6ff, 1);
      g.fillCircle(c, c, 5);
      g.fillStyle(0xa8b0c2, 1);
      g.fillRect(c - 4, c + 14, 8, 10);
      g.fillRect(c - 20, c - 2, 6, 10);
      g.fillRect(c + 14, c - 2, 6, 10);
    });
    this.createTexture("watcher", (g) => {
      const c = 32;
      g.fillStyle(0x0f1626, 1);
      g.fillRoundedRect(c - 16, c - 16, 32, 32, 6);
      g.lineStyle(3, 0x8aa3e0);
      g.strokeRoundedRect(c - 16, c - 16, 32, 32, 6);
      g.lineStyle(2, 0x6dd6ff, 0.8);
      g.lineBetween(c - 12, c, c + 12, c);
      g.lineBetween(c, c - 12, c, c + 12);
      g.fillStyle(0x6dd6ff, 1);
      g.fillCircle(c, c, 7);
      g.fillStyle(0x182744, 1);
      g.fillCircle(c, c, 4);
      g.fillStyle(0xf4f6fb, 0.8);
      g.fillCircle(c + 3, c - 2, 2);
    });
    this.createTexture("mass", (g) => {
      const c = 32;
      const hull = [
        { x: c, y: c - 20 },
        { x: c + 18, y: c },
        { x: c, y: c + 20 },
        { x: c - 18, y: c },
      ];
      g.fillStyle(0x26120f, 1);
      g.fillPoints(hull, true);
      g.lineStyle(3, 0xe0a86f);
      g.strokePoints(hull, true);
      g.fillStyle(0x6b3a21, 1);
      g.fillRect(c - 6, c - 10, 12, 7);
      g.lineStyle(2, 0xe0a86f, 0.8);
      g.lineBetween(c - 10, c - 4, c + 10, c - 4);
      g.lineBetween(c - 10, c + 4, c + 10, c + 4);
    });
    this.createTexture("boss", (g) => {
      const c = 32;
      g.fillStyle(0x180c13, 1);
      g.fillEllipse(c, c, 58, 40);
      g.lineStyle(4, 0xf14e4e);
      g.strokeEllipse(c, c, 58, 40);
      g.fillStyle(0x2a0f18, 1);
      g.fillEllipse(c, c, 46, 28);
      g.fillStyle(0xf14e4e, 0.8);
      g.fillEllipse(c, c, 32, 18);
      g.fillStyle(0xfafafa, 1);
      g.fillCircle(c + 2, c - 2, 6);
      g.fillStyle(0x0b0f13, 1);
      g.fillCircle(c + 4, c - 2, 3);
      g.lineStyle(3, 0xf14e4e, 0.9);
      g.beginPath();
      g.moveTo(c - 30, c - 10);
      g.lineTo(c - 18, c - 24);
      g.lineTo(c - 10, c - 6);
      g.strokePath();
      g.beginPath();
      g.moveTo(c + 30, c - 10);
      g.lineTo(c + 18, c - 24);
      g.lineTo(c + 10, c - 6);
      g.strokePath();
    });
    this.createTexture("bullet", (g) => {
      const c = 32;
      g.fillStyle(0xfafafa, 1);
      g.fillRoundedRect(c - 2, c - 12, 4, 18, 2);
      g.fillStyle(0x9ff0ff, 0.8);
      g.fillRoundedRect(c - 1, c - 14, 2, 6, 1);
    });
    this.createTexture("enemy-bullet", (g) => {
      const c = 32;
      g.fillStyle(0xf14e4e);
      g.fillRoundedRect(c - 2, c - 10, 4, 16, 2);
      g.fillStyle(0xffc2c2, 0.8);
      g.fillRoundedRect(c - 1, c - 12, 2, 5, 1);
    });
    this.createTexture("xp", (g) => {
      const c = 32;
      const gem = [
        { x: c, y: c - 8 },
        { x: c + 6, y: c },
        { x: c, y: c + 8 },
        { x: c - 6, y: c },
      ];
      g.fillStyle(0x6dd6ff, 1);
      g.fillPoints(gem, true);
      g.lineStyle(2, 0x9ff0ff, 0.9);
      g.strokePoints(gem, true);
      g.fillStyle(0xf4f6fb, 0.9);
      g.fillTriangle(c - 1, c - 4, c + 3, c, c - 1, c + 4);
    });
    this.spawnPlayer();
  }

  private spawnPlayer() {
    this.player = this.physics.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "player")
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
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey("W"),
      A: this.input.keyboard!.addKey("A"),
      S: this.input.keyboard!.addKey("S"),
      D: this.input.keyboard!.addKey("D"),
      SHIFT: this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes.SHIFT
      ),
    };
  }

  private setupGroups() {
    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 128,
      runChildUpdate: false,
    });
    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 256,
      runChildUpdate: false,
    });
    this.enemies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 128,
      runChildUpdate: false,
    });
    this.xpPickups = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 256,
      runChildUpdate: false,
    });
  }

  private setupCollisions() {
    this.physics.add.collider(
      this.enemies,
      this.enemies,
      (a, b) => this.handleEnemyCollide(a as Phaser.Physics.Arcade.Image, b as Phaser.Physics.Arcade.Image),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      (obj1, obj2) =>
        this.handleBulletHitEnemy(
          obj1 as Phaser.GameObjects.GameObject,
          obj2 as Phaser.GameObjects.GameObject
        ),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player!,
      this.enemies,
      (_player, enemy) => this.handlePlayerDamage(enemy as Phaser.Physics.Arcade.Image, 1, true),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player!,
      this.enemyBullets,
      (_player, bullet) => {
        bullet.destroy();
        this.handlePlayerDamage(bullet as Phaser.Physics.Arcade.Image, 1, false);
      },
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player!,
      this.xpPickups,
      (_player, pickup) => this.collectXp(pickup as Phaser.Physics.Arcade.Image),
      undefined,
      this
    );
  }

  private resetState() {
    const settings = useMetaStore.getState().settings;
    this.lowGraphics = settings.lowGraphicsMode;
    this.difficulty = 1;
    this.playerStats = {
      moveSpeed: 240,
      damage: 12,
      fireRate: 4,
      projectileSpeed: 520,
      projectiles: 1,
      pierce: 0,
      bounce: 0,
      maxHealth: 5,
      health: 5,
      critChance: 0.08,
      critMultiplier: 1.5,
    };
    this.chargeState = { ready: false, holdMs: 0, damageBonus: 0.9, sizeBonus: 0.2, idleMs: 1000 };
    this.capacitorConfig = { stacks: 0, idleMs: 1000, damageBonus: 0.9, sizeBonus: 0.2, chargePierceBonus: 0 };
    this.slowConfig = { stacks: 0, slowPercent: 0, durationMs: 0 };
    this.overloadConfig = { stacks: 0, damage: 0, radius: 0, cooldownMs: 0, lastTriggerAt: 0 };
    this.vacuumConfig = { stacks: 0, pullStrength: 0, durationMs: 0 };
    this.afterimageConfig = { stacks: 0, trailShots: 0, shotDamage: 0 };
    this.phaseConfig = { stacks: 0, pierce: 0, bounce: 0, damagePenaltyPerPierce: 0 };
    this.threadConfig = { unlocked: false, refundPercent: 0.3, windowMs: 300, nextReadyAt: 0, cooldownMs: 1500 };
    this.forkConfig = { stacks: 0, forks: 0, spreadDegrees: 18, forkDamagePercent: 55 };
    this.edgeConfig = { stacks: 0, chargeExtensionMs: 0, bonusForks: 0, critBonusMultiplier: 0, critChanceBonus: 0 };
    this.shieldConfig = { stacks: 0, shieldHp: 60, durationMs: 0, cooldownMs: 0, activeUntil: 0, hp: 0, nextReadyAt: 0 };
    this.conductiveConfig = { stacks: 0, damage: 0, radius: 0, cooldownMs: 0, nextPulseAt: 0 };
    this.iframeConfig = { unlocked: false, durationMs: 0, cooldownMs: 0, nextReadyAt: 0 };
    this.pulseInheritance = { stacks: 0, potency: 0 };
    this.explosiveConfig = { stacks: 0, radius: 0, damageMultiplier: 0 };
    this.splitConfig = { enabled: false, forks: 2, spreadDegrees: 12, damageMultiplier: 0.5 };
    this.chainArcConfig = { stacks: 0, range: 180, damagePercent: 0.6, cooldownMs: 150, lastAt: 0 };
    this.kineticConfig = { stacks: 0, healAmount: 0.3, cooldownMs: 1200, nextReadyAt: 0 };
    this.momentumConfig = { stacks: 0, ramp: 0.25, timeToMaxMs: 2000, timerMs: 0, bonus: 0 };
    this.spreadConfig = { stacks: 0, spreadDegrees: 6, critBonus: 0 };
    this.projectileScale = 1;
    this.invulnUntil = 0;
    this.ability = {
      dashCooldownMs: 1600,
      dashDurationMs: 160,
      nextDashAt: 0,
      activeUntil: 0,
    };
    this.waveIndex = 0;
    this.xp = 0;
    this.level = 1;
    this.nextXpThreshold = 12;
    this.upgradeStacks = {};
    this.pendingUpgradeOptions = [];
    this.lastShotAt = this.time.now;
    this.nextWaveCheckAt = 0;
    this.intermissionActive = false;
    this.pendingWaveIndex = null;
    this.intermissionRemainingMs = 0;
    this.lastCountdownBroadcast = 0;
    this.bossPhase = 1;
    this.bossNextPatternAt = 0;
    this.runActive = false;
    this.elapsedAccumulator = 0;
    this.bossMaxHealth = 0;

    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.xpPickups.clear(true, true);
    this.player?.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    body?.setAcceleration(0, 0);
    const actions = useRunStore.getState().actions;
    actions.setVitals(this.playerStats.health, this.playerStats.maxHealth);
    actions.setXp(this.level, this.xp, this.nextXpThreshold);
    actions.setWaveCountdown(null, null);
    if (this.shieldRing) {
      this.shieldRing.setVisible(false);
    }
  }

  private handlePlayerMovement(_dt: number) {
    if (!this.player) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left?.isDown || this.wasd.A.isDown) dir.x -= 1;
    if (this.cursors.right?.isDown || this.wasd.D.isDown) dir.x += 1;
    if (this.cursors.up?.isDown || this.wasd.W.isDown) dir.y -= 1;
    if (this.cursors.down?.isDown || this.wasd.S.isDown) dir.y += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      body.setAcceleration(dir.x * this.playerStats.moveSpeed * 5, dir.y * this.playerStats.moveSpeed * 5);
    } else {
      body.setAcceleration(0, 0);
    }

    const isDashing = this.time.now < this.ability.activeUntil;
    const speed = isDashing ? this.playerStats.moveSpeed * 2.2 : this.playerStats.moveSpeed;
    body.setMaxSpeed(speed);

    if (Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT)) {
      this.tryDash(dir);
    }

    this.player.rotation = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.input.activePointer.worldX,
      this.input.activePointer.worldY
    );

    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.screenBounds.left,
      this.screenBounds.right
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.screenBounds.top,
      this.screenBounds.bottom
    );
  }

  private updateChargeState(dt: number) {
    if (this.capacitorConfig.stacks === 0) return;
    const pointerDown =
      this.input.activePointer?.isDown || this.input.mousePointer?.isDown;
    if (pointerDown) {
      this.chargeState.holdMs = Math.min(
        this.capacitorConfig.idleMs,
        this.chargeState.holdMs + dt * 1000
      );
      if (this.chargeState.holdMs >= this.capacitorConfig.idleMs) {
        this.chargeState.ready = true;
      }
    } else {
      this.chargeState.holdMs = 0;
      this.chargeState.ready = false;
    }
  }

  private updateMomentum(dt: number) {
    if (this.momentumConfig.stacks === 0 || !this.player) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();
    const moving = speed > 30;
    if (moving) {
      this.momentumConfig.timerMs = Math.min(
        this.momentumConfig.timeToMaxMs,
        this.momentumConfig.timerMs + dt * 1000
      );
    } else {
      this.momentumConfig.timerMs = Math.max(0, this.momentumConfig.timerMs - dt * 800);
    }
    const ratio = Phaser.Math.Clamp(
      this.momentumConfig.timerMs / this.momentumConfig.timeToMaxMs,
      0,
      1
    );
    this.momentumConfig.bonus = this.momentumConfig.ramp * ratio;
  }

  private tickShieldTimers() {
    if (this.shieldConfig.hp > 0 && this.time.now > this.shieldConfig.activeUntil) {
      this.shieldConfig.hp = 0;
      this.shieldConfig.activeUntil = 0;
    }
  }

  private tryDash(dir: Phaser.Math.Vector2) {
    if (this.time.now < this.ability.nextDashAt) return;
    const dashDir = dir.lengthSq() > 0 ? dir.clone().normalize() : new Phaser.Math.Vector2(1, 0);
    const body = this.player!.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dashDir.x * this.playerStats.moveSpeed * 3, dashDir.y * this.playerStats.moveSpeed * 3);
    this.ability.activeUntil = this.time.now + this.ability.dashDurationMs;
    this.ability.nextDashAt = this.time.now + this.ability.dashCooldownMs;
    this.spawnDashTrail(new Phaser.Math.Vector2(this.player!.x, this.player!.y), dashDir);
    this.spawnAfterimageShots(dashDir);
  }

  private handleShooting() {
    if (!this.player) return;
    const pointer = this.input.activePointer;
    if (!pointer.isDown && !this.input.mousePointer?.isDown) return;

    const useChargeMode = this.capacitorConfig.stacks > 0;
    const isCharged = useChargeMode && this.chargeState.ready;
    const dir = new Phaser.Math.Vector2(
      pointer.worldX - this.player.x,
      pointer.worldY - this.player.y
    ).normalize();
    const spreadCount = this.playerStats.projectiles;
    const spreadStepDeg = this.spreadConfig.spreadDegrees;
    soundManager.playSfx("shoot");
    const baseDamage = this.playerStats.damage;
    const chargeDamageMultiplier = isCharged ? 1 + this.capacitorConfig.damageBonus : 1;
    const sizeScale = isCharged ? 1 + this.capacitorConfig.sizeBonus : 1;
    const pierce = this.playerStats.pierce + (isCharged ? this.capacitorConfig.chargePierceBonus : 0);
    const bounce = this.playerStats.bounce;
    const tags = this.buildProjectileTags(isCharged);
    const fireRateBonus = 1 + this.momentumConfig.bonus;
    const adjustedFireRate = this.playerStats.fireRate * fireRateBonus;
    const cooldown = 1000 / adjustedFireRate;
    if (this.time.now < this.lastShotAt + cooldown) return;
    this.lastShotAt = this.time.now;
    if (useChargeMode && isCharged) {
      this.chargeState.ready = false;
      this.chargeState.holdMs = 0;
    }

    for (let i = 0; i < spreadCount; i++) {
      const offset =
        spreadCount <= 1
          ? 0
          : (i - (spreadCount - 1) / 2) * Phaser.Math.DegToRad(spreadStepDeg);
      const shotDir = dir.clone().rotate(offset);
      this.spawnBullet({
        x: this.player.x,
        y: this.player.y,
        dir: shotDir,
        damage: baseDamage * chargeDamageMultiplier,
        pierce,
        bounce,
        sizeMultiplier: sizeScale,
        tags,
        charged: isCharged,
        sourceType: "primary",
      });
    }
    if (isCharged) {
      this.spawnMuzzleFlash(this.player.x, this.player.y);
    }
  }

  private spawnBullet(config: {
    x: number;
    y: number;
    dir: Phaser.Math.Vector2;
    damage: number;
    pierce: number;
    bounce: number;
    tags: string[];
    charged?: boolean;
    sizeMultiplier?: number;
    sourceType?: string;
  }) {
    const bullet = this.bullets.get(
      config.x,
      config.y,
      "bullet"
    ) as Phaser.Physics.Arcade.Image;
    if (!bullet) return null;
    const sizeScale = (config.sizeMultiplier ?? 1) * this.projectileScale * OBJECT_SCALE;
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(sizeScale);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      8 * sizeScale,
      24 * sizeScale,
      true
    );
    body.setVelocity(config.dir.x * this.playerStats.projectileSpeed, config.dir.y * this.playerStats.projectileSpeed);
    bullet.setRotation(config.dir.angle());
    bullet.setData("pierce", config.pierce);
    bullet.setData("damage", config.damage);
    bullet.setData("bounces", config.bounce);
    bullet.setData("tags", config.tags);
    bullet.setData("charged", config.charged === true);
    bullet.setData("sourceType", config.sourceType ?? "primary");
    bullet.setData("hitCount", 0);
    bullet.setData("lastHitAt", 0);
    bullet.setData("canFork", true);
    bullet.setTint(config.charged ? COLOR_CHARGE : COLOR_ACCENT);
    return bullet;
  }

  private buildProjectileTags(isCharged: boolean): string[] {
    const tags = ["projectile"];
    if (this.slowConfig.stacks > 0) tags.push("slow", "beam");
    if (isCharged) tags.push("charge");
    return tags;
  }

  private spawnAfterimageShots(dir: Phaser.Math.Vector2) {
    if (this.afterimageConfig.trailShots <= 0) return;
    if (!this.player) return;
    const shots = this.afterimageConfig.trailShots;
    const spacing = 18;
    const tags = this.buildProjectileTags(false).concat(["afterimage"]);
    for (let i = 1; i <= shots; i++) {
      const offset = dir.clone().scale(-spacing * i);
      const pos = new Phaser.Math.Vector2(this.player!.x + offset.x, this.player!.y + offset.y);
      const pierce = this.phaseConfig.pierce;
      const bounce = this.phaseConfig.bounce;
      const penalty = this.phaseConfig.damagePenaltyPerPierce;
      const damagePenalty =
        pierce > 0 && penalty !== 0 ? Math.max(0.4, 1 + (penalty / 100) * pierce) : 1;
      this.spawnBullet({
        x: pos.x,
        y: pos.y,
        dir,
        damage: this.afterimageConfig.shotDamage * damagePenalty,
        pierce,
        bounce,
        tags,
        charged: false,
        sourceType: "afterimage",
      });
    }
  }

  private spawnDashTrail(origin: Phaser.Math.Vector2, dir: Phaser.Math.Vector2) {
    if (this.lowGraphics) return;
    const length = 42 * OBJECT_SCALE;
    const width = 6 * OBJECT_SCALE;
    const angle = dir.angle();
    const rect = this.add
      .rectangle(origin.x, origin.y, length, width, COLOR_ACCENT, 0.35)
      .setRotation(angle)
      .setDepth(0.6);
    this.tweens.add({
      targets: rect,
      alpha: { from: 0.35, to: 0 },
      scaleX: { from: 1, to: 0.6 },
      duration: 180,
      onComplete: () => rect.destroy(),
    });
  }

  private spawnMuzzleFlash(x: number, y: number) {
    if (this.lowGraphics) return;
    const flash = this.add.circle(x, y, 10 * OBJECT_SCALE, COLOR_CHARGE, 0.35).setDepth(2);
    this.tweens.add({
      targets: flash,
      scale: { from: 0.6, to: 1.4 },
      alpha: { from: 0.35, to: 0 },
      duration: 140,
      onComplete: () => flash.destroy(),
    });
  }

  private spawnBurstVisual(
    x: number,
    y: number,
    radius: number,
    color: number,
    strokeOpacity = 0.7
  ) {
    if (this.lowGraphics) return;
    const circle = this.add
      .circle(x, y, radius, color, 0.08)
      .setStrokeStyle(2, color, strokeOpacity)
      .setDepth(0.5);
    this.tweens.add({
      targets: circle,
      alpha: { from: 0.8, to: 0 },
      scale: { from: 0.9, to: 1.15 },
      duration: 200,
      onComplete: () => circle.destroy(),
    });
  }

  private spawnVacuumRing(x: number, y: number, radius: number) {
    if (this.lowGraphics) return;
    const ring = this.add
      .circle(x, y, radius, COLOR_PULSE, 0.05)
      .setStrokeStyle(1, COLOR_PULSE, 0.5)
      .setDepth(0.4);
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.5, to: 0 },
      scale: { from: 1, to: 0.85 },
      duration: 200,
      onComplete: () => ring.destroy(),
    });
  }

  private updateShieldVisual() {
    if (!this.shieldRing || !this.player) return;
    const active = this.shieldConfig.hp > 0 && this.time.now <= this.shieldConfig.activeUntil;
    this.shieldRing.setVisible(active);
    if (!active) return;
    this.shieldRing.setPosition(this.player.x, this.player.y);
    const remaining = this.shieldConfig.activeUntil - this.time.now;
    const alpha = Phaser.Math.Clamp(remaining / this.shieldConfig.durationMs, 0.3, 0.8);
    this.shieldRing.setAlpha(alpha);
    const pulse = 1 + Math.sin(this.time.now / 120) * 0.06;
    this.shieldRing.setScale(pulse);
  }

  private handleEnemies() {
    const player = this.player!;
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active || !enemy.visible) return;
      const kind = enemy.getData("kind") as string;
      const speed = enemy.getData("speed") as number;
      const slowUntil = enemy.getData("slowUntil") as number | undefined;
      const slowFactor =
        slowUntil && slowUntil > this.time.now
          ? (enemy.getData("slowFactor") as number | undefined) ?? 1
          : 1;
      const targetVec = new Phaser.Math.Vector2(player.x - enemy.x, player.y - enemy.y);
      const dist = targetVec.length();
      targetVec.normalize();

      if (kind === "drifter") {
        enemy.setVelocity(targetVec.x * speed * slowFactor, targetVec.y * speed * slowFactor);
      } else if (kind === "watcher") {
        if (dist > 260) {
          enemy.setVelocity(targetVec.x * speed * slowFactor, targetVec.y * speed * slowFactor);
        } else if (dist < 180) {
          enemy.setVelocity(-targetVec.x * speed * slowFactor, -targetVec.y * speed * slowFactor);
        } else {
          enemy.setVelocity(0, 0);
        }
        this.tryEnemyShot(enemy, player);
      } else if (kind === "mass") {
        enemy.setVelocity(targetVec.x * speed * 0.7 * slowFactor, targetVec.y * speed * 0.7 * slowFactor);
        this.tryEnemyShot(enemy, player, true);
      } else if (kind === "boss") {
        enemy.setVelocity(0, 0);
      }
    });
  }

  private handleEnemyCollide(enemyA: Phaser.Physics.Arcade.Image, enemyB: Phaser.Physics.Arcade.Image) {
    const bodyA = enemyA.body as Phaser.Physics.Arcade.Body | null;
    const bodyB = enemyB.body as Phaser.Physics.Arcade.Body | null;
    if (!bodyA || !bodyB) return;

    // Skip nudging the boss so it stays anchored.
    if (enemyA.getData("kind") === "boss" || enemyB.getData("kind") === "boss") {
      return;
    }

    // Apply a gentle impulse so clumps loosen rather than sticking together.
    const dx = bodyA.x - bodyB.x;
    const dy = bodyA.y - bodyB.y;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0) return;
    const dist = Math.sqrt(distSq);
    const strength = 40;
    const nx = dx / dist;
    const ny = dy / dist;
    bodyA.velocity.x += nx * strength;
    bodyA.velocity.y += ny * strength;
    bodyB.velocity.x -= nx * strength;
    bodyB.velocity.y -= ny * strength;
  }

  private handleXpAttraction(dt: number) {
    if (!this.player) return;
    const px = this.player.x;
    const py = this.player.y;
    const maxDistSq = XP_ATTRACT_RADIUS * XP_ATTRACT_RADIUS;
    const lerp = Phaser.Math.Clamp(dt * XP_ATTRACT_LERP_RATE, 0, 1);

    this.xpPickups.getChildren().forEach((child) => {
      const pickup = child as Phaser.Physics.Arcade.Image;
      if (!pickup.active || !pickup.visible) return;

      const dx = px - pickup.x;
      const dy = py - pickup.y;
      const distSq = dx * dx + dy * dy;
      const body = pickup.body as Phaser.Physics.Arcade.Body;
      const alreadyMagnetized = pickup.getData("magnetized") === true;
      if (!alreadyMagnetized && distSq > maxDistSq) return;
      if (distSq <= maxDistSq) {
        pickup.setData("magnetized", true);
      }

      const dist = Math.max(Math.sqrt(distSq), 1);
      const dirX = dx / dist;
      const dirY = dy / dist;
      const proximity = Phaser.Math.Clamp(1 - Math.min(dist, XP_ATTRACT_RADIUS) / XP_ATTRACT_RADIUS, 0, 1);
      const targetSpeed = Phaser.Math.Linear(XP_ATTRACT_MIN_SPEED, XP_ATTRACT_MAX_SPEED, proximity);
      const targetVx = dirX * targetSpeed;
      const targetVy = dirY * targetSpeed;

      body.velocity.x = Phaser.Math.Linear(body.velocity.x, targetVx, lerp);
      body.velocity.y = Phaser.Math.Linear(body.velocity.y, targetVy, lerp);
    });
  }

  private handleBossPatterns() {
    if (!this.boss || !this.boss.active) return;
    if (this.time.now < this.bossNextPatternAt) return;
    this.fireBossPattern();
  }

  private fireBossPattern() {
    if (!this.boss) return;
    const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
    if (this.bossPhase === 1) {
      for (let i = 0; i < 10; i++) {
        const angle = Phaser.Math.DegToRad((360 / 10) * i);
        const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
        this.spawnEnemyBullet(center.x, center.y, dir, 220 * this.difficulty);
      }
      this.bossNextPatternAt = this.time.now + 1600 / this.difficulty;
    } else if (this.bossPhase === 2) {
      const target = new Phaser.Math.Vector2(this.player!.x, this.player!.y).subtract(center).normalize();
      for (let i = -2; i <= 2; i++) {
        const dir = target.clone().rotate(Phaser.Math.DegToRad(i * 12));
        this.spawnEnemyBullet(center.x, center.y, dir, 240 * this.difficulty);
      }
      this.bossNextPatternAt = this.time.now + 1200 / this.difficulty;
    } else {
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 16; i++) {
          const angle = Phaser.Math.DegToRad((360 / 16) * i + ring * 8);
          const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
          this.spawnEnemyBullet(center.x, center.y, dir, (260 + ring * 40) * this.difficulty);
        }
      }
      this.bossNextPatternAt = this.time.now + 1000 / this.difficulty;
    }
  }

  private tryEnemyShot(
    enemy: Phaser.Physics.Arcade.Image,
    player: Phaser.Physics.Arcade.Image,
    heavy?: boolean
  ) {
    const nextFire = enemy.getData("nextFire") as number;
    const fireCooldown = enemy.getData("fireCooldown") as number;
    if (!fireCooldown || this.time.now < nextFire) return;

    const dir = new Phaser.Math.Vector2(player.x - enemy.x, player.y - enemy.y).normalize();
    const speed = enemy.getData("projectileSpeed") as number;
    this.spawnEnemyBullet(enemy.x, enemy.y, dir, speed, heavy);
    enemy.setData("nextFire", this.time.now + fireCooldown * 1000);
  }

  private spawnEnemyBullet(
    x: number,
    y: number,
    dir: Phaser.Math.Vector2,
    speed: number,
    heavy = false
  ) {
    const bullet = this.enemyBullets.get(x, y, "enemy-bullet") as Phaser.Physics.Arcade.Image;
    if (!bullet) return;
    bullet.setActive(true);
    bullet.setVisible(true);
    const scale = OBJECT_SCALE * (heavy ? 1.4 : 1);
    bullet.setScale(scale);
    (bullet.body as Phaser.Physics.Arcade.Body).setSize(
      8 * scale,
      20 * scale,
      true
    );
    bullet.setVelocity(dir.x * speed, dir.y * speed);
    bullet.setData("damage", heavy ? 2 : 1);
  }

  private handleBulletHitEnemy = (
    bullet: Phaser.GameObjects.GameObject,
    target: Phaser.GameObjects.GameObject
  ) => {
    const projectile = bullet as Phaser.Physics.Arcade.Image;
    const enemy = target as Phaser.Physics.Arcade.Image;
    const damage = projectile.getData("damage") as number;
    const pierceLeft = projectile.getData("pierce") as number;
    this.handleThreadNeedle(projectile);
    this.applyDamageToEnemy(enemy, damage, projectile);
    this.handleForks(projectile, enemy);
    this.handleExplosiveImpact(projectile, enemy);

    if (pierceLeft > 0) {
      projectile.setData("pierce", pierceLeft - 1);
    } else {
      projectile.destroy();
    }
  };

  private applyDamageToEnemy(
    enemy: Phaser.Physics.Arcade.Image,
    damage: number,
    source?: Phaser.Physics.Arcade.Image,
    opts?: { tags?: string[]; slowPotencyMultiplier?: number; isPulse?: boolean }
  ) {
    if (!enemy.active) return;
    const now = this.time.now;
    const tags = opts?.tags ?? (source?.getData("tags") as string[] | undefined);
    const charged = source?.getData("charged") === true;
    const sourceType = source?.getData("sourceType") as string | undefined;
    const slowPotency = opts?.slowPotencyMultiplier ?? 1;
    if (!opts?.isPulse) {
      let critChance = this.playerStats.critChance;
      if (charged) critChance += this.edgeConfig.critChanceBonus;
      if (Math.random() < critChance) {
        damage *= this.playerStats.critMultiplier + this.edgeConfig.critBonusMultiplier;
      }
    }

    enemy.setData("lastHitTags", tags);
    enemy.setData("lastHitCharged", charged);
    enemy.setData("lastHitAt", now);
    enemy.setData("lastHitSourceType", sourceType ?? "");

    if (tags?.includes("slow") && this.slowConfig.stacks > 0) {
      const slowPct = Math.min(0.95, (this.slowConfig.slowPercent / 100) * slowPotency);
      if (slowPct > 0) {
        this.applySlow(enemy, slowPct, this.slowConfig.durationMs * slowPotency);
      }
    }

    const current = enemy.getData("health") as number;
    const remaining = current - damage;
    enemy.setData("health", remaining);
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(50, () => {
      if (enemy.active) enemy.clearTint();
    });

    if (remaining <= 0) {
      this.handleEnemyDeath(enemy, tags);
    } else if ((enemy.getData("kind") as string) === "boss") {
      this.handleBossPhaseChange();
    }

    // edge extension removed with simplified charge; no-op
  }

  private applySlow(enemy: Phaser.Physics.Arcade.Image, slowPercent: number, durationMs: number) {
    const factor = Math.max(0.05, 1 - slowPercent);
    const expireAt = this.time.now + durationMs;
    const existingExpire = enemy.getData("slowUntil") as number | undefined;
    const existingFactor = enemy.getData("slowFactor") as number | undefined;
    const nextExpire = existingExpire && existingExpire > expireAt ? existingExpire : expireAt;
    const nextFactor = existingFactor ? Math.min(existingFactor, factor) : factor;
    enemy.setData("slowUntil", nextExpire);
    enemy.setData("slowFactor", nextFactor);
  }

  private handleForks(projectile: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image) {
    const charged = projectile.getData("charged");
    const canSplit = this.splitConfig.enabled;
    if (!charged && !canSplit) return;
    if (!projectile.getData("canFork")) return;
    const sourceType = projectile.getData("sourceType") as string;
    if (sourceType === "fork") return;

    let forks = 0;
    let spreadDeg = 0;
    let damageMultiplier = 1;

    if (charged && this.forkConfig.forks > 0) {
      forks = this.forkConfig.forks + this.edgeConfig.bonusForks;
      spreadDeg = this.forkConfig.spreadDegrees;
      damageMultiplier = this.forkConfig.forkDamagePercent / 100;
    } else if (!charged && this.splitConfig.enabled) {
      forks = this.splitConfig.forks;
      spreadDeg = this.splitConfig.spreadDegrees;
      damageMultiplier = this.splitConfig.damageMultiplier;
    }

    if (forks <= 0) return;

    projectile.setData("canFork", false);
    const spreadRad = Phaser.Math.DegToRad(spreadDeg);
    const baseDir = new Phaser.Math.Vector2(enemy.x - projectile.x, enemy.y - projectile.y).normalize();
    const totalSpread = Math.max(spreadRad, 0.01);
    const step = forks > 1 ? totalSpread / (forks - 1) : 0;
    const start = -totalSpread / 2;

    for (let i = 0; i < forks; i++) {
      const dir = baseDir.clone().rotate(start + step * i);
      const tags = (projectile.getData("tags") as string[] | undefined) ?? [];
      this.spawnBullet({
        x: projectile.x,
        y: projectile.y,
        dir,
        damage: projectile.getData("damage") * damageMultiplier,
        pierce: projectile.getData("pierce"),
        bounce: projectile.getData("bounces") ?? 0,
        tags,
        charged: false,
        sourceType: "fork",
      });
    }
  }

  private handleThreadNeedle(projectile: Phaser.Physics.Arcade.Image) {
    if (!this.threadConfig.unlocked) return;
    const now = this.time.now;
    if (now < this.threadConfig.nextReadyAt) return;
    const lastHit = projectile.getData("lastHitAt") as number;
    let hits = projectile.getData("hitCount") as number;
    if (!lastHit || now - lastHit > this.threadConfig.windowMs) {
      hits = 0;
    }
    hits += 1;
    projectile.setData("hitCount", hits);
    projectile.setData("lastHitAt", now);
    if (hits >= 2) {
      this.threadConfig.nextReadyAt = now + this.threadConfig.cooldownMs;
      const refund = this.ability.dashCooldownMs * this.threadConfig.refundPercent;
      this.ability.nextDashAt = Math.max(now, this.ability.nextDashAt - refund);
    }
  }

  private applyAoeDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    sourceTags: string[] = [],
    isPulse = false
  ) {
    const tags = new Set<string>(["aoe"]);
    if (isPulse) tags.add("pulse");
    sourceTags.forEach((t) => tags.add(t));
    const applySlowPotency = this.pulseInheritance.stacks > 0 && sourceTags.includes("slow");
    let hitAny = false;
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= radius + 2) {
        hitAny = true;
        const potency = applySlowPotency
          ? this.pulseInheritance.potency
          : 1;
        this.applyDamageToEnemy(enemy, damage, undefined, {
          tags: Array.from(tags),
          slowPotencyMultiplier: potency,
          isPulse,
        });
        if (this.vacuumConfig.stacks > 0) {
          this.applyVacuumPull(enemy, x, y, radius);
        }
      }
    });
    if (hitAny) {
      if (isPulse) {
        this.spawnBurstVisual(x, y, radius, COLOR_PULSE, 0.6);
        this.maybeGrantInvulnFromPulse();
      }
      if (this.vacuumConfig.stacks > 0) {
        this.spawnVacuumRing(x, y, radius);
      }
    }
  }

  private applyVacuumPull(
    enemy: Phaser.Physics.Arcade.Image,
    cx: number,
    cy: number,
    radius: number
  ) {
    if (radius <= 0) return;
    if (!enemy.active) return;
    const dx = cx - enemy.x;
    const dy = cy - enemy.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const strength = this.vacuumConfig.pullStrength;
    const t = Phaser.Math.Clamp(1 - dist / radius, 0, 1);
    const impulse = strength * t;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.velocity.x += (dx / dist) * impulse;
    body.velocity.y += (dy / dist) * impulse;
  }

  private spawnOverloadExplosion(x: number, y: number, sourceTags: string[] = []) {
    if (this.overloadConfig.stacks <= 0) return;
    const now = this.time.now;
    if (now < this.overloadConfig.lastTriggerAt + this.overloadConfig.cooldownMs) return;
    this.overloadConfig.lastTriggerAt = now;
    const radius = this.overloadConfig.radius;
    this.spawnBurstVisual(x, y, radius, COLOR_OVERLOAD, 0.9);
    this.applyAoeDamage(
      x,
      y,
      radius,
      this.overloadConfig.damage,
      sourceTags.concat(["overload"]),
      true
    );
  }

  private tryChainArc(origin: Phaser.Physics.Arcade.Image) {
    if (this.chainArcConfig.stacks <= 0) return;
    const now = this.time.now;
    if (now < this.chainArcConfig.lastAt + this.chainArcConfig.cooldownMs) return;
    const range = this.chainArcConfig.range;
    let nearest: Phaser.Physics.Arcade.Image | null = null;
    let nearestDist = Number.MAX_VALUE;
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active) return;
      if (enemy === origin) return;
      const dist = Phaser.Math.Distance.Between(origin.x, origin.y, enemy.x, enemy.y);
      if (dist < range && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    });
    if (!nearest) return;
    const target = nearest as Phaser.Physics.Arcade.Image;
    this.chainArcConfig.lastAt = now;
    const damage = this.playerStats.damage * this.chainArcConfig.damagePercent;
    this.applyDamageToEnemy(target, damage, undefined, { tags: ["arc"] });
    if (!this.lowGraphics) {
      const line = this.add.line(0, 0, origin.x, origin.y, target.x, target.y, COLOR_PULSE, 0.7).setLineWidth(2);
      this.tweens.add({
        targets: line,
        alpha: { from: 0.7, to: 0 },
        duration: 150,
        onComplete: () => line.destroy(),
      });
    }
  }

  private maybeGrantInvulnFromPulse() {
    if (!this.iframeConfig.unlocked) return;
    const now = this.time.now;
    if (now < this.iframeConfig.nextReadyAt) return;
    this.iframeConfig.nextReadyAt = now + this.iframeConfig.cooldownMs;
    this.invulnUntil = now + this.iframeConfig.durationMs;
  }

  private handleProjectileBounds() {
    const margin = 32;
    const left = this.screenBounds.left - margin;
    const right = this.screenBounds.right + margin;
    const top = this.screenBounds.top - margin;
    const bottom = this.screenBounds.bottom + margin;

    this.bullets.getChildren().forEach((child) => {
      const proj = child as Phaser.Physics.Arcade.Image;
      if (!proj.active || !proj.visible) return;
      const body = proj.body as Phaser.Physics.Arcade.Body;
      let bounces = (proj.getData("bounces") as number) ?? 0;
      let bounced = false;
      let outOfBounds = false;

      if (proj.x < left) {
        proj.x = left;
        outOfBounds = true;
        if (bounces > 0) {
          body.velocity.x = Math.abs(body.velocity.x);
          bounces -= 1;
          bounced = true;
        }
      } else if (proj.x > right) {
        proj.x = right;
        outOfBounds = true;
        if (bounces > 0) {
          body.velocity.x = -Math.abs(body.velocity.x);
          bounces -= 1;
          bounced = true;
        }
      }

      if (proj.y < top) {
        proj.y = top;
        outOfBounds = true;
        if (bounces > 0) {
          body.velocity.y = Math.abs(body.velocity.y);
          bounces -= 1;
          bounced = true;
        }
      } else if (proj.y > bottom) {
        proj.y = bottom;
        outOfBounds = true;
        if (bounces > 0) {
          body.velocity.y = -Math.abs(body.velocity.y);
          bounces -= 1;
          bounced = true;
        }
      }

      if (bounced) {
        proj.setData("bounces", bounces);
      } else if (outOfBounds) {
        proj.destroy();
      }
    });

    this.enemyBullets.getChildren().forEach((child) => {
      const proj = child as Phaser.Physics.Arcade.Image;
      if (!proj.active || !proj.visible) return;
      if (
        proj.x < left ||
        proj.x > right ||
        proj.y < top ||
        proj.y > bottom
      ) {
        proj.destroy();
      }
    });
  }

  private handleEnemyDeath(enemy: Phaser.Physics.Arcade.Image, killerTags?: string[]) {
    const kind = enemy.getData("kind") as string;
    const x = enemy.x;
    const y = enemy.y;
    const slowed = (enemy.getData("slowUntil") as number | undefined) ?? 0;
    if (this.overloadConfig.stacks > 0 && slowed > this.time.now) {
      const tags =
        killerTags ??
        (enemy.getData("lastHitTags") as string[] | undefined) ??
        [];
      this.spawnOverloadExplosion(x, y, tags);
    }
    enemy.destroy();
    useRunStore.getState().actions.recordKill();
    this.dropXp(x, y, kind);
    soundManager.playSfx("enemyDown");
    this.tryChainArc(enemy);
    this.tryKineticHeal();
    if (kind === "boss") {
      this.endRun(true);
    }
  }

  private dropXp(x: number, y: number, kind: string) {
    const pickup = this.xpPickups.get(x, y, "xp") as Phaser.Physics.Arcade.Image;
    if (!pickup) return;
    pickup.setActive(true);
    pickup.setVisible(true);
    pickup.setScale(OBJECT_SCALE);
    pickup.setData("value", kind === "mass" ? 6 : kind === "watcher" ? 4 : 3);
    pickup.setVelocity(
      Phaser.Math.Between(-40, 40),
      Phaser.Math.Between(-40, 40)
    );
    const body = pickup.body as Phaser.Physics.Arcade.Body;
    const radius = 18 * OBJECT_SCALE;
    body.setCircle(radius);
    body.setOffset(pickup.displayWidth * 0.5 - radius, pickup.displayHeight * 0.5 - radius);
  }

  private collectXp(pickup: Phaser.Physics.Arcade.Image) {
    const value = pickup.getData("value") as number;
    pickup.destroy();
    soundManager.playSfx("xpPickup");
    this.tryShieldPickup();
    this.xp += value;
    while (this.xp >= this.nextXpThreshold) {
      this.xp -= this.nextXpThreshold;
      this.levelUp();
    }
    const actions = useRunStore.getState().actions;
    actions.setXp(this.level, this.xp, this.nextXpThreshold);
  }

  private tryShieldPickup() {
    if (this.shieldConfig.stacks <= 0) return;
    const now = this.time.now;
    if (now < this.shieldConfig.nextReadyAt) return;
    this.shieldConfig.activeUntil = now + this.shieldConfig.durationMs;
    this.shieldConfig.hp = this.shieldConfig.shieldHp;
    this.shieldConfig.nextReadyAt = now + this.shieldConfig.cooldownMs;
    if (!this.lowGraphics) {
      if (!this.shieldRing) {
        this.shieldRing = this.add
          .circle(this.player!.x, this.player!.y, 26 * OBJECT_SCALE, COLOR_PULSE, 0.06)
          .setStrokeStyle(3, COLOR_PULSE, 0.8)
          .setDepth(1.5);
      }
      this.shieldRing.setVisible(true);
      this.shieldRing.setAlpha(0.8);
      this.shieldRing.setPosition(this.player!.x, this.player!.y);
      this.spawnBurstVisual(this.player!.x, this.player!.y, 30 * OBJECT_SCALE, COLOR_PULSE, 0.9);
    }
  }

  private tryKineticHeal() {
    if (this.kineticConfig.stacks <= 0) return;
    const now = this.time.now;
    if (now < this.kineticConfig.nextReadyAt) return;
    this.kineticConfig.nextReadyAt = now + this.kineticConfig.cooldownMs;
    this.healPlayer(this.kineticConfig.healAmount);
  }

  private healPlayer(amount: number) {
    this.playerStats.health = Math.min(
      this.playerStats.maxHealth,
      this.playerStats.health + amount
    );
    useRunStore.getState().actions.setVitals(
      this.playerStats.health,
      this.playerStats.maxHealth
    );
  }

  private levelUp() {
    this.level += 1;
    this.nextXpThreshold = Math.floor(this.nextXpThreshold * 1.2 + 6);
    useRunStore.getState().actions.setXp(this.level, this.xp, this.nextXpThreshold);
    this.pendingUpgradeOptions = this.rollUpgradeOptions();
    if (this.pendingUpgradeOptions.length === 0) return;
    this.setPaused(true);
    useUIStore.getState().actions.openUpgradeSelection();
    gameEvents.emit(GAME_EVENT_KEYS.levelUp, { options: this.pendingUpgradeOptions });
  }

  private rollUpgradeOptions(): UpgradeDefinition[] {
    const available = UPGRADE_CATALOG.filter((u) => {
      const stacks = this.upgradeStacks[u.id] ?? 0;
      return u.maxStacks ? stacks < u.maxStacks : true;
    });
    const picks: UpgradeDefinition[] = [];

    const pickWeighted = (pool: UpgradeDefinition[]) => {
      const total = pool.reduce((sum, u) => sum + (u.dropWeight ?? 1), 0);
      let roll = Math.random() * total;
      for (const u of pool) {
        roll -= u.dropWeight ?? 1;
        if (roll <= 0) return u;
      }
      return pool[pool.length - 1];
    };

    const pool = available.slice();
    for (let i = 0; i < 3; i++) {
      if (pool.length === 0) break;
      const choice = pickWeighted(pool);
      picks.push(choice);
      pool.splice(pool.indexOf(choice), 1);
    }
    return picks;
  }

  private applyUpgradeEffects(def: UpgradeDefinition) {
    switch (def.id) {
      case "power-shot": {
        this.playerStats.damage *= 1.15;
        break;
      }
      case "rapid-fire": {
        this.playerStats.fireRate *= 1.15;
        break;
      }
      case "swift-projectiles": {
        this.playerStats.projectileSpeed *= 1.2;
        break;
      }
      case "engine-tune": {
        this.playerStats.moveSpeed *= 1.1;
        break;
      }
      case "plating": {
        this.playerStats.maxHealth += 1;
        this.playerStats.health += 1;
        useRunStore.getState().actions.setVitals(
          this.playerStats.health,
          this.playerStats.maxHealth
        );
        break;
      }
      case "sidecar": {
        this.playerStats.projectiles += 1;
        break;
      }
      case "pierce": {
        this.playerStats.pierce += 1;
        break;
      }
      case "heavy-barrel": {
        this.playerStats.damage *= 1.2;
        this.playerStats.fireRate *= 0.9;
        this.projectileScale *= 1.1;
        break;
      }
      case "rebound": {
        this.playerStats.bounce += 1;
        this.playerStats.projectileSpeed *= 0.9;
        break;
      }
      case "dash-sparks": {
        const stacks = this.upgradeStacks[def.id];
        const trailShots = 3 + (stacks - 1);
        const shotDamage = 40 * (1 + 0.1 * (stacks - 1));
        this.afterimageConfig = { stacks, trailShots, shotDamage };
        break;
      }
      case "held-charge": {
        const stacks = this.upgradeStacks[def.id];
        const idleMs = Math.max(400, 800 - (stacks - 1) * 80);
        const damageBonus = 0.8 + (stacks - 1) * 0.12;
        const sizeBonus = 0.2;
        const chargePierceBonus = 2 + (stacks - 1);
        this.capacitorConfig = { stacks, idleMs, damageBonus, sizeBonus, chargePierceBonus };
        this.chargeState.idleMs = idleMs;
        this.chargeState.damageBonus = damageBonus;
        this.chargeState.sizeBonus = sizeBonus;
        break;
      }
      case "shield-pickup": {
        const stacks = this.upgradeStacks[def.id];
        const durationMs = (2 + (stacks - 1) * 0.3) * 1000;
        const cooldownMs = Math.max(3000, 5000 - (stacks - 1) * 600);
        const shieldHp = 60;
        this.shieldConfig = {
          stacks,
          shieldHp,
          durationMs,
          cooldownMs,
          activeUntil: 0,
          hp: 0,
          nextReadyAt: 0,
        };
        break;
      }
      case "kinetic-siphon": {
        const stacks = this.upgradeStacks[def.id];
        const healAmount = 0.3 + (stacks - 1) * 0.1;
        const cooldownMs = Math.max(800, 1200 - (stacks - 1) * 200);
        this.kineticConfig = { stacks, healAmount, cooldownMs, nextReadyAt: 0 };
        break;
      }
      case "prism-spread": {
        const stacks = this.upgradeStacks[def.id];
        const prevBonus = this.spreadConfig.critBonus;
        const spreadDegrees = Math.max(3, 6 - (stacks - 1) * 1.5);
        const critBonus = 0.05 * stacks;
        this.spreadConfig = { stacks, spreadDegrees, critBonus };
        this.playerStats.critChance += critBonus - prevBonus;
        break;
      }
      case "momentum-feed": {
        const stacks = this.upgradeStacks[def.id];
        const ramp = 0.25 + (stacks - 1) * 0.05;
        const timeToMaxMs = Math.max(1400, 2000 - (stacks - 1) * 200);
        this.momentumConfig = { stacks, ramp, timeToMaxMs, timerMs: 0, bonus: 0 };
        break;
      }
      case "split-shot": {
        const stacks = this.upgradeStacks[def.id];
        const damageMultiplier = 0.5 + (stacks - 1) * 0.1;
        const spreadDegrees = Math.max(8, 12 - (stacks - 1) * 2);
        this.splitConfig = { enabled: true, forks: 2, spreadDegrees, damageMultiplier };
        break;
      }
      case "explosive-impact": {
        const stacks = this.upgradeStacks[def.id];
        const radius = (32 + (stacks - 1) * 10) * OBJECT_SCALE;
        const damageMultiplier = 0.55 + (stacks - 1) * 0.1;
        this.explosiveConfig = { stacks, radius, damageMultiplier };
        break;
      }
      case "chain-arc": {
        const stacks = this.upgradeStacks[def.id];
        const range = 180 + (stacks - 1) * 20;
        const damagePercent = 0.6 + (stacks - 1) * 0.1;
        const cooldownMs = Math.max(120, 150 - (stacks - 1) * 20);
        this.chainArcConfig = { stacks, range, damagePercent, cooldownMs, lastAt: 0 };
        break;
      }
      default:
        break;
    }
  }

  private beginWaveIntermission(nextWaveIndex: number) {
    this.intermissionActive = true;
    this.pendingWaveIndex = nextWaveIndex;
    this.intermissionRemainingMs = 3000;
    this.lastCountdownBroadcast = 3;
    useRunStore.getState().actions.setWaveCountdown(3, nextWaveIndex + 1);
  }

  private handleWaveIntermission(dt: number) {
    if (!this.intermissionActive || this.pendingWaveIndex === null) return;

    this.intermissionRemainingMs = Math.max(
      0,
      this.intermissionRemainingMs - dt * 1000
    );

    const secondsLeft = Math.max(1, Math.ceil(this.intermissionRemainingMs / 1000));
    if (secondsLeft !== this.lastCountdownBroadcast) {
      this.lastCountdownBroadcast = secondsLeft;
      useRunStore.getState().actions.setWaveCountdown(secondsLeft, this.pendingWaveIndex + 1);
    }

    if (this.intermissionRemainingMs <= 0) {
      const nextWave = this.pendingWaveIndex;
      this.intermissionActive = false;
      this.pendingWaveIndex = null;
      this.lastCountdownBroadcast = 0;
      this.intermissionRemainingMs = 0;
      useRunStore.getState().actions.setWaveCountdown(null, null);
      this.startWave(nextWave);
    }
  }

  private startWave(index: number) {
    this.waveIndex = index;
    this.intermissionActive = false;
    this.pendingWaveIndex = null;
    this.intermissionRemainingMs = 0;
    this.lastCountdownBroadcast = 0;
    useRunStore.getState().actions.setWaveCountdown(null, null);
    useRunStore.getState().actions.setWave(index + 1);
    gameEvents.emit(GAME_EVENT_KEYS.waveStarted, { wave: index + 1 });
    this.spawnWaveEnemies(WAVES[index].enemies);
    this.nextWaveCheckAt = this.time.now + 700;
  }

  private spawnWaveEnemies(spawns: EnemySpawn[]) {
    spawns.forEach((spawn) => {
      if (spawn.kind === "boss") {
        this.spawnBoss();
        return;
      }
      for (let i = 0; i < spawn.count; i++) {
        this.spawnEnemy(spawn.kind, spawn.elite);
      }
    });
  }

  private spawnEnemy(kind: string, elite?: boolean) {
    const enemy = this.enemies.get(0, 0, kind === "drifter" ? "drifter" : kind === "watcher" ? "watcher" : "mass") as Phaser.Physics.Arcade.Image;
    if (!enemy) return;
    enemy.setActive(true);
    enemy.setVisible(false);
    enemy.setScale(OBJECT_SCALE);
    const spawnPos = this.pickPerimeterSpawn();
    enemy.setPosition(spawnPos.x, spawnPos.y);
    const stats = getEnemyDefinition(kind as any, elite);
    enemy.setData("kind", kind);
    enemy.setData("health", stats.health);
    enemy.setData("speed", stats.speed * this.difficulty);
    enemy.setData(
      "fireCooldown",
      stats.fireCooldown ? stats.fireCooldown / this.difficulty : 0
    );
    enemy.setData(
      "projectileSpeed",
      stats.projectileSpeed ? stats.projectileSpeed * this.difficulty : 0
    );
    enemy.setData("nextFire", this.time.now + Phaser.Math.Between(400, 1200));
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    enemyBody.setSize(enemy.displayWidth, enemy.displayHeight, true);
    enemyBody.setBounce(0.4, 0.4);
    enemyBody.enable = false;
    enemy.setVelocity(0, 0);
    if (elite) {
      enemy.setTint(0xf3d17a);
    } else {
      enemy.clearTint();
    }
    this.showSpawnCue(enemy);
  }

  private spawnBoss() {
    this.boss = this.enemies.get(GAME_WIDTH / 2, 140, "boss") as Phaser.Physics.Arcade.Image;
    if (!this.boss) return;
    this.boss.setActive(true);
    this.boss.setVisible(true);
    this.boss.setScale(OBJECT_SCALE);
    this.boss.setData("kind", "boss");
    const base = getEnemyDefinition("boss");
    this.bossMaxHealth = base.health;
    this.boss.setData("health", base.health);
    this.boss.setData("speed", base.speed * this.difficulty);
    this.boss.setData(
      "fireCooldown",
      base.fireCooldown ? base.fireCooldown / this.difficulty : 1.2 / this.difficulty
    );
    this.boss.setData(
      "projectileSpeed",
      base.projectileSpeed ? base.projectileSpeed * this.difficulty : 0
    );
    this.bossNextPatternAt = this.time.now + 1500 / this.difficulty;
    const bossBody = this.boss.body as Phaser.Physics.Arcade.Body;
    bossBody.setSize(this.boss.displayWidth, this.boss.displayHeight, true);
    bossBody.setImmovable(true);
  }

  private handlePlayerDamage(_source: Phaser.Physics.Arcade.Image, amount: number, isContact: boolean) {
    const now = this.time.now;
    if (now < this.invulnUntil) return;
    let remaining = isContact ? amount + 0.5 : amount;

    if (this.shieldConfig.hp > 0 && now <= this.shieldConfig.activeUntil) {
      const absorbed = Math.min(this.shieldConfig.hp, remaining);
      this.shieldConfig.hp -= absorbed;
      remaining -= absorbed;
      if (
        absorbed > 0 &&
        this.conductiveConfig.stacks > 0 &&
        now >= this.conductiveConfig.nextPulseAt
      ) {
        this.conductiveConfig.nextPulseAt = now + this.conductiveConfig.cooldownMs;
        this.applyAoeDamage(
          this.player!.x,
          this.player!.y,
          this.conductiveConfig.radius,
          this.conductiveConfig.damage,
          ["pulse", "shield"],
          true
        );
      }
      if (this.shieldConfig.hp <= 0) {
        this.shieldConfig.activeUntil = 0;
      }
    }

    if (remaining <= 0) return;

    this.playerStats.health -= remaining;
    useRunStore.getState().actions.setVitals(
      this.playerStats.health,
      this.playerStats.maxHealth
    );
    this.player?.setTintFill(0xf14e4e);
    this.time.delayedCall(80, () => this.player?.clearTint());
    if (this.playerStats.health <= 0) {
      this.endRun(false);
    }
  }

  private createTexture(key: string, draw: (g: Phaser.GameObjects.Graphics) => void) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics({ x: 0, y: 0 });
    draw(g);
    g.generateTexture(key, 64, 64);
    g.destroy();
  }

  private pickPerimeterSpawn() {
    const margin = 40;
    const edges = [
      { x: Phaser.Math.Between(this.screenBounds.left, this.screenBounds.right), y: this.screenBounds.top + margin, side: "top" },
      { x: Phaser.Math.Between(this.screenBounds.left, this.screenBounds.right), y: this.screenBounds.bottom - margin, side: "bottom" },
      { x: this.screenBounds.left + margin, y: Phaser.Math.Between(this.screenBounds.top, this.screenBounds.bottom), side: "left" },
      { x: this.screenBounds.right - margin, y: Phaser.Math.Between(this.screenBounds.top, this.screenBounds.bottom), side: "right" },
    ];
    return Phaser.Utils.Array.GetRandom(edges);
  }

  private showSpawnCue(enemy: Phaser.Physics.Arcade.Image) {
    const cue = this.add.circle(enemy.x, enemy.y, 26, 0x9ff0ff, 0.15).setStrokeStyle(2, 0x6dd6ff, 0.6);
    const flash = this.tweens.add({
      targets: cue,
      alpha: { from: 0.15, to: 0.4 },
      scale: { from: 0.9, to: 1.1 },
      duration: 500,
      yoyo: true,
      repeat: 2,
    });
    this.time.delayedCall(1500, () => {
      cue.destroy();
      flash.stop();
      enemy.setActive(true);
      enemy.setVisible(true);
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      enemy.setVelocity(0, 0);
    });
  }

  private handleBossPhaseChange() {
    if (!this.boss) return;
    const hp = this.boss.getData("health") as number;
    const maxHp = this.bossMaxHealth || getEnemyDefinition("boss").health;
    const hpPct = hp / maxHp;
    let phase = 1;
    if (hpPct < 0.66) phase = 2;
    if (hpPct < 0.33) phase = 3;
    if (phase !== this.bossPhase) {
      this.bossPhase = phase;
      gameEvents.emit(GAME_EVENT_KEYS.bossPhaseChanged, { phase });
    }
  }

  private endRun(victory: boolean) {
    this.runActive = false;
    this.intermissionActive = false;
    this.pendingWaveIndex = null;
    this.intermissionRemainingMs = 0;
    this.lastCountdownBroadcast = 0;
    this.physics.world.pause();
    const state = useRunStore.getState();
    const durationSeconds = (this.time.now - this.runStartTime) / 1000;
    const summary = {
      runId: state.runId ?? crypto.randomUUID(),
      timestamp: Date.now(),
      durationSeconds,
      wavesCleared: this.waveIndex + 1,
      bossDefeated: victory,
      enemiesDestroyed: state.enemiesDestroyed,
      upgrades: state.currentUpgrades,
    };
    state.actions.setWaveCountdown(null, null);
    state.actions.endRun(summary);
    useUIStore.getState().actions.setScreen("summary");
    gameEvents.emit(GAME_EVENT_KEYS.runEnded, summary);
  }

  setLowGraphicsMode(enabled: boolean) {
    this.lowGraphics = enabled;
  }
}
