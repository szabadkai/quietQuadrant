/**
 * Projectile system implementation
 * Handles bullet physics, collision detection, and special effects
 */

import * as Phaser from 'phaser';
import type { CollisionTarget } from '../types/GameTypes';
import { eventBus } from './EventBus';
import { BaseGameSystem } from './interfaces/GameSystem';
import type {
  CollisionResult,
  ICollisionHandler,
  IEffectProcessor,
  IProjectileSystem,
  ProjectileConfig,
  ProjectileState,
} from './interfaces/ProjectileSystem';

const OBJECT_SCALE = 0.7;
const PROJECTILE_MAX_LIFETIME_MS = 3800;
const COLOR_ACCENT = 0x9ff0ff;
const COLOR_CHARGE = 0xf7d46b;
const COLOR_OVERLOAD = 0xffd7a6;

export class ProjectileSystem extends BaseGameSystem implements IProjectileSystem {
  private bullets?: Phaser.Physics.Arcade.Group;
  private enemyBullets?: Phaser.Physics.Arcade.Group;
  private collisionHandler: ICollisionHandler;
  private effectProcessor: IEffectProcessor;

  // Configuration (would be managed by upgrade system in full implementation)
  private homingConfig = { stacks: 0, range: 0, turnRate: 0 };
  private quantumConfig = {
    active: false,
    wrapMargin: 18,
    projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
  };
  private neutronCoreConfig = { active: false, speedMultiplier: 0.6 };
  private projectileScale = 1;

  private activeProjectiles = new Map<string, ProjectileState>();
  private screenBounds?: Phaser.Geom.Rectangle;

  constructor() {
    super('projectile-system', ['player-system']);
    this.collisionHandler = new CollisionHandler();
    this.effectProcessor = new EffectProcessor();
  }

  protected onInitialize(): void {
    this.setupProjectileGroups();
    this.setupCollisions();
    this.setupEventListeners();
    this.setupScreenBounds();
  }

  protected onShutdown(): void {
    this.bullets?.destroy();
    this.enemyBullets?.destroy();
    this.activeProjectiles.clear();
    eventBus.removeAllListeners();
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    this.updateProjectilePhysics(time, dt);
    this.handleHeatseekingProjectiles(dt);
    this.handleProjectileBounds();
    this.cleanupExpiredProjectiles(time);
  }

  fireProjectile(
    type: 'player' | 'enemy',
    position: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    config: ProjectileConfig
  ): string | undefined {
    const projectileId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (type === 'player') {
      return this.spawnPlayerBullet(projectileId, position, direction, config);
    } else {
      return this.spawnEnemyBullet(projectileId, position, direction, config);
    }
  }

  removeProjectile(projectileId: string): void {
    const projectile = this.activeProjectiles.get(projectileId);
    if (projectile?.sprite) {
      projectile.sprite.destroy();
    }
    this.activeProjectiles.delete(projectileId);
  }

  getActiveProjectiles(): ProjectileState[] {
    return Array.from(this.activeProjectiles.values());
  }

  getProjectilesByType(type: 'player' | 'enemy'): ProjectileState[] {
    return this.getActiveProjectiles().filter((p) => p.type === type);
  }

  handleCollision(projectileId: string, target: CollisionTarget): CollisionResult {
    const projectile = this.activeProjectiles.get(projectileId);
    if (!projectile) {
      return {
        projectileDestroyed: false,
        targetDestroyed: false,
        damageDealt: 0,
        effectsTriggered: [],
      };
    }

    return this.collisionHandler.processCollision(projectile, target);
  }

  clearAllProjectiles(): void {
    this.bullets?.clear(true, true);
    this.enemyBullets?.clear(true, true);
    this.activeProjectiles.clear();
  }

