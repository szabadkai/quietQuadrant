/**
 * Game entity type definitions
 */

export interface GameEntity {
  id: string;
  position: { x: number; y: number };
  health?: number;
  [key: string]: unknown;
}

export interface EnemyEntity extends GameEntity {
  type: string;
  health: number;
  maxHealth: number;
}

export interface PlayerEntity extends GameEntity {
  health: number;
  maxHealth: number;
  level: number;
}

export type CollisionTarget = GameEntity | EnemyEntity | PlayerEntity;
