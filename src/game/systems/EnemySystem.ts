/**
 * Enemy system implementation
 * Handles enemy spawning, AI, wave management, and boss behavior
 */

import * as Phaser from 'phaser';
import { getEnemyDefinition } from '../../config/enemies';
import { WAVES } from '../../config/waves';
import type { EnemyKind } from '../../models/types';
import { eventBus } from './EventBus';
import type {
  EnemySpawn,
  EnemyState,
  IEnemySpawner,
  IEnemySystem,
  IWaveManager,
  WaveState,
} from './interfaces/EnemySystem';
import { BaseGameSystem } from './interfaces/GameSystem';

const OBJECT_SCALE = 0.7;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

export class EnemySystem extends BaseGameSystem implements IEnemySystem {
  private enemies?: Phaser.Physics.Arcade.Group;
  private enemyBullets?: Phaser.Physics.Arcade.Group;
  private boss?: Phaser.Physics.Arcade.Image;

  private currentWave?: WaveState;
  private waveManager: IWaveManager;
  private enemySpawner: IEnemySpawner;

  // Configuration
  private difficulty = 1;
  private enemyHealthScale = 1;
  private bossNextPatternAt = 0;

  constructor() {
    super('enemy-system', ['player-system']);
    this.waveManager = new WaveManager();
    this.enemySpawner = new EnemySpawner();
  }

  protected onInitialize(): void {
    this.setupEnemyGroups();
    this.setupEventListeners();
  }

  protected onShutdown(): void {
    this.enemies?.destroy();
    this.enemyBullets?.destroy();
    eventBus.removeAllListeners();
  }

  update(time: number, delta: number): void {
    if (!this.currentWave?.active) return;

    this.updateEnemyAI(time, delta);
    this.updateEnemyBullets(time, delta);
    this.updateBoss(time, delta);
    this.checkWaveCompletion();
  }

  startWave(waveIndex: number): void {
    const scene = this.getScene();

    if (!this.waveManager.hasWave(waveIndex)) {
      console.warn(`Wave ${waveIndex} does not exist`);
      return;
    }

    const spawns = this.waveManager.loadWaveConfig(waveIndex);
    const difficulty = this.waveManager.calculateWaveDifficulty(waveIndex);

    this.currentWave = {
      index: waveIndex,
      active: true,
      remainingEnemies: spawns.reduce((sum, spawn) => sum + spawn.count, 0),
      spawnQueue: spawns.map((spawn) => ({
        ...spawn,
        spawnTime: scene.time.now + (spawn.spawnDelay || 0),
        spawnDelay: spawn.spawnDelay || 0,
      })),
      nextSpawnTime: scene.time.now,
    };

    this.difficulty = difficulty;

    eventBus.emit('wave:started', { waveIndex });

    // Start spawning enemies
    this.processSpawnQueue();
  }

  getCurrentWave(): WaveState | undefined {
    return this.currentWave ? { ...this.currentWave } : undefined;
  }

  spawnEnemy(type: EnemyKind, position?: Phaser.Math.Vector2): EnemyState | undefined {
    if (!this.enemies) return undefined;

    const scene = this.getScene();
    const enemy = this.enemies.get(0, 0, type) as Phaser.Physics.Arcade.Image;

    if (!enemy) return undefined;

    const spawnPos = position || this.enemySpawner.findSpawnPosition();
    const stats = getEnemyDefinition(type);
    const maxHealth = stats.health * this.enemyHealthScale;

    enemy.setActive(true);
    enemy.setVisible(false); // Will be shown after spawn animation
    enemy.setScale(OBJECT_SCALE);
    enemy.setPosition(spawnPos.x, spawnPos.y);

    // Set enemy data
    enemy.setData('kind', type);
    enemy.setData('health', maxHealth);
    enemy.setData('maxHealth', maxHealth);
    enemy.setData('speed', stats.speed * this.difficulty);
    enemy.setData('fireCooldown', stats.fireCooldown ? stats.fireCooldown / this.difficulty : 0);
    enemy.setData(
      'projectileSpeed',
      stats.projectileSpeed ? stats.projectileSpeed * this.difficulty : 0
    );
    enemy.setData('nextFire', scene.time.now + this.randBetween(400, 1200));

    // Setup physics body
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(enemy.displayWidth, enemy.displayHeight, true);
    body.setBounce(0.4, 0.4);
    body.enable = false; // Will be enabled after spawn animation
    enemy.setVelocity(0, 0);

    const enemyState: EnemyState = {
      type,
      health: maxHealth,
      maxHealth,
      position: new Phaser.Math.Vector2(spawnPos.x, spawnPos.y),
      velocity: new Phaser.Math.Vector2(0, 0),
      lastActionTime: scene.time.now,
      sprite: enemy,
    };

    // Show spawn animation
    this.showSpawnAnimation(enemy);

    eventBus.emit('enemy:spawned', {
      enemyId: enemy.name || `enemy-${Date.now()}`,
      type,
      position: { x: spawnPos.x, y: spawnPos.y },
    });

    return enemyState;
  }

