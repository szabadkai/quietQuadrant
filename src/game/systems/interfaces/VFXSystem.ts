/**
 * Visual Effects System Interface
 * Handles particle effects, screen effects, and visual feedback
 */

import type * as Phaser from "phaser";
import type { GameSystem } from "./GameSystem";

export interface IVFXSystem extends GameSystem {
    /**
     * Spawn a burst visual effect at the specified location
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param radius - Effect radius
     * @param color - Effect color
     * @param strokeOpacity - Stroke opacity (default: 0.7)
     */
    spawnBurstVisual(
        x: number,
        y: number,
        radius: number,
        color: number,
        strokeOpacity?: number
    ): void;

    /**
     * Spawn a muzzle flash effect at the specified location
     * @param x - X coordinate
     * @param y - Y coordinate
     */
    spawnMuzzleFlash(x: number, y: number): void;

    /**
     * Play critical hit feedback effects
     * @param enemy - The enemy that was critically hit
     */
    playCritFeedback(enemy: Phaser.Physics.Arcade.Image): void;

    /**
     * Update shield visual for a pilot
     * @param pilot - The pilot runtime state
     */
    updateShieldVisual(pilot: any): void;

    /**
     * Apply background tone effects
     * @param saturationBoost - Saturation boost amount
     * @param brightness - Brightness level
     */
    applyBackgroundTone(saturationBoost: number, brightness: number): void;

    /**
     * Pulse background for boss phase transitions
     * @param phase - Boss phase number
     */
    pulseBackgroundForBossPhase(phase: number): void;

    /**
     * Play boss intro pulse effect
     */
    playBossIntroPulse(): void;

    /**
     * Create a texture with the given key and drawing function
     * @param key - Texture key
     * @param draw - Drawing function
     */
    createTexture(
        key: string,
        draw: (g: Phaser.GameObjects.Graphics) => void
    ): void;

    /**
     * Set low graphics mode
     * @param enabled - Whether low graphics mode is enabled
     */
    setLowGraphicsMode(enabled: boolean): void;

    /**
     * Get whether low graphics mode is enabled
     */
    isLowGraphicsMode(): boolean;

    /**
     * Spawn a dash trail effect
     * @param origin - Origin position
     * @param dir - Direction vector
     */
    spawnDashTrail(origin: Phaser.Math.Vector2, dir: Phaser.Math.Vector2): void;

    /**
     * Setup boss intro overlay
     */
    setupBossIntroOverlay(): void;

    /**
     * Register a background FX target for color effects
     * @param obj - GameObject to register
     */
    registerBackgroundFxTarget(
        obj: Phaser.GameObjects.GameObject
    ): Phaser.FX.ColorMatrix | null;

    /**
     * Reset background effects
     */
    resetBackgroundEffects(): void;
}

export interface ParticleManager {
    /**
     * Create and manage particle effects
     */
    createParticleEffect(config: ParticleEffectConfig): void;

    /**
     * Update all active particle effects
     */
    updateParticles(delta: number): void;

    /**
     * Clear all particle effects
     */
    clearParticles(): void;
}

export interface ScreenEffects {
    /**
     * Apply screen shake effect
     */
    shake(duration: number, intensity: number): void;

    /**
     * Apply screen flash effect
     */
    flash(duration: number, r: number, g: number, b: number): void;

    /**
     * Apply background color effects
     */
    applyBackgroundEffect(effect: BackgroundEffect): void;
}

export interface ParticleEffectConfig {
    x: number;
    y: number;
    type: "burst" | "muzzleFlash" | "explosion" | "trail";
    color: number;
    radius?: number;
    duration?: number;
    alpha?: number;
    scale?: { from: number; to: number };
}

export interface BackgroundEffect {
    type: "tone" | "pulse" | "flash";
    saturation?: number;
    brightness?: number;
    duration?: number;
    color?: number;
}
