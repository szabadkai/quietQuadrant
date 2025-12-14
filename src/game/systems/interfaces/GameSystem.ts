/**
 * Core system interface for the game architecture
 * All game systems must implement this interface
 */

import type * as Phaser from 'phaser';

export interface GameSystem {
  /**
   * Initialize the system with the Phaser scene
   * Called once when the system is registered
   */
  initialize(scene: Phaser.Scene): void;

  /**
   * Update the system each frame
   * @param time - Current time in milliseconds
   * @param delta - Time elapsed since last frame in milliseconds
   */
  update(time: number, delta: number): void;

  /**
   * Shutdown the system and clean up resources
   * Called when the scene is destroyed or system is unregistered
   */
  shutdown(): void;

  /**
   * Get the system's unique identifier
   */
  readonly systemId: string;

  /**
   * Get the system's dependencies (other systems this system requires)
   */
  readonly dependencies: string[];

  /**
   * Whether the system is currently active
   */
  readonly isActive: boolean;
}

export interface SystemConfig {
  enabled: boolean;
  priority: number;
  dependencies: string[];
}

export interface GameSystemsConfig {
  [systemName: string]: SystemConfig;
}

/**
 * Base abstract class that provides common system functionality
 */
export abstract class BaseGameSystem implements GameSystem {
  protected scene?: Phaser.Scene;
  protected _isActive = false;

  constructor(
    public readonly systemId: string,
    public readonly dependencies: string[] = []
  ) {}

  get isActive(): boolean {
    return this._isActive;
  }

  initialize(scene: Phaser.Scene): void {
    this.scene = scene;
    this._isActive = true;
    this.onInitialize();
  }

  shutdown(): void {
    this.onShutdown();
    this._isActive = false;
    this.scene = undefined;
  }

  abstract update(time: number, delta: number): void;

  /**
   * Override this method to perform system-specific initialization
   */
  protected onInitialize(): void {
    // Default implementation does nothing
  }

  /**
   * Override this method to perform system-specific cleanup
   */
  protected onShutdown(): void {
    // Default implementation does nothing
  }

  /**
   * Get the Phaser scene (throws if not initialized)
   */
  protected getScene(): Phaser.Scene {
    if (!this.scene) {
      throw new Error(`System ${this.systemId} is not initialized`);
    }
    return this.scene;
  }
}
