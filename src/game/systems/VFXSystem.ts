/**
 * Visual Effects System Implementation
 * Handles particle effects, screen effects, and visual feedback
 */

import type * as Phaser from "phaser";
import { BaseGameSystem } from "./interfaces/GameSystem";
import type {
    IVFXSystem,
    ParticleManager,
    ScreenEffects,
} from "./interfaces/VFXSystem";

// VFX Constants
const OBJECT_SCALE = 0.7;
const COLOR_ACCENT = 0x9ff0ff;
const COLOR_CHARGE = 0xf7d46b;
// const COLOR_PULSE = 0xa0f4ff; // Reserved for future use
const COLOR_OVERLOAD = 0xffd7a6;

export class VFXSystem extends BaseGameSystem implements IVFXSystem {
    private lowGraphics = false;
    private backgroundFxTargets: Phaser.FX.ColorMatrix[] = [];
    private backgroundFxTween?: Phaser.Tweens.Tween;
    private bossIntroOverlay?: Phaser.GameObjects.Rectangle;
    private bossIntroColor = 0xf14e4e;

    constructor() {
        super("vfx", []);
    }

    protected onInitialize(): void {
        // VFX system doesn't need specific initialization beyond base
    }

    protected onShutdown(): void {
        this.backgroundFxTween?.stop();
        this.backgroundFxTween = undefined;
        this.backgroundFxTargets = [];
        this.bossIntroOverlay?.destroy();
        this.bossIntroOverlay = undefined;
    }

    update(_time: number, _delta: number): void {
        // VFX system doesn't need regular updates
        // Effects are managed through tweens and Phaser's built-in systems
    }

    setLowGraphicsMode(enabled: boolean): void {
        this.lowGraphics = enabled;
    }

    isLowGraphicsMode(): boolean {
        return this.lowGraphics;
    }

    spawnBurstVisual(
        x: number,
        y: number,
        radius: number,
        color: number,
        strokeOpacity = 0.7
    ): void {
        if (this.lowGraphics) return;

        const scene = this.getScene();
        const circle = scene.add
            .circle(x, y, radius, color, 0.08)
            .setStrokeStyle(2, color, strokeOpacity)
            .setDepth(0.5);

        scene.tweens.add({
            targets: circle,
            alpha: { from: 0.8, to: 0 },
            scale: { from: 0.9, to: 1.15 },
            duration: 200,
            onComplete: () => circle.destroy(),
        });
    }

    spawnMuzzleFlash(x: number, y: number): void {
        if (this.lowGraphics) return;

        const scene = this.getScene();
        const flash = scene.add
            .circle(x, y, 10 * OBJECT_SCALE, COLOR_CHARGE, 0.35)
            .setDepth(2);

        scene.tweens.add({
            targets: flash,
            scale: { from: 0.6, to: 1.4 },
            alpha: { from: 0.35, to: 0 },
            duration: 140,
            onComplete: () => flash.destroy(),
        });
    }

    playCritFeedback(enemy: Phaser.Physics.Arcade.Image): void {
        const scene = this.getScene();
        scene.cameras.main.shake(80, 0.0025);

        if (this.lowGraphics) return;

        const flash = scene.add
            .circle(enemy.x, enemy.y, 16 * OBJECT_SCALE, COLOR_OVERLOAD, 0.65)
            .setDepth(1.1);

        scene.tweens.add({
            targets: flash,
            scale: { from: 0.85, to: 1.25 },
            alpha: { from: 0.65, to: 0 },
            duration: 140,
            onComplete: () => flash.destroy(),
        });
    }

    updateShieldVisual(pilot: any): void {
        if (!pilot) return;

        const scene = this.getScene();
        const active =
            pilot.shield.hp > 0 && scene.time.now <= pilot.shield.activeUntil;

        if (!pilot.shieldRing && active) {
            pilot.shieldRing = scene.add
                .arc(
                    pilot.sprite.x,
                    pilot.sprite.y,
                    34 * OBJECT_SCALE,
                    0,
                    360,
                    false,
                    COLOR_ACCENT,
                    0.2
                )
                .setStrokeStyle(3, COLOR_ACCENT, 0.9)
                .setDepth(0.9);
        }

        if (!pilot.shieldRing) return;

        pilot.shieldRing.setVisible(active);
        if (!active) return;

        pilot.shieldRing.setPosition(pilot.sprite.x, pilot.sprite.y);
        const remaining = pilot.shield.activeUntil - scene.time.now;
        const shieldDurationMs = 3000; // Default shield duration, should be configurable
        const alpha = Math.max(
            0.3,
            Math.min(0.8, remaining / shieldDurationMs)
        );
        pilot.shieldRing.setAlpha(alpha);

        const pulse = 1 + Math.sin(scene.time.now / 120) * 0.06;
        pilot.shieldRing.setScale(pulse);
    }

    applyBackgroundTone(saturationBoost: number, brightness: number): void {
        if (this.lowGraphics || this.backgroundFxTargets.length === 0) return;

        this.backgroundFxTargets.forEach((fx) => {
            fx.reset();
            fx.saturate(saturationBoost);
            fx.brightness(brightness, true);
        });
    }

