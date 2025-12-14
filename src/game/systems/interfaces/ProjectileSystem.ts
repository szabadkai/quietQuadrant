/**
 * Projectile system interface and related types
 */

import type * as Phaser from 'phaser';
import type { CollisionTarget } from '../../types/GameTypes';
import type { GameSystem } from './GameSystem';

export interface ProjectileState {
  id: string;
  type: 'player' | 'enemy';
  position: Phaser.Math.Vector2;
  velocity: Phaser.Math.Vector2;
  damage: number;
  pierce: number;
  bounce: number;
  lifetime: number;
  maxLifetime: number;
  sprite?: Phaser.Physics.Arcade.Image;
  tags: string[];
}

export interface ProjectileConfig {
  damage: number;
  speed: number;
  pierce: number;
  bounce: number;
  lifetime: number;
  size: number;
  effects: string[];
}

export interface CollisionResult {
  projectileDestroyed: boolean;
  targetDestroyed: boolean;
  damageDealt: number;
  effectsTriggered: string[];
}

export interface IProjectileSystem extends GameSystem {
  /**
   * Fire a projectile from the specified position
   */
  fireProjectile(
    type: 'player' | 'enemy',
    position: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    config: ProjectileConfig
  ): string | undefined;

  /**
   * Remove a projectile
   */
  removeProjectile(projectileId: string): void;

  /**
   * Get all active projectiles
   */
  getActiveProjectiles(): ProjectileState[];

  /**
   * Get projectiles by type
   */
  getProjectilesByType(type: 'player' | 'enemy'): ProjectileState[];

  /**
   * Handle projectile collision with target
   */
  handleCollision(projectileId: string, target: CollisionTarget): CollisionResult;

  /**
   * Clear all projectiles
   */
  clearAllProjectiles(): void;
}

export interface ICollisionHandler {
  /**
   * Check collision between projectile and target
   */
  checkCollision(projectile: ProjectileState, target: CollisionTarget): boolean;

  /**
   * Process collision effects
   */
  processCollisionEffects(projectile: ProjectileState, target: CollisionTarget): string[];

  /**
   * Calculate damage after modifiers
   */
  calculateDamage(projectile: ProjectileState, target: CollisionTarget): number;
}

export interface IEffectProcessor {
  /**
   * Apply projectile effects
   */
  applyEffects(effects: string[], projectile: ProjectileState, target?: CollisionTarget): void;

  /**
   * Process special projectile behaviors (homing, splitting, etc.)
   */
  processSpecialBehaviors(projectile: ProjectileState, deltaTime: number): void;

  /**
   * Handle projectile expiration effects
   */
  handleExpiration(projectile: ProjectileState): void;
}
