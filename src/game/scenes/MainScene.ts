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
  maxHealth: number;
  health: number;
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
    maxHealth: 5,
    health: 5,
  };
  private ability: AbilityState = {
    dashCooldownMs: 1600,
    dashDurationMs: 160,
    nextDashAt: 0,
    activeUntil: 0,
  };
  private overdrive = { unlocked: false, active: false, timer: 0 };
  private explosions = { stacks: 0 };
  private drain = { unlocked: false, nextHealAt: 0 };
  private aegis = { unlocked: false, nextReadyAt: 0, activeUntil: 0 };
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
    this.resetState();
    useRunStore.getState().actions.startRun();
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
    this.handleShooting();
    this.handleEnemies();
    this.cullProjectiles();
    this.handleXpAttraction(dt);
    this.handleBossPatterns();
    this.handleOverdrive(dt);
    this.handleWaveIntermission(dt);

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
      maxHealth: 5,
      health: 5,
    };
    this.overdrive = { unlocked: false, active: false, timer: 0 };
    this.explosions = { stacks: 0 };
    this.drain = { unlocked: false, nextHealAt: 0 };
    this.aegis = { unlocked: false, nextReadyAt: 0, activeUntil: 0 };
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
    this.lastShotAt = 0;
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

  private tryDash(dir: Phaser.Math.Vector2) {
    if (this.time.now < this.ability.nextDashAt) return;
    const dashDir = dir.lengthSq() > 0 ? dir.clone().normalize() : new Phaser.Math.Vector2(1, 0);
    const body = this.player!.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dashDir.x * this.playerStats.moveSpeed * 3, dashDir.y * this.playerStats.moveSpeed * 3);
    this.ability.activeUntil = this.time.now + this.ability.dashDurationMs;
    this.ability.nextDashAt = this.time.now + this.ability.dashCooldownMs;
  }

  private handleShooting() {
    if (!this.player) return;
    const pointer = this.input.activePointer;
    if (!pointer.isDown && !this.input.mousePointer?.isDown) return;
    const effectiveFireRate = this.playerStats.fireRate * (this.overdrive.active ? 1.5 : 1);
    const cooldown = 1000 / effectiveFireRate;
    if (this.time.now < this.lastShotAt + cooldown) return;
    this.lastShotAt = this.time.now;

    const dir = new Phaser.Math.Vector2(
      pointer.worldX - this.player.x,
      pointer.worldY - this.player.y
    ).normalize();
    const spreadCount = this.playerStats.projectiles;
    const spreadTotal = Math.max(spreadCount - 1, 0);
    soundManager.playSfx("shoot");
    for (let i = 0; i < spreadCount; i++) {
      const offset = spreadTotal === 0 ? 0 : (i - spreadTotal / 2) * Phaser.Math.DegToRad(6);
      const shotDir = dir.clone().rotate(offset);
      this.spawnBullet(this.player.x, this.player.y, shotDir);
    }
  }

  private spawnBullet(x: number, y: number, dir: Phaser.Math.Vector2) {
    const bullet = this.bullets.get(
      x,
      y,
      "bullet"
    ) as Phaser.Physics.Arcade.Image;
    if (!bullet) return;
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(OBJECT_SCALE);
    (bullet.body as Phaser.Physics.Arcade.Body).setSize(
      8 * OBJECT_SCALE,
      24 * OBJECT_SCALE,
      true
    );
    bullet.setVelocity(dir.x * this.playerStats.projectileSpeed, dir.y * this.playerStats.projectileSpeed);
    bullet.setRotation(dir.angle());
    bullet.setData("pierce", this.playerStats.pierce);
    bullet.setData("damage", this.playerStats.damage);
  }

  private handleEnemies() {
    const player = this.player!;
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active || !enemy.visible) return;
      const kind = enemy.getData("kind") as string;
      const speed = enemy.getData("speed") as number;
      const targetVec = new Phaser.Math.Vector2(player.x - enemy.x, player.y - enemy.y);
      const dist = targetVec.length();
      targetVec.normalize();

      if (kind === "drifter") {
        enemy.setVelocity(targetVec.x * speed, targetVec.y * speed);
      } else if (kind === "watcher") {
        if (dist > 260) {
          enemy.setVelocity(targetVec.x * speed, targetVec.y * speed);
        } else if (dist < 180) {
          enemy.setVelocity(-targetVec.x * speed, -targetVec.y * speed);
        } else {
          enemy.setVelocity(0, 0);
        }
        this.tryEnemyShot(enemy, player);
      } else if (kind === "mass") {
        enemy.setVelocity(targetVec.x * speed * 0.7, targetVec.y * speed * 0.7);
        this.tryEnemyShot(enemy, player, true);
      } else if (kind === "boss") {
        enemy.setVelocity(0, 0);
      }
    });
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
    this.applyDamageToEnemy(enemy, damage, projectile);

    if (pierceLeft > 0) {
      projectile.setData("pierce", pierceLeft - 1);
    } else {
      projectile.destroy();
    }
  };

  private applyDamageToEnemy(
    enemy: Phaser.Physics.Arcade.Image,
    damage: number,
    source?: Phaser.Physics.Arcade.Image
  ) {
    const current = enemy.getData("health") as number;
    const remaining = current - damage;
    enemy.setData("health", remaining);
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(50, () => enemy.clearTint());

    if (this.explosions.stacks > 0 && source) {
      this.spawnExplosion(source.x, source.y, 32 + this.explosions.stacks * 8);
    }

    if (remaining <= 0) {
      this.handleEnemyDeath(enemy);
    } else if ((enemy.getData("kind") as string) === "boss") {
      this.handleBossPhaseChange();
    }
  }

  private spawnExplosion(x: number, y: number, radius: number) {
    if (!this.lowGraphics) {
      const circle = this.add
        .circle(x, y, radius, 0xffffff, 0.08)
        .setStrokeStyle(1, 0xe0e6ff);
      this.time.delayedCall(120, () => circle.destroy());
    }
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= radius + 10) {
        this.applyDamageToEnemy(enemy, this.playerStats.damage * 0.5);
      }
    });
  }

  private cullProjectiles() {
    const margin = 32;
    const left = this.screenBounds.left - margin;
    const right = this.screenBounds.right + margin;
    const top = this.screenBounds.top - margin;
    const bottom = this.screenBounds.bottom + margin;

    const cull = (group: Phaser.Physics.Arcade.Group) => {
      group.getChildren().forEach((child) => {
        const proj = child as Phaser.Physics.Arcade.Image;
        if (!proj.active || !proj.visible) return;
        if (proj.x < left || proj.x > right || proj.y < top || proj.y > bottom) {
          proj.destroy();
        }
      });
    };

    cull(this.bullets);
    cull(this.enemyBullets);
  }

  private handleEnemyDeath(enemy: Phaser.Physics.Arcade.Image) {
    const kind = enemy.getData("kind") as string;
    const x = enemy.x;
    const y = enemy.y;
    enemy.destroy();
    useRunStore.getState().actions.recordKill();
    this.dropXp(x, y, kind);
    soundManager.playSfx("enemyDown");
    this.tryDrainHeal();
    if (kind === "boss") {
      this.endRun(true);
    }
  }

  private tryDrainHeal() {
    if (!this.drain.unlocked || this.time.now < this.drain.nextHealAt) return;
    this.healPlayer(0.5);
    this.drain.nextHealAt = this.time.now + 1700;
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
    this.xp += value;
    while (this.xp >= this.nextXpThreshold) {
      this.xp -= this.nextXpThreshold;
      this.levelUp();
    }
    const actions = useRunStore.getState().actions;
    actions.setXp(this.level, this.xp, this.nextXpThreshold);
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
    const commons = available.filter((u) => u.rarity === "common");
    const rares = available.filter((u) => u.rarity === "rare");
    const picks: UpgradeDefinition[] = [];

    for (let i = 0; i < 3; i++) {
      const useRare = Math.random() < 0.35 && rares.length > 0;
      const pool = useRare ? rares : commons.length > 0 ? commons : rares;
      if (pool.length === 0) break;
      const index = Phaser.Math.Between(0, pool.length - 1);
      const [choice] = pool.splice(index, 1);
      picks.push(choice);
    }
    return picks;
  }

  private applyUpgradeEffects(def: UpgradeDefinition) {
    switch (def.id) {
      case "power-shot":
        this.playerStats.damage *= 1.12;
        break;
      case "rapid-fire":
        this.playerStats.fireRate *= 1.12;
        break;
      case "swift-projectiles":
        this.playerStats.projectileSpeed *= 1.15;
        break;
      case "engine-tune":
        this.playerStats.moveSpeed *= 1.1;
        break;
      case "plating":
        this.playerStats.maxHealth += 1;
        this.healPlayer(1);
        break;
      case "sidecar":
        this.playerStats.projectiles += 1;
        break;
      case "pierce":
        this.playerStats.pierce += 1;
        break;
      case "overdrive":
        this.overdrive.unlocked = true;
        break;
      case "explosive-impact":
        this.explosions.stacks += 1;
        break;
      case "drain":
        this.drain.unlocked = true;
        break;
      case "aegis":
        this.aegis.unlocked = true;
        break;
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
  }

  private handlePlayerDamage(_source: Phaser.Physics.Arcade.Image, amount: number, isContact: boolean) {
    if (this.time.now < this.aegis.activeUntil) return;
    if (this.aegis.unlocked && this.playerStats.health <= this.playerStats.maxHealth * 0.4 && this.time.now > this.aegis.nextReadyAt) {
      this.aegis.activeUntil = this.time.now + 1600;
      this.aegis.nextReadyAt = this.time.now + 10000;
      return;
    }
    const damage = isContact ? amount + 0.5 : amount;
    this.playerStats.health -= damage;
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

  private handleOverdrive(dt: number) {
    if (!this.overdrive.unlocked) return;
    const playerBody = this.player!.body as Phaser.Physics.Arcade.Body;
    const speed = playerBody.velocity.length();
    if (speed < 6) {
      this.overdrive.timer += dt;
      if (this.overdrive.timer > 0.6) {
        this.overdrive.active = true;
      }
    } else {
      this.overdrive.active = false;
      this.overdrive.timer = 0;
    }
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