  removeEnemy(_enemyId: string): void {
    // In a full implementation, we'd track enemies by ID
    // For now, this is a placeholder
  }

  getActiveEnemies(): EnemyState[] {
    if (!this.enemies) return [];

    const activeEnemies: EnemyState[] = [];

    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (enemy.active && enemy.visible) {
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        activeEnemies.push({
          type: enemy.getData('kind'),
          health: enemy.getData('health'),
          maxHealth: enemy.getData('maxHealth'),
          position: new Phaser.Math.Vector2(enemy.x, enemy.y),
          velocity: new Phaser.Math.Vector2(body.velocity.x, body.velocity.y),
          lastActionTime: enemy.getData('lastAction') || 0,
          sprite: enemy,
        });
      }
    });

    return activeEnemies;
  }

  damageEnemy(_enemyId: string, _damage: number): boolean {
    // In a full implementation, we'd find enemy by ID
    // This is a simplified version that would be called by collision handlers
    return false;
  }

  isWaveComplete(): boolean {
    return this.currentWave ? this.currentWave.remainingEnemies <= 0 : true;
  }

  getRemainingEnemyCount(): number {
    return this.currentWave?.remainingEnemies || 0;
  }

  // Private methods
  private setupEnemyGroups(): void {
    const scene = this.getScene();

    this.enemies = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 64,
      runChildUpdate: false,
    });

    this.enemyBullets = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 256,
      runChildUpdate: false,
    });
  }

  private setupEventListeners(): void {
    eventBus.on('player:died', () => {
      this.pauseEnemyActivity();
    });

    eventBus.on('game:paused', () => {
      this.pauseEnemyActivity();
    });

    eventBus.on('game:resumed', () => {
      this.resumeEnemyActivity();
    });
  }

  private updateEnemyAI(time: number, delta: number): void {
    if (!this.enemies) return;

    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active || !enemy.visible) return;

      this.updateEnemyBehavior(enemy, time, delta);
    });
  }

  private updateEnemyBehavior(
    enemy: Phaser.Physics.Arcade.Image,
    time: number,
    delta: number
  ): void {
    const kind = enemy.getData('kind') as string;
    const speed = enemy.getData('speed') as number;
    const slowUntil = enemy.getData('slowUntil') as number | undefined;
    const slowFactor =
      slowUntil && slowUntil > time
        ? ((enemy.getData('slowFactor') as number | undefined) ?? 1)
        : 1;

    // Get nearest player target (would come from player system)
    const target = this.getNearestPlayerPosition(enemy.x, enemy.y);
    if (!target) return;

    const targetVec = new Phaser.Math.Vector2(target.x - enemy.x, target.y - enemy.y);
    const dist = targetVec.length();
    targetVec.normalize();

    switch (kind) {
      case 'drifter':
        enemy.setVelocity(targetVec.x * speed * slowFactor, targetVec.y * speed * slowFactor);
        break;

      case 'watcher':
        if (dist > 260) {
          enemy.setVelocity(targetVec.x * speed * slowFactor, targetVec.y * speed * slowFactor);
        } else if (dist < 180) {
          enemy.setVelocity(-targetVec.x * speed * slowFactor, -targetVec.y * speed * slowFactor);
        } else {
          enemy.setVelocity(0, 0);
        }
        this.tryEnemyShot(enemy, target);
        break;

      case 'mass':
        enemy.setVelocity(
          targetVec.x * speed * 0.7 * slowFactor,
          targetVec.y * speed * 0.7 * slowFactor
        );
        this.tryEnemyShot(enemy, target, true);
        break;

      case 'boss':
        this.updateBossAI(enemy, target, time, delta);
        break;
    }
  }

  private updateBossAI(
    boss: Phaser.Physics.Arcade.Image,
    target: Phaser.Math.Vector2,
    time: number,
    _delta: number
  ): void {
    // Simplified boss AI - in full implementation this would be much more complex
    const speed = boss.getData('speed') as number;
    const targetVec = new Phaser.Math.Vector2(target.x - boss.x, target.y - boss.y);
    const dist = targetVec.length();

    if (dist > 200) {
      targetVec.normalize();
      boss.setVelocity(targetVec.x * speed * 0.5, targetVec.y * speed * 0.5);
    } else {
      boss.setVelocity(0, 0);
    }

    // Boss shooting patterns
    if (time > this.bossNextPatternAt) {
      this.executeBossPattern(boss, target);
      this.bossNextPatternAt = time + 2000; // 2 second cooldown
    }
  }

  private tryEnemyShot(
    enemy: Phaser.Physics.Arcade.Image,
    target: Phaser.Math.Vector2,
    heavy = false
  ): void {
    const scene = this.getScene();
    const nextFire = enemy.getData('nextFire') as number;
    const fireCooldown = enemy.getData('fireCooldown') as number;

    if (!fireCooldown || scene.time.now < nextFire) return;

    const dir = new Phaser.Math.Vector2(target.x - enemy.x, target.y - enemy.y).normalize();
    const speed = enemy.getData('projectileSpeed') as number;

    this.spawnEnemyBullet(enemy.x, enemy.y, dir, speed, heavy);
    enemy.setData('nextFire', scene.time.now + fireCooldown * 1000);
  }

  private spawnEnemyBullet(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    speed: number,
    heavy = false
  ): void {
    if (!this.enemyBullets) return;

    const bullet = this.enemyBullets.get(x, y, 'enemy-bullet') as Phaser.Physics.Arcade.Image;
    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(heavy ? OBJECT_SCALE * 1.5 : OBJECT_SCALE);
    bullet.setVelocity(direction.x * speed, direction.y * speed);
    bullet.setData('damage', heavy ? 2 : 1);
    bullet.setData('heavy', heavy);

    // Set bullet lifetime
    const scene = this.getScene();
    scene.time.delayedCall(3000, () => {
      if (bullet.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
      }
    });
  }

  private executeBossPattern(
    boss: Phaser.Physics.Arcade.Image,
    _target: Phaser.Math.Vector2
  ): void {
    // Simplified boss pattern - spiral shot
    const angleStep = Math.PI / 4; // 45 degrees
    for (let i = 0; i < 8; i++) {
      const angle = i * angleStep;
      const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      this.spawnEnemyBullet(boss.x, boss.y, dir, 200, false);
    }
  }

  private updateEnemyBullets(_time: number, _delta: number): void {
    if (!this.enemyBullets) return;

    this.enemyBullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return;

      // Check bounds
      if (
        bullet.x < -50 ||
        bullet.x > GAME_WIDTH + 50 ||
        bullet.y < -50 ||
        bullet.y > GAME_HEIGHT + 50
      ) {
        bullet.setActive(false);
        bullet.setVisible(false);
      }
    });
  }

  private updateBoss(_time: number, _delta: number): void {
    if (!this.boss || !this.boss.active) return;

    // Boss-specific updates would go here
    // Health bar updates, phase transitions, etc.
  }

  private processSpawnQueue(): void {
    if (!this.currentWave) return;

    const scene = this.getScene();
    const now = scene.time.now;

    this.currentWave.spawnQueue.forEach((spawn) => {
      if (spawn.spawnTime <= now && spawn.count > 0) {
        for (let i = 0; i < spawn.count; i++) {
          this.spawnEnemy(spawn.type);
        }
        spawn.count = 0; // Mark as spawned
      }
    });
  }

  private checkWaveCompletion(): void {
    if (!this.currentWave || !this.enemies) return;

    const activeCount = this.enemies.countActive(true);
    this.currentWave.remainingEnemies = activeCount;

    eventBus.emit('wave:enemy-count-changed', {
      remaining: activeCount,
      total: this.currentWave.spawnQueue.reduce((sum, spawn) => sum + spawn.count, 0),
    });

    if (activeCount === 0) {
      this.completeWave();
    }
  }

  private completeWave(): void {
    if (!this.currentWave) return;

    const waveIndex = this.currentWave.index;
    this.currentWave.active = false;

    eventBus.emit('wave:completed', { waveIndex });

    // Clear current wave
    this.currentWave = undefined;
  }

  private showSpawnAnimation(enemy: Phaser.Physics.Arcade.Image): void {
    const scene = this.getScene();

    // Simple spawn animation - fade in
    enemy.setAlpha(0);
    enemy.setVisible(true);

    scene.tweens.add({
      targets: enemy,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        body.enable = true;
      },
    });
  }

  private getNearestPlayerPosition(_x: number, _y: number): Phaser.Math.Vector2 | null {
    // This would get the nearest player position from the player system
    // For now, return a default position
    return new Phaser.Math.Vector2(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  private pauseEnemyActivity(): void {
    this.enemies?.setVelocity(0, 0);
    this.enemyBullets?.setVelocity(0, 0);
  }

  private resumeEnemyActivity(): void {
    // Resume normal enemy behavior
  }

  private randBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Wave Manager implementation
class WaveManager implements IWaveManager {
  loadWaveConfig(waveIndex: number): EnemySpawn[] {
    if (waveIndex >= WAVES.length) {
      // Infinite mode - generate procedural wave
      return this.generateInfiniteWave(waveIndex);
    }

    const wave = WAVES[waveIndex];
    return wave.enemies.map((enemy) => ({
      type: enemy.kind,
      count: enemy.count,
      spawnTime: 0,
      spawnDelay: 0,
    }));
  }

  calculateWaveDifficulty(waveIndex: number): number {
    const baseDifficulty = 1;
    const overflow = waveIndex >= WAVES.length ? waveIndex - (WAVES.length - 1) : 0;
    return baseDifficulty * (overflow > 0 ? 1 + overflow * 0.22 : 1);
  }

  getWaveDuration(waveIndex: number): number {
    // Base duration + scaling
    return 30000 + waveIndex * 5000; // 30s + 5s per wave
  }

  hasWave(waveIndex: number): boolean {
    return waveIndex >= 0; // Infinite waves supported
  }

  private generateInfiniteWave(waveIndex: number): EnemySpawn[] {
    const overflow = waveIndex - (WAVES.length - 1);
    const baseCount = 10 + overflow * 2;

    return [
      { type: 'drifter', count: baseCount, spawnTime: 0, spawnDelay: 0 },
      {
        type: 'watcher',
        count: Math.floor(baseCount * 0.6),
        spawnTime: 1000,
        spawnDelay: 0,
      },
      {
        type: 'mass',
        count: Math.floor(baseCount * 0.3),
        spawnTime: 2000,
        spawnDelay: 0,
      },
    ];
  }
}

// Enemy Spawner implementation
class EnemySpawner implements IEnemySpawner {
  processSpawnQueue(waveState: WaveState, _deltaTime: number): void {
    // Process spawn queue based on timing
    waveState.spawnQueue.forEach((spawn) => {
      if (spawn.spawnTime <= Date.now() && spawn.count > 0) {
        // Spawn logic would go here
      }
    });
  }

  findSpawnPosition(): Phaser.Math.Vector2 {
    // Pick a random position on the perimeter
    const side = Math.floor(Math.random() * 4);
    const margin = 50;

    switch (side) {
      case 0: // Top
        return new Phaser.Math.Vector2(Math.random() * GAME_WIDTH, -margin);
      case 1: // Right
        return new Phaser.Math.Vector2(GAME_WIDTH + margin, Math.random() * GAME_HEIGHT);
      case 2: // Bottom
        return new Phaser.Math.Vector2(Math.random() * GAME_WIDTH, GAME_HEIGHT + margin);
      case 3: // Left
        return new Phaser.Math.Vector2(-margin, Math.random() * GAME_HEIGHT);
      default:
        return new Phaser.Math.Vector2(GAME_WIDTH / 2, -margin);
    }
  }

  createEnemySprite(_type: string, _position: Phaser.Math.Vector2): Phaser.Physics.Arcade.Image {
    // This would be implemented to create the appropriate sprite
    // For now, return a placeholder
    return {} as Phaser.Physics.Arcade.Image;
  }
}
