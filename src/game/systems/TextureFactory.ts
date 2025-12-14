/**
 * Texture Factory - Handles game texture creation
 * Extracted from MainScene to improve modularity
 */

import * as Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../GameConfig";

export class TextureFactory {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createStarfieldTextures(): void {
        const layers = [
            {
                key: "starfield-far",
                size: 200,
                count: 24,
                color: 0x52657c,
                alpha: [0.14, 0.32] as const,
                radius: [0.9, 1.6] as const,
            },
            {
                key: "starfield-mid",
                size: 220,
                count: 28,
                color: 0x7bd3ff,
                alpha: [0.2, 0.45] as const,
                radius: [1, 2.2] as const,
            },
            {
                key: "starfield-near",
                size: 240,
                count: 20,
                color: 0xcde9ff,
                alpha: [0.35, 0.75] as const,
                radius: [1.4, 2.8] as const,
            },
        ];

        layers.forEach((layer) => {
            if (this.scene.textures.exists(layer.key)) return;

            const g = this.scene.add.graphics({ x: 0, y: 0 });
            for (let i = 0; i < layer.count; i++) {
                const x = Phaser.Math.Between(0, layer.size);
                const y = Phaser.Math.Between(0, layer.size);
                const alpha = Phaser.Math.FloatBetween(
                    layer.alpha[0],
                    layer.alpha[1]
                );
                const radius = Phaser.Math.FloatBetween(
                    layer.radius[0],
                    layer.radius[1]
                );

                g.fillStyle(layer.color, alpha);
                g.fillCircle(x, y, radius);

                if (Math.random() < 0.25) {
                    g.fillStyle(layer.color, alpha * 0.45);
                    g.fillCircle(x, y, radius + 1.1);
                }
            }
            g.generateTexture(layer.key, layer.size, layer.size);
            g.destroy();
        });
    }

    createGameTextures(): void {
        this.createPlayerTexture();
        this.createDrifterTexture();
        this.createWatcherTexture();
        this.createMassTexture();
        this.createBossTexture();
        this.createBulletTexture();
        this.createEnemyBulletTexture();
        this.createXpTexture();
    }

    private createTexture(
        key: string,
        draw: (g: Phaser.GameObjects.Graphics) => void
    ): void {
        if (this.scene.textures.exists(key)) return;

        const g = this.scene.add.graphics({ x: 0, y: 0 });
        draw(g);
        g.generateTexture(key, 64, 64);
        g.destroy();
    }

    private createPlayerTexture(): void {
        this.createTexture("player", (g) => {
            const c = 32;
            g.fillStyle(0x0f1b2d, 1);
            g.fillTriangle(c + 20, c, c - 12, c - 14, c - 12, c + 14);
            g.lineStyle(2, 0x9ff0ff);
            g.strokeTriangle(c + 20, c, c - 12, c - 14, c - 12, c + 14);
            g.fillStyle(0x7ad1ff, 1);
            g.fillTriangle(c + 6, c, c - 4, c - 6, c - 4, c + 6);
            g.fillStyle(0x11344d, 1);
            g.fillRect(c - 18, c - 8, 8, 4);
            g.fillRect(c - 18, c + 4, 8, 4);
            g.lineStyle(2, 0x9ff0ff, 0.9);
            g.lineBetween(c - 12, c - 10, c + 4, c - 4);
            g.lineBetween(c - 12, c + 10, c + 4, c + 4);
            g.fillStyle(0x9ff0ff, 0.8);
            g.fillRect(c - 6, c - 5, 10, 10);
        });
    }

    private createDrifterTexture(): void {
        this.createTexture("drifter", (g) => {
            const c = 32;
            g.lineStyle(3, 0xa8b0c2);
            g.strokeCircle(c, c, 16);
            g.lineStyle(2, 0x6dd6ff, 0.9);
            g.strokeCircle(c, c, 11);
            g.fillStyle(0x0d1a28, 1);
            g.fillCircle(c, c, 9);
            g.fillStyle(0x6dd6ff, 1);
            g.fillCircle(c, c, 5);
            g.fillStyle(0xa8b0c2, 1);
            g.fillRect(c - 4, c + 14, 8, 10);
            g.fillRect(c - 20, c - 2, 6, 10);
            g.fillRect(c + 14, c - 2, 6, 10);
        });
    }

