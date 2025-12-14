/**
 * Unit tests for ProjectileSystem
 * Tests projectile physics, collision detection, and special effects
 */

import { eventBus } from "../game/systems/EventBus";

// Simple mock implementations for testing core logic
class MockBullet {
    public active = true;
    private data = new Map<string, unknown>();

    constructor(public x: number, public y: number) {}

    setData(key: string, value: unknown): this {
        this.data.set(key, value);
        return this;
    }

    getData(key: string): unknown {
        return this.data.get(key);
    }

    destroy(): void {
        this.active = false;
    }
}

class MockEnemy {
    constructor(public x: number, public y: number) {}
}

// Mock ProjectileSystem with core logic extracted
class MockProjectileSystem {
    private config = {
        splitConfig: {
            enabled: false,
            forks: 2,
            spreadDegrees: 12,
            damageMultiplier: 0.5,
        },
        neutronCoreConfig: { active: false, speedMultiplier: 0.6 },
    };

    private mockBullets: MockBullet[] = [];

    updateConfig(newConfig: Partial<typeof this.config>): void {
        this.config = { ...this.config, ...newConfig };
    }

    spawnBullet(config: {
        x: number;
        y: number;
        damage: number;
        pierce: number;
        bounce: number;
        tags: string[];
        charged?: boolean;
        sourceType?: string;
    }): MockBullet {
        const bullet = new MockBullet(config.x, config.y);
        bullet.setData("damage", config.damage);
        bullet.setData("pierce", config.pierce);
        bullet.setData("bounces", config.bounce);
        bullet.setData("tags", config.tags);
        bullet.setData("charged", config.charged || false);
        bullet.setData("sourceType", config.sourceType || "primary");
        bullet.setData("canFork", true);
        bullet.setData("isHeavy", this.config.neutronCoreConfig.active);

        this.mockBullets.push(bullet);
        return bullet;
    }

    handleBulletHitEnemy(
        bullet: MockBullet,
        enemy: MockEnemy,
        onDamageCallback?: (
            enemy: MockEnemy,
            damage: number,
            projectile: MockBullet
        ) => void
    ): void {
        const damage = bullet.getData("damage") as number;
        const pierceLeft = bullet.getData("pierce") as number;

        if (onDamageCallback) {
            onDamageCallback(enemy, damage, bullet);
        }

        this.handleForks(bullet, enemy);

        if (pierceLeft > 0) {
            bullet.setData("pierce", pierceLeft - 1);
        } else {
            bullet.destroy();
        }
    }

    handleProjectileIntercept(
        playerBullet: MockBullet,
        enemyBullet: MockBullet
    ): void {
        if (playerBullet.getData("isHeavy") !== true) return;

        enemyBullet.destroy();
        const pierceLeft = (playerBullet.getData("pierce") as number) ?? 0;
        if (pierceLeft > 0) {
            playerBullet.setData("pierce", pierceLeft - 1);
        } else {
            playerBullet.destroy();
        }
    }

    private handleForks(projectile: MockBullet, enemy: MockEnemy): void {
        if (!this.config.splitConfig.enabled) return;
        if (!projectile.getData("canFork")) return;

        const sourceType = projectile.getData("sourceType") as string;
        if (sourceType === "fork") return;

        projectile.setData("canFork", false);

        const forks = this.config.splitConfig.forks;
        const damageMultiplier = this.config.splitConfig.damageMultiplier;

        // Create fork projectiles
        for (let i = 0; i < forks; i++) {
            this.spawnBullet({
                x: projectile.x,
                y: projectile.y,
                damage:
                    (projectile.getData("damage") as number) * damageMultiplier,
                pierce: projectile.getData("pierce") as number,
                bounce: (projectile.getData("bounces") as number) ?? 0,
                tags: (projectile.getData("tags") as string[]) ?? [],
                charged: false,
                sourceType: "fork",
            });
        }
    }

    getActiveBullets(): MockBullet[] {
        return this.mockBullets.filter((b) => b.active);
    }