  // Private methods
  private setupProjectileGroups(): void {
    const scene = this.getScene();

    this.bullets = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 128,
      runChildUpdate: false,
    });

    this.enemyBullets = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 256,
      runChildUpdate: false,
    });
  }

  private setupCollisions(): void {
    const _scene = this.getScene();

    // Player bullets vs enemies (handled by enemy system)
    eventBus.on('collision:bullet-enemy', (data) => {
      this.handleBulletEnemyCollision(data.bulletId, data.enemyId);
    });

    // Enemy bullets vs players (handled by player system)
    eventBus.on('collision:enemy-bullet-player', (data) => {
      this.handleEnemyBulletPlayerCollision(data.bulletId, data.playerId);
    });

    // Projectile intercept (bullet vs bullet)
    eventBus.on('collision:projectile-intercept', (data) => {
      this.handleProjectileIntercept(data.playerBulletId, data.enemyBulletId);
    });
  }

  private setupEventListeners(): void {
    eventBus.on('projectile:fired', (data) => {
      // This event comes from player or enemy systems requesting projectile creation
      const defaultConfig: ProjectileConfig = {
        damage: 10,
        speed: 500,
        pierce: 0,
        bounce: 0,
        lifetime: 3000,
        size: 1,
        effects: [],
      };

      this.fireProjectile(
        data.type,
        new Phaser.Math.Vector2(data.position.x, data.position.y),
        new Phaser.Math.Vector2(1, 0), // Default direction
        defaultConfig
      );
    });
  }

  private setupScreenBounds(): void {
    const scene = this.getScene();
    this.screenBounds = new Phaser.Geom.Rectangle(
      32,
      32,
      scene.scale.width - 64,
      scene.scale.height - 64
    );
  }

  private spawnPlayerBullet(
    id: string,
    position: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    config: ProjectileConfig
  ): string | undefined {
    if (!this.bullets) return undefined;

    const scene = this.getScene();
    const bullet = this.bullets.get(
      position.x,
      position.y,
      'bullet'
    ) as Phaser.Physics.Arcade.Image;
    if (!bullet) return undefined;

    const sizeScale = config.size * this.projectileScale * OBJECT_SCALE;
    const isHeavy = this.neutronCoreConfig.active;
    const isCharged = config.effects.includes('charged');

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(sizeScale);
    bullet.setRotation(direction.angle());

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    const projectileSpeed = config.speed * (isHeavy ? this.neutronCoreConfig.speedMultiplier : 1);

    if (isHeavy) {
      const radius = 12 * sizeScale;
      body.setCircle(radius);
      body.setOffset(bullet.displayWidth * 0.5 - radius, bullet.displayHeight * 0.5 - radius);
    } else {
      body.setSize(8 * sizeScale, 24 * sizeScale, true);
    }

    body.setVelocity(direction.x * projectileSpeed, direction.y * projectileSpeed);

    // Set projectile data
    bullet.setData('pierce', config.pierce);
    bullet.setData('damage', config.damage);
    bullet.setData('bounces', config.bounce);
    bullet.setData('tags', ['projectile', ...config.effects]);
    bullet.setData('charged', isCharged);
    bullet.setData('hitCount', 0);
    bullet.setData('lastHitAt', 0);
    bullet.setData('canFork', true);
    bullet.setData('isHeavy', isHeavy);
    bullet.setData(
      'expireAt',
      this.quantumConfig.active ? scene.time.now + this.quantumConfig.projectileLifetimeMs : null
    );

    // Set visual effects
    const tintColor = isCharged ? COLOR_CHARGE : COLOR_ACCENT;
    bullet.setTint(tintColor);

    // Create projectile state
    const projectileState: ProjectileState = {
      id,
      type: 'player',
      position: position.clone(),
      velocity: new Phaser.Math.Vector2(
        direction.x * projectileSpeed,
        direction.y * projectileSpeed
      ),
      damage: config.damage,
      pierce: config.pierce,
      bounce: config.bounce,
      lifetime: 0,
      maxLifetime: config.lifetime,
      sprite: bullet,
      tags: ['projectile', ...config.effects],
    };

    this.activeProjectiles.set(id, projectileState);
    return id;
  }

  private spawnEnemyBullet(
    id: string,
    position: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    config: ProjectileConfig
  ): string | undefined {
    if (!this.enemyBullets) return undefined;

    const scene = this.getScene();
    const bullet = this.enemyBullets.get(
      position.x,
      position.y,
      'enemy-bullet'
    ) as Phaser.Physics.Arcade.Image;
    if (!bullet) return undefined;

    const sizeScale = config.size * OBJECT_SCALE;
    const heavy = config.effects.includes('heavy');

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(heavy ? sizeScale * 1.5 : sizeScale);
    bullet.setVelocity(direction.x * config.speed, direction.y * config.speed);
    bullet.setData('damage', heavy ? config.damage * 2 : config.damage);
    bullet.setData('heavy', heavy);

    // Set bullet lifetime
    scene.time.delayedCall(config.lifetime, () => {
      if (bullet.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
        this.activeProjectiles.delete(id);
      }
    });

    // Create projectile state
    const projectileState: ProjectileState = {
      id,
      type: 'enemy',
      position: position.clone(),
      velocity: new Phaser.Math.Vector2(direction.x * config.speed, direction.y * config.speed),
      damage: config.damage,
      pierce: 0,
      bounce: 0,
      lifetime: 0,
      maxLifetime: config.lifetime,
      sprite: bullet,
      tags: ['enemy-projectile', ...config.effects],
    };

    this.activeProjectiles.set(id, projectileState);
    return id;
  }

  private updateProjectilePhysics(_time: number, delta: number): void {
    // Update projectile states
    for (const [id, projectile] of this.activeProjectiles) {
      projectile.lifetime += delta;

      if (projectile.sprite) {
        projectile.position.x = projectile.sprite.x;
        projectile.position.y = projectile.sprite.y;

        const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
        projectile.velocity.x = body.velocity.x;
        projectile.velocity.y = body.velocity.y;
      }

      // Process special behaviors
      this.effectProcessor.processSpecialBehaviors(projectile, delta);

      // Check for expiration
      if (projectile.lifetime >= projectile.maxLifetime) {
        this.effectProcessor.handleExpiration(projectile);
        this.removeProjectile(id);
      }
    }
  }

  private handleHeatseekingProjectiles(dt: number): void {
    if (this.homingConfig.stacks <= 0) return;

    const maxTurn = this.homingConfig.turnRate * dt;
    if (maxTurn <= 0 || this.homingConfig.range <= 0) return;

    const rangeSq = this.homingConfig.range * this.homingConfig.range;

    // Get active enemies from enemy system
    const activeEnemies = this.getActiveEnemiesFromSystem();
    if (activeEnemies.length === 0) return;

    this.getProjectilesByType('player').forEach((projectile) => {
      if (!projectile.sprite) return;

      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
      const speed = body.velocity.length();
      if (speed < 10) return;

      // Find nearest enemy
      let nearest: CollisionTarget | null = null;
      let nearestDistSq = rangeSq;

      activeEnemies.forEach((enemy) => {
        const dx = enemy.x - projectile.position.x;
        const dy = enemy.y - projectile.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearest = enemy;
        }
      });

      if (!nearest) return;

      // Apply homing behavior
      const desiredAngle = Phaser.Math.Angle.Between(
        projectile.position.x,
        projectile.position.y,
        nearest.x,
        nearest.y
      );
      const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
      const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, desiredAngle, maxTurn);
      const vx = Math.cos(newAngle) * speed;
      const vy = Math.sin(newAngle) * speed;

      body.setVelocity(vx, vy);
      projectile.sprite.setRotation(newAngle);

      // Update projectile state
      projectile.velocity.x = vx;
      projectile.velocity.y = vy;
    });
  }

  private handleProjectileBounds(): void {
    if (!this.screenBounds) return;

    const margin = 32;
    const left = this.screenBounds.left - margin;
    const right = this.screenBounds.right + margin;
    const top = this.screenBounds.top - margin;
    const bottom = this.screenBounds.bottom + margin;

    this.getActiveProjectiles().forEach((projectile) => {
      if (!projectile.sprite) return;

      const scene = this.getScene();
      const proj = projectile.sprite;
      const body = proj.body as Phaser.Physics.Arcade.Body;

      // Check expiration time
      const expireAt = proj.getData('expireAt') as number | null;
      if (expireAt && scene.time.now > expireAt) {
        this.removeProjectile(projectile.id);
        return;
      }

      // Handle quantum wrapping
      if (this.quantumConfig.active) {
        const wrap = this.quantumConfig.wrapMargin;
        if (proj.x < left) proj.x = right - wrap;
        else if (proj.x > right) proj.x = left + wrap;
        if (proj.y < top) proj.y = bottom - wrap;
        else if (proj.y > bottom) proj.y = top + wrap;
        return;
      }

      // Handle bouncing
      const bounces = projectile.bounce;
      let outOfBounds = false;

      if (proj.x < left || proj.x > right) {
        outOfBounds = true;
        if (bounces > 0) {
          body.velocity.x = -body.velocity.x;
          projectile.bounce -= 1;
          proj.x = proj.x < left ? left : right;
        }
      }

      if (proj.y < top || proj.y > bottom) {
        outOfBounds = true;
        if (bounces > 0) {
          body.velocity.y = -body.velocity.y;
          projectile.bounce -= 1;
          proj.y = proj.y < top ? top : bottom;
        }
      }

      // Remove if out of bounds and no bounces left
      if (outOfBounds && projectile.bounce <= 0) {
        this.removeProjectile(projectile.id);
      }
    });
  }

  private cleanupExpiredProjectiles(_time: number): void {
    for (const [id, projectile] of this.activeProjectiles) {
      if (projectile.lifetime >= projectile.maxLifetime) {
        this.removeProjectile(id);
      }
    }
  }

  private handleBulletEnemyCollision(bulletId: string, enemyId: string): void {
    const projectile = this.activeProjectiles.get(bulletId);
    if (!projectile) return;

    // Apply damage and effects
    const damage = projectile.damage;
    const pierceLeft = projectile.pierce;

    eventBus.emit('enemy:damaged', {
      enemyId,
      damage,
      remainingHealth: 0, // Would be calculated by enemy system
    });

    // Handle special effects
    this.effectProcessor.applyEffects(projectile.tags, projectile);

    // Handle pierce
    if (pierceLeft > 0) {
      projectile.pierce -= 1;
    } else {
      this.removeProjectile(bulletId);
    }
  }

  private handleEnemyBulletPlayerCollision(bulletId: string, _playerId: string): void {
    const projectile = this.activeProjectiles.get(bulletId);
    if (!projectile) return;

    // Remove enemy bullet on player hit
    this.removeProjectile(bulletId);

    eventBus.emit('player:health-changed', {
      health: 0, // Would be calculated by player system
      maxHealth: 0,
    });
  }

  private handleProjectileIntercept(playerBulletId: string, enemyBulletId: string): void {
    // Remove both projectiles when they collide
    this.removeProjectile(playerBulletId);
    this.removeProjectile(enemyBulletId);
  }

  private getActiveEnemiesFromSystem(): CollisionTarget[] {
    // This would get enemies from the enemy system
    // For now, return empty array
    return [];
  }
}