    pulseBackgroundForBossPhase(phase: number): void {
        if (this.backgroundFxTween) {
            this.backgroundFxTween.stop();
            this.backgroundFxTween = undefined;
        }

        const scene = this.getScene();

        if (this.lowGraphics || this.backgroundFxTargets.length === 0) {
            scene.cameras.main.flash(220, 255, 94, 94);
            return;
        }

        const targetSaturation = 0.9 + phase * 0.25;
        const targetBrightness = 1.25 + phase * 0.1;

        this.backgroundFxTween = scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 320,
            yoyo: true,
            ease: "Quad.easeOut",
            onUpdate: (tw) => {
                const p = tw.getValue();
                if (p === null) return;
                const sat = 0 + (targetSaturation - 0) * p;
                const bright = 1 + (targetBrightness - 1) * p;
                this.applyBackgroundTone(sat, bright);
            },
            onComplete: () => {
                this.applyBackgroundTone(0, 1);
                this.backgroundFxTween = undefined;
            },
        });
    }

    playBossIntroPulse(): void {
        const scene = this.getScene();

        if (this.bossIntroOverlay) {
            scene.tweens.killTweensOf(this.bossIntroOverlay);
            this.bossIntroOverlay.setVisible(true);
            this.bossIntroOverlay.setAlpha(0);
            this.bossIntroOverlay.setFillStyle(
                this.bossIntroColor,
                this.bossIntroOverlay.fillAlpha
            );

            scene.tweens.add({
                targets: this.bossIntroOverlay,
                alpha: { from: 0, to: this.lowGraphics ? 0.4 : 0.82 },
                duration: 180,
                ease: "Quad.easeOut",
                yoyo: true,
                hold: 260,
                onComplete: () => this.bossIntroOverlay?.setVisible(false),
            });
        } else {
            const r = (this.bossIntroColor >> 16) & 0xff;
            const g = (this.bossIntroColor >> 8) & 0xff;
            const b = this.bossIntroColor & 0xff;
            scene.cameras.main.flash(220, r, g, b);
        }

        this.pulseBackgroundForBossPhase(1); // Default to phase 1
    }

    createTexture(
        key: string,
        draw: (g: Phaser.GameObjects.Graphics) => void
    ): void {
        const scene = this.getScene();

        if (scene.textures.exists(key)) return;

        const g = scene.add.graphics({ x: 0, y: 0 });
        draw(g);
        g.generateTexture(key, 64, 64);
        g.destroy();
    }

    /**
     * Register a background FX target for color effects
     */
    registerBackgroundFxTarget(
        obj: Phaser.GameObjects.GameObject
    ): Phaser.FX.ColorMatrix | null {
        if (this.lowGraphics) return null;

        const fxComponent = (
            obj as unknown as { postFX?: Phaser.GameObjects.Components.FX }
        ).postFX;
        if (!fxComponent || typeof fxComponent.addColorMatrix !== "function")
            return null;

        const fx = fxComponent.addColorMatrix();
        this.backgroundFxTargets.push(fx);
        return fx;
    }

    /**
     * Setup boss intro overlay
     */
    setupBossIntroOverlay(): void {
        const scene = this.getScene();

        this.bossIntroOverlay?.destroy();

        const overlay = scene.add
            .rectangle(
                scene.scale.width / 2,
                scene.scale.height / 2,
                scene.scale.width,
                scene.scale.height,
                this.bossIntroColor,
                0.28
            )
            .setDepth(5)
            .setScrollFactor(0)
            .setAlpha(0)
            .setBlendMode(2); // MULTIPLY blend mode

        overlay.setVisible(false);

        if (!this.lowGraphics) {
            overlay.postFX.addVignette(0.5, 0.5, 0.9, 0.95);
        }

        this.bossIntroOverlay = overlay;
    }

    /**
     * Reset background effects
     */
    resetBackgroundEffects(): void {
        this.backgroundFxTween?.stop();
        this.backgroundFxTween = undefined;
        this.applyBackgroundTone(0, 1);

        if (this.bossIntroOverlay) {
            this.bossIntroOverlay.setAlpha(0);
            this.bossIntroOverlay.setVisible(false);
        }
    }

    /**
     * Spawn a dash trail effect
     */
    spawnDashTrail(
        origin: Phaser.Math.Vector2,
        dir: Phaser.Math.Vector2
    ): void {
        if (this.lowGraphics) return;

        const scene = this.getScene();
        const length = 42 * OBJECT_SCALE;
        const width = 6 * OBJECT_SCALE;
        const angle = dir.angle();

        const rect = scene.add
            .rectangle(origin.x, origin.y, length, width, COLOR_ACCENT, 0.35)
            .setRotation(angle)
            .setDepth(0.6);

        scene.tweens.add({
            targets: rect,
            alpha: { from: 0.35, to: 0 },
            scaleX: { from: 1, to: 0.6 },
            duration: 180,
            onComplete: () => rect.destroy(),
        });
    }
}

/**
 * Particle Manager Implementation
 */
export class ParticleManagerImpl implements ParticleManager {
    private scene: Phaser.Scene;
    private activeParticles: Phaser.GameObjects.GameObject[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createParticleEffect(_config: any): void {
        // Implementation for particle effects
        // This would be expanded based on specific particle needs
    }

    updateParticles(_delta: number): void {
        // Update particle systems
        // Clean up destroyed particles
        this.activeParticles = this.activeParticles.filter(
            (particle) => particle.active
        );
    }

    clearParticles(): void {
        this.activeParticles.forEach((particle) => particle.destroy());
        this.activeParticles = [];
    }
}

/**
 * Screen Effects Implementation
 */
export class ScreenEffectsImpl implements ScreenEffects {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    shake(duration: number, intensity: number): void {
        this.scene.cameras.main.shake(duration, intensity);
    }

    flash(duration: number, r: number, g: number, b: number): void {
        this.scene.cameras.main.flash(duration, r, g, b);
    }

    applyBackgroundEffect(_effect: any): void {
        // Implementation for background effects
        // This would handle various background visual effects
    }
}