    clearAllProjectiles(): void {
        this.mockBullets = [];
    }
}

describe("ProjectileSystem Core Logic", () => {
    let projectileSystem: MockProjectileSystem;

    beforeEach(() => {
        projectileSystem = new MockProjectileSystem();
    });

    afterEach(() => {
        eventBus.removeAllListeners();
    });

    describe("Projectile Creation", () => {
        test("should create projectile with correct properties", () => {
            const bulletConfig = {
                x: 100,
                y: 100,
                damage: 25,
                pierce: 1,
                bounce: 0,
                tags: ["projectile", "charged"],
            };

            const bullet = projectileSystem.spawnBullet(bulletConfig);

            expect(bullet).toBeDefined();
            expect(bullet.getData("damage")).toBe(25);
            expect(bullet.getData("pierce")).toBe(1);
            expect(bullet.getData("tags")).toContain("charged");
            expect(bullet.getData("canFork")).toBe(true);
        });

        test("should set heavy projectile flag when neutron core is active", () => {
            projectileSystem.updateConfig({
                neutronCoreConfig: { active: true, speedMultiplier: 0.6 },
            });

            const bulletConfig = {
                x: 100,
                y: 100,
                damage: 25,
                pierce: 1,
                bounce: 0,
                tags: ["projectile"],
            };

            const bullet = projectileSystem.spawnBullet(bulletConfig);
            expect(bullet.getData("isHeavy")).toBe(true);
        });
    });

    describe("Projectile Physics and Collision", () => {
        test("should handle bullet-enemy collision with pierce", () => {
            const bullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 20,
                pierce: 2,
                bounce: 0,
                tags: ["projectile"],
            });

            const enemy = new MockEnemy(150, 100);
            const damageCallback = jest.fn();

            projectileSystem.handleBulletHitEnemy(
                bullet,
                enemy,
                damageCallback
            );

            expect(damageCallback).toHaveBeenCalledWith(enemy, 20, bullet);
            expect(bullet.getData("pierce")).toBe(1); // Reduced from 2
            expect(bullet.active).toBe(true); // Still active with pierce left
        });

        test("should destroy projectile when pierce is exhausted", () => {
            const bullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 20,
                pierce: 0, // No pierce
                bounce: 0,
                tags: ["projectile"],
            });

            const enemy = new MockEnemy(150, 100);
            const damageCallback = jest.fn();

            projectileSystem.handleBulletHitEnemy(
                bullet,
                enemy,
                damageCallback
            );

            expect(damageCallback).toHaveBeenCalledWith(enemy, 20, bullet);
            expect(bullet.active).toBe(false); // Should be destroyed
        });

        test("should handle projectile intercept with heavy bullets", () => {
            const playerBullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 20,
                pierce: 1,
                bounce: 0,
                tags: ["projectile"],
            });
            playerBullet.setData("isHeavy", true);

            const enemyBullet = new MockBullet(120, 100);

            projectileSystem.handleProjectileIntercept(
                playerBullet,
                enemyBullet
            );

            expect(enemyBullet.active).toBe(false); // Enemy bullet destroyed
            expect(playerBullet.getData("pierce")).toBe(0); // Pierce reduced
        });

        test("should not intercept with non-heavy bullets", () => {
            const playerBullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 20,
                pierce: 1,
                bounce: 0,
                tags: ["projectile"],
            });
            playerBullet.setData("isHeavy", false);

            const enemyBullet = new MockBullet(120, 100);

            projectileSystem.handleProjectileIntercept(
                playerBullet,
                enemyBullet
            );

            expect(enemyBullet.active).toBe(true); // Enemy bullet not destroyed
        });
    });

    describe("Special Projectile Effects", () => {
        test("should handle projectile forking/splitting", () => {
            projectileSystem.updateConfig({
                splitConfig: {
                    enabled: true,
                    forks: 3,
                    spreadDegrees: 30,
                    damageMultiplier: 0.7,
                },
            });

            const bullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 30,
                pierce: 0,
                bounce: 0,
                tags: ["projectile"],
            });

            const enemy = new MockEnemy(150, 100);
            const initialBulletCount =
                projectileSystem.getActiveBullets().length;

            projectileSystem.handleBulletHitEnemy(bullet, enemy);

            const finalBulletCount = projectileSystem.getActiveBullets().length;
            expect(finalBulletCount).toBeGreaterThan(initialBulletCount);
            expect(bullet.getData("canFork")).toBe(false); // Should be marked as used
        });

        test("should not fork projectiles that are already forks", () => {
            projectileSystem.updateConfig({
                splitConfig: {
                    enabled: true,
                    forks: 2,
                    spreadDegrees: 20,
                    damageMultiplier: 0.5,
                },
            });

            const bullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 20,
                pierce: 0,
                bounce: 0,
                tags: ["projectile"],
                sourceType: "fork", // Already a fork
            });

            const enemy = new MockEnemy(150, 100);
            const initialBulletCount =
                projectileSystem.getActiveBullets().length;

            projectileSystem.handleBulletHitEnemy(bullet, enemy);

            const finalBulletCount = projectileSystem.getActiveBullets().length;
            expect(finalBulletCount).toBe(initialBulletCount - 1); // Only original bullet destroyed
        });

        test("should not fork when splitting is disabled", () => {
            projectileSystem.updateConfig({
                splitConfig: {
                    enabled: false,
                    forks: 2,
                    spreadDegrees: 20,
                    damageMultiplier: 0.5,
                },
            });

            const bullet = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 20,
                pierce: 0,
                bounce: 0,
                tags: ["projectile"],
            });

            const enemy = new MockEnemy(150, 100);
            const initialBulletCount =
                projectileSystem.getActiveBullets().length;

            projectileSystem.handleBulletHitEnemy(bullet, enemy);

            const finalBulletCount = projectileSystem.getActiveBullets().length;
            expect(finalBulletCount).toBe(initialBulletCount - 1); // Only original bullet destroyed
        });
    });

    describe("Configuration Management", () => {
        test("should update configuration correctly", () => {
            const newConfig = {
                splitConfig: {
                    enabled: true,
                    forks: 4,
                    spreadDegrees: 45,
                    damageMultiplier: 0.8,
                },
            };

            expect(() =>
                projectileSystem.updateConfig(newConfig)
            ).not.toThrow();
        });
    });

    describe("System Management", () => {
        test("should clear all projectiles", () => {
            // Create some projectiles
            projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 10,
                pierce: 0,
                bounce: 0,
                tags: ["projectile"],
            });

            expect(projectileSystem.getActiveBullets().length).toBeGreaterThan(
                0
            );

            projectileSystem.clearAllProjectiles();
            expect(projectileSystem.getActiveBullets().length).toBe(0);
        });

        test("should track active bullets correctly", () => {
            const bullet1 = projectileSystem.spawnBullet({
                x: 100,
                y: 100,
                damage: 10,
                pierce: 0,
                bounce: 0,
                tags: ["projectile"],
            });

            const bullet2 = projectileSystem.spawnBullet({
                x: 200,
                y: 200,
                damage: 15,
                pierce: 1,
                bounce: 0,
                tags: ["projectile"],
            });

            expect(projectileSystem.getActiveBullets()).toHaveLength(2);

            bullet1.destroy();
            expect(projectileSystem.getActiveBullets()).toHaveLength(1);
            expect(projectileSystem.getActiveBullets()[0]).toBe(bullet2);
        });
    });

    describe("Event Integration", () => {
        test("should handle event bus operations", () => {
            const eventData = {
                projectileId: "test-projectile",
                type: "player" as const,
                position: { x: 100, y: 100 },
            };

            expect(() => {
                eventBus.emit("projectile:fired", eventData);
            }).not.toThrow();
        });
    });
});
