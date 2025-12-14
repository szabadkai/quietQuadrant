/**
 * Projectile Bounds Handler - Handles projectile boundary checking and wrapping
 * Extracted from ProjectileSystem to improve modularity
 */

import * as Phaser from "phaser";
import type { ProjectileSystemConfig } from "./ProjectileSystem";

export class ProjectileBoundsHandler {
    private screenBounds?: Phaser.Geom.Rectangle;
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.setupScreenBounds();
    }

    private setupScreenBounds(): void {
        this.screenBounds = new Phaser.Geom.Rectangle(
            32,
            32,
            this.scene.scale.width - 64,
            this.scene.scale.height - 64
        );
    }

    handleProjectileBounds(
        bullets: Phaser.Physics.Arcade.Group | undefined,
        enemyBullets: Phaser.Physics.Arcade.Group | undefined,
        config: ProjectileSystemConfig
    ): void {
        if (!this.screenBounds) return;

        const margin = 32;
        const left = this.screenBounds.left - margin;
        const right = this.screenBounds.right + margin;
        const top = this.screenBounds.top - margin;
        const bottom = this.screenBounds.bottom + margin;

        // Handle player bullets
        if (bullets) {
            bullets.getChildren().forEach((child) => {
                const proj = child as Phaser.Physics.Arcade.Image;
                if (!proj.active || !proj.visible) return;

                const body = proj.body as Phaser.Physics.Arcade.Body;
                const expireAt = proj.getData("expireAt") as number | null;

                if (expireAt && this.scene.time.now > expireAt) {
                    proj.destroy();
                    return;
                }

                // Handle quantum wrapping
                if (config.quantumConfig.active) {
                    const wrap = config.quantumConfig.wrapMargin;
                    if (proj.x < left) proj.x = right - wrap;
                    else if (proj.x > right) proj.x = left + wrap;
                    if (proj.y < top) proj.y = bottom - wrap;
                    else if (proj.y > bottom) proj.y = top + wrap;
                    return;
                }

                let bounces = (proj.getData("bounces") as number) ?? 0;
                let bounced = false;
                let outOfBounds = false;

                // Handle bouncing
                if (proj.x < left) {
                    proj.x = left;
                    outOfBounds = true;
                    if (bounces > 0) {
                        body.velocity.x = Math.abs(body.velocity.x);
                        bounces -= 1;
                        bounced = true;
                    }
                } else if (proj.x > right) {
                    proj.x = right;
                    outOfBounds = true;
                    if (bounces > 0) {
                        body.velocity.x = -Math.abs(body.velocity.x);
                        bounces -= 1;
                        bounced = true;
                    }
                }

                if (proj.y < top) {
                    proj.y = top;
                    outOfBounds = true;
                    if (bounces > 0) {
                        body.velocity.y = Math.abs(body.velocity.y);
                        bounces -= 1;
                        bounced = true;
                    }
                } else if (proj.y > bottom) {
                    proj.y = bottom;
                    outOfBounds = true;
                    if (bounces > 0) {
                        body.velocity.y = -Math.abs(body.velocity.y);
                        bounces -= 1;
                        bounced = true;
                    }
                }

                if (bounced) {
                    proj.setData("bounces", bounces);
                } else if (outOfBounds) {
                    proj.destroy();
                }
            });
        }

        // Handle enemy bullets
        if (enemyBullets) {
            enemyBullets.getChildren().forEach((child) => {
                const proj = child as Phaser.Physics.Arcade.Image;
                if (!proj.active || !proj.visible) return;

                if (
                    proj.x < left ||
                    proj.x > right ||
                    proj.y < top ||
                    proj.y > bottom
                ) {
                    proj.destroy();
                }
            });
        }
    }

    getScreenBounds(): Phaser.Geom.Rectangle | undefined {
        return this.screenBounds;
    }
}
