/**
 * Enemy AI - Handles enemy behavior and movement patterns
 * Extracted from EnemySystem to improve modularity
 */

import * as Phaser from "phaser";

export class EnemyAI {
    updateEnemyBehavior(
        enemy: Phaser.Physics.Arcade.Image,
        time: number,
        target: Phaser.Math.Vector2,
        onShot: (
            enemy: Phaser.Physics.Arcade.Image,
            target: Phaser.Math.Vector2,
            heavy?: boolean
        ) => void,
        onBossPattern: (
            boss: Phaser.Physics.Arcade.Image,
            target: Phaser.Math.Vector2
        ) => void,
        bossNextPatternAt: number,
        setBossNextPatternAt: (time: number) => void
    ): void {
        const kind = enemy.getData("kind") as string;
        const speed = enemy.getData("speed") as number;
        const slowUntil = enemy.getData("slowUntil") as number | undefined;
        const slowFactor =
            slowUntil && slowUntil > time
                ? (enemy.getData("slowFactor") as number | undefined) ?? 1
                : 1;

        const targetVec = new Phaser.Math.Vector2(
            target.x - enemy.x,
            target.y - enemy.y
        );
        const dist = targetVec.length();
        targetVec.normalize();

        switch (kind) {
            case "drifter":
                this.updateDrifter(enemy, targetVec, speed, slowFactor);
                break;
            case "watcher":
                this.updateWatcher(
                    enemy,
                    targetVec,
                    speed,
                    slowFactor,
                    dist,
                    target,
                    onShot
                );
                break;
            case "mass":
                this.updateMass(
                    enemy,
                    targetVec,
                    speed,
                    slowFactor,
                    target,
                    onShot
                );
                break;
            case "boss":
                this.updateBoss(
                    enemy,
                    target,
                    time,
                    speed,
                    onBossPattern,
                    bossNextPatternAt,
                    setBossNextPatternAt
                );
                break;
        }
    }

    private updateDrifter(
        enemy: Phaser.Physics.Arcade.Image,
        targetVec: Phaser.Math.Vector2,
        speed: number,
        slowFactor: number
    ): void {
        enemy.setVelocity(
            targetVec.x * speed * slowFactor,
            targetVec.y * speed * slowFactor
        );
    }

    private updateWatcher(
        enemy: Phaser.Physics.Arcade.Image,
        targetVec: Phaser.Math.Vector2,
        speed: number,
        slowFactor: number,
        dist: number,
        target: Phaser.Math.Vector2,
        onShot: (
            enemy: Phaser.Physics.Arcade.Image,
            target: Phaser.Math.Vector2,
            heavy?: boolean
        ) => void
    ): void {
        if (dist > 260) {
            enemy.setVelocity(
                targetVec.x * speed * slowFactor,
                targetVec.y * speed * slowFactor
            );
        } else if (dist < 180) {
            enemy.setVelocity(
                -targetVec.x * speed * slowFactor,
                -targetVec.y * speed * slowFactor
            );
        } else {
            enemy.setVelocity(0, 0);
        }
        onShot(enemy, target);
    }

    private updateMass(
        enemy: Phaser.Physics.Arcade.Image,
        targetVec: Phaser.Math.Vector2,
        speed: number,
        slowFactor: number,
        target: Phaser.Math.Vector2,
        onShot: (
            enemy: Phaser.Physics.Arcade.Image,
            target: Phaser.Math.Vector2,
            heavy?: boolean
        ) => void
    ): void {
        enemy.setVelocity(
            targetVec.x * speed * 0.7 * slowFactor,
            targetVec.y * speed * 0.7 * slowFactor
        );
        onShot(enemy, target, true);
    }

    private updateBoss(
        boss: Phaser.Physics.Arcade.Image,
        target: Phaser.Math.Vector2,
        time: number,
        speed: number,
        onBossPattern: (
            boss: Phaser.Physics.Arcade.Image,
            target: Phaser.Math.Vector2
        ) => void,
        bossNextPatternAt: number,
        setBossNextPatternAt: (time: number) => void
    ): void {
        const targetVec = new Phaser.Math.Vector2(
            target.x - boss.x,
            target.y - boss.y
        );
        const dist = targetVec.length();

        if (dist > 200) {
            targetVec.normalize();
            boss.setVelocity(
                targetVec.x * speed * 0.5,
                targetVec.y * speed * 0.5
            );
        } else {
            boss.setVelocity(0, 0);
        }

        if (time > bossNextPatternAt) {
            onBossPattern(boss, target);
            setBossNextPatternAt(time + 2000);
        }
    }
}
