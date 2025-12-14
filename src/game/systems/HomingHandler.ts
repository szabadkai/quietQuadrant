/**
 * Homing Handler - Handles heatseeker/homing projectile behavior
 * Extracted from ProjectileSystem to improve modularity
 */

import * as Phaser from "phaser";

export interface HomingConfig {
    stacks: number;
    range: number;
    turnRate: number;
}

export class HomingHandler {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    handleHeatseekingProjectiles(
        bullets: Phaser.Physics.Arcade.Group | undefined,
        config: HomingConfig,
        dt: number
    ): void {
        if (config.stacks <= 0 || !bullets) return;

        const maxTurn = config.turnRate * dt;
        if (maxTurn <= 0 || config.range <= 0) return;

        const rangeSq = config.range * config.range;
        const activeEnemies = this.getActiveEnemies();

        if (activeEnemies.length === 0) return;

        bullets.getChildren().forEach((child) => {
            const projectile = child as Phaser.Physics.Arcade.Image;
            if (!projectile.active || !projectile.visible) return;

            const body = projectile.body as Phaser.Physics.Arcade.Body;
            const speed = body.velocity.length();
            if (speed < 10) return;

            const nearest = this.findNearestEnemy(
                projectile,
                activeEnemies,
                rangeSq
            );
            if (!nearest) return;

            const desiredAngle = Phaser.Math.Angle.Between(
                projectile.x,
                projectile.y,
                nearest.x,
                nearest.y
            );
            const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
            const newAngle = Phaser.Math.Angle.RotateTo(
                currentAngle,
                desiredAngle,
                maxTurn
            );
            const vx = Math.cos(newAngle) * speed;
            const vy = Math.sin(newAngle) * speed;

            body.setVelocity(vx, vy);
            projectile.setRotation(newAngle);
        });
    }

    private getActiveEnemies(): Phaser.Physics.Arcade.Image[] {
        const activeEnemies: Phaser.Physics.Arcade.Image[] = [];
        const enemyTextures = ["drifter", "watcher", "mass", "boss"];

        this.scene.children.list.forEach((child) => {
            const img = child as Phaser.Physics.Arcade.Image;
            if (
                img.active &&
                img.texture &&
                enemyTextures.includes(img.texture.key)
            ) {
                activeEnemies.push(img);
            }
        });

        return activeEnemies;
    }

    private findNearestEnemy(
        projectile: Phaser.Physics.Arcade.Image,
        enemies: Phaser.Physics.Arcade.Image[],
        rangeSq: number
    ): Phaser.Physics.Arcade.Image | null {
        let nearest: Phaser.Physics.Arcade.Image | null = null;
        let nearestDistSq = rangeSq;

        enemies.forEach((enemy) => {
            const dx = enemy.x - projectile.x;
            const dy = enemy.y - projectile.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = enemy;
            }
        });

        return nearest;
    }
}
