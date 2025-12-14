/**
 * Enemy system interface and related types
 */

import type * as Phaser from 'phaser';
import type { GameSystem } from './GameSystem';

export interface EnemyState {
  type: string;
  health: number;
  maxHealth: number;
  position: Phaser.Math.Vector2;
  velocity: Phaser.Math.Vector2;
  lastActionTime: number;
  sprite?: Phaser.Physics.Arcade.Image;
}

export interface WaveState {
  index: number;
  active: boolean;
  remainingEnemies: number;
  spawnQueue: EnemySpawn[];
  nextSpawnTime: number;
}

export interface EnemySpawn {
  type: string;
  count: number;
  spawnTime: number;
  spawnDelay: number;
}

export interface IEnemySystem extends GameSystem {
  /**
   * Start a new wave
   */
  startWave(waveIndex: number): void;

  /**
   * Get the current wave state
   */
  getCurrentWave(): WaveState | undefined;

  /**
   * Spawn an enemy of the specified type
   */
  spawnEnemy(type: string, position?: Phaser.Math.Vector2): EnemyState | undefined;

  /**
   * Remove an enemy
   */
  removeEnemy(enemyId: string): void;

  /**
   * Get all active enemies
   */
  getActiveEnemies(): EnemyState[];

  /**
   * Apply damage to an enemy
   */
  damageEnemy(enemyId: string, damage: number): boolean;

  /**
   * Check if the current wave is complete
   */
  isWaveComplete(): boolean;

  /**
   * Get the number of remaining enemies
   */
  getRemainingEnemyCount(): number;
}

export interface IWaveManager {
  /**
   * Load wave configuration
   */
  loadWaveConfig(waveIndex: number): EnemySpawn[];

  /**
   * Calculate wave difficulty
   */
  calculateWaveDifficulty(waveIndex: number): number;

  /**
   * Get wave duration
   */
  getWaveDuration(waveIndex: number): number;

  /**
   * Check if wave exists
   */
  hasWave(waveIndex: number): boolean;
}

export interface IEnemySpawner {
  /**
   * Spawn enemies from the spawn queue
   */
  processSpawnQueue(waveState: WaveState, deltaTime: number): void;

  /**
   * Find a valid spawn position
   */
  findSpawnPosition(): Phaser.Math.Vector2;

  /**
   * Create enemy sprite
   */
  createEnemySprite(type: string, position: Phaser.Math.Vector2): Phaser.Physics.Arcade.Image;
}