// Collision Handler implementation
class CollisionHandler implements ICollisionHandler {
  checkCollision(projectile: ProjectileState, target: CollisionTarget): boolean {
    if (!projectile.sprite || !target) return false;

    // Simple distance-based collision check
    const dx = projectile.position.x - target.x;
    const dy = projectile.position.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < 20; // Simple collision radius
  }

  processCollisionEffects(projectile: ProjectileState, _target: CollisionTarget): string[] {
    const effects: string[] = [];

    // Process projectile tags for effects
    if (projectile.tags.includes('explosive')) {
      effects.push('explosion');
    }

    if (projectile.tags.includes('charged')) {
      effects.push('charge-burst');
    }

    return effects;
  }

  calculateDamage(projectile: ProjectileState, _target: CollisionTarget): number {
    let damage = projectile.damage;

    // Apply damage modifiers based on projectile tags
    if (projectile.tags.includes('charged')) {
      damage *= 1.5;
    }

    if (projectile.tags.includes('crit')) {
      damage *= 2;
    }

    return damage;
  }

  processCollision(projectile: ProjectileState, target: CollisionTarget): CollisionResult {
    const effects = this.processCollisionEffects(projectile, target);
    const damage = this.calculateDamage(projectile, target);

    return {
      projectileDestroyed: projectile.pierce <= 0,
      targetDestroyed: false, // Would be determined by target's health
      damageDealt: damage,
      effectsTriggered: effects,
    };
  }
}