    private createWatcherTexture(): void {
        this.createTexture("watcher", (g) => {
            const c = 32;
            g.fillStyle(0x0f1626, 1);
            g.fillRoundedRect(c - 16, c - 16, 32, 32, 6);
            g.lineStyle(3, 0x8aa3e0);
            g.strokeRoundedRect(c - 16, c - 16, 32, 32, 6);
            g.lineStyle(2, 0x6dd6ff, 0.8);
            g.lineBetween(c - 12, c, c + 12, c);
            g.lineBetween(c, c - 12, c, c + 12);
            g.fillStyle(0x6dd6ff, 1);
            g.fillCircle(c, c, 7);
            g.fillStyle(0x182744, 1);
            g.fillCircle(c, c, 4);
            g.fillStyle(0xf4f6fb, 0.8);
            g.fillCircle(c + 3, c - 2, 2);
        });
    }

    private createMassTexture(): void {
        this.createTexture("mass", (g) => {
            const c = 32;
            const hull = [
                { x: c, y: c - 20 },
                { x: c + 18, y: c },
                { x: c, y: c + 20 },
                { x: c - 18, y: c },
            ];
            g.fillStyle(0x26120f, 1);
            g.fillPoints(hull, true);
            g.lineStyle(3, 0xe0a86f);
            g.strokePoints(hull, true);
            g.fillStyle(0x6b3a21, 1);
            g.fillRect(c - 6, c - 10, 12, 7);
            g.lineStyle(2, 0xe0a86f, 0.8);
            g.lineBetween(c - 10, c - 4, c + 10, c - 4);
            g.lineBetween(c - 10, c + 4, c + 10, c + 4);
        });
    }

    private createBossTexture(): void {
        this.createTexture("boss", (g) => {
            const c = 32;
            g.fillStyle(0x180c13, 1);
            g.fillEllipse(c, c, 58, 40);
            g.lineStyle(4, 0xf14e4e);
            g.strokeEllipse(c, c, 58, 40);
            g.fillStyle(0x2a0f18, 1);
            g.fillEllipse(c, c, 46, 28);
            g.fillStyle(0xf14e4e, 0.8);
            g.fillEllipse(c, c, 32, 18);
            g.fillStyle(0xfafafa, 1);
            g.fillCircle(c + 2, c - 2, 6);
            g.fillStyle(0x0b0f13, 1);
            g.fillCircle(c + 4, c - 2, 3);
            g.lineStyle(3, 0xf14e4e, 0.9);
            g.beginPath();
            g.moveTo(c - 30, c - 10);
            g.lineTo(c - 18, c - 24);
            g.lineTo(c - 10, c - 6);
            g.strokePath();
            g.beginPath();
            g.moveTo(c + 30, c - 10);
            g.lineTo(c + 18, c - 24);
            g.lineTo(c + 10, c - 6);
            g.strokePath();
        });
    }

    private createBulletTexture(): void {
        this.createTexture("bullet", (g) => {
            const c = 32;
            g.fillStyle(0xfafafa, 1);
            g.fillRoundedRect(c - 2, c - 12, 4, 18, 2);
            g.fillStyle(0x9ff0ff, 0.8);
            g.fillRoundedRect(c - 1, c - 14, 2, 6, 1);
        });
    }

    private createEnemyBulletTexture(): void {
        this.createTexture("enemy-bullet", (g) => {
            const c = 32;
            g.fillStyle(0xf14e4e);
            g.fillRoundedRect(c - 2, c - 10, 4, 16, 2);
            g.fillStyle(0xffc2c2, 0.8);
            g.fillRoundedRect(c - 1, c - 12, 2, 5, 1);
        });
    }

    private createXpTexture(): void {
        this.createTexture("xp", (g) => {
            const c = 32;
            const gem = [
                { x: c, y: c - 8 },
                { x: c + 6, y: c },
                { x: c, y: c + 8 },
                { x: c - 6, y: c },
            ];
            g.fillStyle(0x6dd6ff, 1);
            g.fillPoints(gem, true);
            g.lineStyle(2, 0x9ff0ff, 0.9);
            g.strokePoints(gem, true);
            g.fillStyle(0xf4f6fb, 0.9);
            g.fillTriangle(c - 1, c - 4, c + 3, c, c - 1, c + 4);
        });
    }
}
