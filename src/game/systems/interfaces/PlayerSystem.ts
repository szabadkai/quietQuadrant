/**
 * Player system interface and related types
 */

import type * as Phaser from 'phaser';
import type { InputState } from '../../types/InputTypes';
import type { GameSystem } from './GameSystem';

export interface PlayerStats {
  moveSpeed: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectiles: number;
  pierce: number;
  bounce: number;
  maxHealth: number;
  health: number;
  critChance: number;
  critMultiplier: number;
}

export interface AbilityState {
  dashCooldownMs: number;
  dashDurationMs: number;
  nextDashAt: number;
  activeUntil: number;
}

export interface PlayerState {
  stats: PlayerStats;
  abilities: AbilityState;
  position: Phaser.Math.Vector2;
  lastAimDirection: Phaser.Math.Vector2;
  lastShotAt: number;
  invulnUntil: number;
}

export interface IPlayerSystem extends GameSystem {
  /**
   * Get the current player stats
   */
  getPlayerStats(): PlayerStats;

  /**
   * Update player stats
   */
  updatePlayerStats(stats: Partial<PlayerStats>): void;

  /**
   * Get the current player state
   */
  getPlayerState(): PlayerState | undefined;

  /**
   * Handle player movement input
   */
  handleMovement(deltaTime: number, inputState: InputState): void;

  /**
   * Handle player shooting input
   */
  handleShooting(inputState: InputState): void;

  /**
   * Handle player abilities (dash, etc.)
   */
  handleAbilities(inputState: InputState): void;

  /**
   * Apply damage to the player
   */
  takeDamage(amount: number): void;

  /**
   * Heal the player
   */
  heal(amount: number): void;

  /**
   * Check if player is alive
   */
  isAlive(): boolean;
}

export interface IPlayerController {
  /**
   * Process input for player movement
   */
  processMovementInput(inputState: InputState): Phaser.Math.Vector2;

  /**
   * Process input for player aiming
   */
  processAimingInput(inputState: InputState): Phaser.Math.Vector2;

  /**
   * Check if fire button is pressed
   */
  isFirePressed(inputState: InputState): boolean;

  /**
   * Check if dash button is pressed
   */
  isDashPressed(inputState: InputState): boolean;
}