// Effect Processor implementation
class EffectProcessor implements IEffectProcessor {
  applyEffects(effects: string[], projectile: ProjectileState, target?: CollisionTarget): void {
    effects.forEach((effect) => {
      switch (effect) {
        case 'explosive':
          this.applyExplosiveEffect(projectile, target);
          break;
        case 'charged':
          this.applyChargedEffect(projectile, target);
          break;
        case 'homing':
          this.applyHomingEffect(projectile);
          break;
      }
    });
  }

  processSpecialBehaviors(projectile: ProjectileState, _deltaTime: number): void {
    // Handle special projectile behaviors like splitting, chaining, etc.
    if (projectile.tags.includes('splitting') && projectile.tags.includes('canFork')) {
      this.processSplittingBehavior(projectile);
    }
  }

  handleExpiration(projectile: ProjectileState): void {
    // Handle effects when projectile expires
    if (projectile.tags.includes('explosive')) {
      eventBus.emit('vfx:explosion', {
        position: {
          x: projectile.position.x,
          y: projectile.position.y,
        },
        radius: 50,
        color: COLOR_OVERLOAD,
      });
    }
  }

  private applyExplosiveEffect(_projectile: ProjectileState, target?: CollisionTarget): void {
    if (!target) return;

    eventBus.emit('vfx:explosion', {
      position: { x: target.x, y: target.y },
      radius: 60,
      color: COLOR_OVERLOAD,
    });
  }

  private applyChargedEffect(_projectile: ProjectileState, target?: CollisionTarget): void {
    if (!target) return;

    eventBus.emit('vfx:particle-burst', {
      position: { x: target.x, y: target.y },
      type: 'charge-burst',
    });
  }

  private applyHomingEffect(projectile: ProjectileState): void {
    // Mark projectile as homing-enabled
    if (!projectile.tags.includes('homing')) {
      projectile.tags.push('homing');
    }
  }

  private processSplittingBehavior(projectile: ProjectileState): void {
    // Handle projectile splitting logic
    if (projectile.tags.includes('canFork')) {
      projectile.tags = projectile.tags.filter((tag) => tag !== 'canFork');

      eventBus.emit('projectile:split', {
        parentId: projectile.id,
        position: {
          x: projectile.position.x,
          y: projectile.position.y,
        },
        forkCount: 2,
      });
    }
  }
}
