/**
 * Property-based tests for type safety preservation
 * Feature: code-refactoring, Property 7: Type safety preservation
 * Validates: Requirements 4.2, 4.3
 */

import * as fc from "fast-check";
import {
    BaseGameSystem,
    type GameSystem,
    type SystemConfig,
    type GameSystemsConfig,
} from "../game/systems";
import type {
    IPlayerSystem,
    PlayerStats,
} from "../game/systems/interfaces/PlayerSystem";
import type { IEnemySystem } from "../game/systems/interfaces/EnemySystem";
import type {
    IProjectileSystem,
    ProjectileConfig,
    CollisionResult,
} from "../game/systems/interfaces/ProjectileSystem";
import type { IUpgradeSystem } from "../game/systems/interfaces/UpgradeSystem";
import type { IVFXSystem } from "../game/systems/interfaces/VFXSystem";

/**
 * Helper to check if an object has all required methods of GameSystem interface
 */
function hasGameSystemMethods(obj: unknown): obj is GameSystem {
    if (!obj || typeof obj !== "object") return false;
    const system = obj as Record<string, unknown>;
    return (
        typeof system.initialize === "function" &&
        typeof system.update === "function" &&
        typeof system.shutdown === "function" &&
        typeof system.systemId === "string" &&
        Array.isArray(system.dependencies) &&
        typeof system.isActive === "boolean"
    );
}

/**
 * Helper to verify PlayerStats type structure
 */
function isValidPlayerStats(stats: unknown): stats is PlayerStats {
    if (!stats || typeof stats !== "object") return false;
    const s = stats as Record<string, unknown>;
    return (
        typeof s.moveSpeed === "number" &&
        typeof s.damage === "number" &&
        typeof s.fireRate === "number" &&
        typeof s.projectileSpeed === "number" &&
        typeof s.projectiles === "number" &&
        typeof s.pierce === "number" &&
        typeof s.bounce === "number" &&
        typeof s.maxHealth === "number" &&
        typeof s.health === "number" &&
        typeof s.critChance === "number" &&
        typeof s.critMultiplier === "number"
    );
}

/**
 * Helper to verify ProjectileConfig type structure
 */
function isValidProjectileConfig(config: unknown): config is ProjectileConfig {
    if (!config || typeof config !== "object") return false;
    const c = config as Record<string, unknown>;
    return (
        typeof c.damage === "number" &&
        typeof c.speed === "number" &&
        typeof c.pierce === "number" &&
        typeof c.bounce === "number" &&
        typeof c.lifetime === "number" &&
        typeof c.size === "number" &&
        Array.isArray(c.effects)
    );
}

/**
 * Helper to verify CollisionResult type structure
 */
function isValidCollisionResult(result: unknown): result is CollisionResult {
    if (!result || typeof result !== "object") return false;
    const r = result as Record<string, unknown>;
    return (
        typeof r.projectileDestroyed === "boolean" &&
        typeof r.targetDestroyed === "boolean" &&
        typeof r.damageDealt === "number" &&
        Array.isArray(r.effectsTriggered)
    );
}

/**
 * Helper to verify SystemConfig type structure
 */
function isValidSystemConfig(config: unknown): config is SystemConfig {
    if (!config || typeof config !== "object") return false;
    const c = config as Record<string, unknown>;
    return (
        typeof c.enabled === "boolean" &&
        typeof c.priority === "number" &&
        Array.isArray(c.dependencies)
    );
}

describe("Type Safety Preservation Properties", () => {
    /**
     * Feature: code-refactoring, Property 7: Type safety preservation
     * Validates: Requirements 4.2, 4.3
     *
     * For any existing type definition or constraint, it should remain
     * accessible and properly typed after refactoring
     */
    describe("Property 7: Type safety preservation", () => {
        test("GameSystem interface types are preserved and accessible", () => {
            fc.assert(
                fc.property(
                    fc
                        .string({ minLength: 1, maxLength: 20 })
                        .filter((s) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)),
                    fc.array(
                        fc
                            .string({ minLength: 1, maxLength: 15 })
                            .filter((s) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)),
                        { maxLength: 5 }
                    ),
                    (systemId, dependencies) => {
                        // Create a system extending BaseGameSystem
                        class TestSystem extends BaseGameSystem {
                            constructor() {
                                super(systemId, dependencies);
                            }
                            update(_time: number, _delta: number): void {}
                        }

                        const system = new TestSystem();

                        // Verify the system implements GameSystem interface
                        const implementsInterface =
                            hasGameSystemMethods(system);
                        if (!implementsInterface) return false;

                        // Verify type constraints are preserved
                        if (system.systemId !== systemId) return false;
                        if (
                            !Array.isArray(system.dependencies) ||
                            system.dependencies.length !== dependencies.length
                        )
                            return false;
                        if (typeof system.isActive !== "boolean") return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test("PlayerStats type structure is preserved", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        moveSpeed: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(1000),
                        }),
                        damage: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(1000),
                        }),
                        fireRate: fc.float({
                            min: Math.fround(0.1),
                            max: Math.fround(100),
                        }),
                        projectileSpeed: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(2000),
                        }),
                        projectiles: fc.integer({ min: 1, max: 20 }),
                        pierce: fc.integer({ min: 0, max: 100 }),
                        bounce: fc.integer({ min: 0, max: 50 }),
                        maxHealth: fc.integer({ min: 1, max: 100 }),
                        health: fc.integer({ min: 0, max: 100 }),
                        critChance: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(1),
                        }),
                        critMultiplier: fc.float({
                            min: Math.fround(1),
                            max: Math.fround(10),
                        }),
                    }),
                    (stats) => {
                        // Verify the generated stats conform to PlayerStats type
                        const isValid = isValidPlayerStats(stats);
                        if (!isValid) return false;

                        // Verify type constraints
                        const typedStats: PlayerStats = stats;
                        if (typeof typedStats.moveSpeed !== "number")
                            return false;
                        if (typeof typedStats.damage !== "number") return false;
                        if (typeof typedStats.fireRate !== "number")
                            return false;
                        if (typeof typedStats.projectileSpeed !== "number")
                            return false;
                        if (typeof typedStats.projectiles !== "number")
                            return false;
                        if (typeof typedStats.pierce !== "number") return false;
                        if (typeof typedStats.bounce !== "number") return false;
                        if (typeof typedStats.maxHealth !== "number")
                            return false;
                        if (typeof typedStats.health !== "number") return false;
                        if (typeof typedStats.critChance !== "number")
                            return false;
                        if (typeof typedStats.critMultiplier !== "number")
                            return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test("ProjectileConfig type structure is preserved", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        damage: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(1000),
                        }),
                        speed: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(2000),
                        }),
                        pierce: fc.integer({ min: 0, max: 100 }),
                        bounce: fc.integer({ min: 0, max: 50 }),
                        lifetime: fc.integer({ min: 100, max: 10000 }),
                        size: fc.float({
                            min: Math.fround(0.1),
                            max: Math.fround(5),
                        }),
                        effects: fc.array(
                            fc.constantFrom(
                                "explosive",
                                "homing",
                                "charged",
                                "heavy"
                            ),
                            { maxLength: 5 }
                        ),
                    }),
                    (config) => {
                        // Verify the generated config conforms to ProjectileConfig type
                        const isValid = isValidProjectileConfig(config);
                        if (!isValid) return false;

                        // Verify type constraints
                        const typedConfig: ProjectileConfig = config;
                        if (typeof typedConfig.damage !== "number")
                            return false;
                        if (typeof typedConfig.speed !== "number") return false;
                        if (typeof typedConfig.pierce !== "number")
                            return false;
                        if (typeof typedConfig.bounce !== "number")
                            return false;
                        if (typeof typedConfig.lifetime !== "number")
                            return false;
                        if (typeof typedConfig.size !== "number") return false;
                        if (!Array.isArray(typedConfig.effects)) return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test("CollisionResult type structure is preserved", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        projectileDestroyed: fc.boolean(),
                        targetDestroyed: fc.boolean(),
                        damageDealt: fc.float({
                            min: Math.fround(0),
                            max: Math.fround(1000),
                        }),
                        effectsTriggered: fc.array(
                            fc.constantFrom(
                                "explosion",
                                "charge-burst",
                                "split"
                            ),
                            { maxLength: 5 }
                        ),
                    }),
                    (result) => {
                        // Verify the generated result conforms to CollisionResult type
                        const isValid = isValidCollisionResult(result);
                        if (!isValid) return false;

                        // Verify type constraints
                        const typedResult: CollisionResult = result;
                        if (
                            typeof typedResult.projectileDestroyed !== "boolean"
                        )
                            return false;
                        if (typeof typedResult.targetDestroyed !== "boolean")
                            return false;
                        if (typeof typedResult.damageDealt !== "number")
                            return false;
                        if (!Array.isArray(typedResult.effectsTriggered))
                            return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test("SystemConfig type structure is preserved", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        enabled: fc.boolean(),
                        priority: fc.integer({ min: -100, max: 100 }),
                        dependencies: fc.array(
                            fc
                                .string({ minLength: 1, maxLength: 20 })
                                .filter((s) =>
                                    /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)
                                ),
                            { maxLength: 10 }
                        ),
                    }),
                    (config) => {
                        // Verify the generated config conforms to SystemConfig type
                        const isValid = isValidSystemConfig(config);
                        if (!isValid) return false;

                        // Verify type constraints
                        const typedConfig: SystemConfig = config;
                        if (typeof typedConfig.enabled !== "boolean")
                            return false;
                        if (typeof typedConfig.priority !== "number")
                            return false;
                        if (!Array.isArray(typedConfig.dependencies))
                            return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test("Method signatures are preserved in BaseGameSystem", () => {
            fc.assert(
                fc.property(
                    fc
                        .string({ minLength: 1, maxLength: 20 })
                        .filter((s) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)),
                    fc.integer({ min: 0, max: 10000 }),
                    fc.integer({ min: 1, max: 100 }),
                    (systemId, time, delta) => {
                        class TestSystem extends BaseGameSystem {
                            public initializeCalled = false;
                            public updateCalled = false;
                            public shutdownCalled = false;
                            public lastTime = 0;
                            public lastDelta = 0;

                            constructor() {
                                super(systemId, []);
                            }

                            protected onInitialize(): void {
                                this.initializeCalled = true;
                            }

                            update(t: number, d: number): void {
                                this.updateCalled = true;
                                this.lastTime = t;
                                this.lastDelta = d;
                            }

                            protected onShutdown(): void {
                                this.shutdownCalled = true;
                            }
                        }

                        const system = new TestSystem();

                        // Mock Phaser scene
                        const mockScene = {
                            add: { graphics: () => ({}) },
                            physics: { world: { setBounds: () => {} } },
                            time: { now: Date.now() },
                        } as unknown as Phaser.Scene;

                        // Test initialize method signature
                        system.initialize(mockScene);
                        if (!system.initializeCalled) return false;
                        if (!system.isActive) return false;

                        // Test update method signature (time: number, delta: number)
                        system.update(time, delta);
                        if (!system.updateCalled) return false;
                        if (system.lastTime !== time) return false;
                        if (system.lastDelta !== delta) return false;

                        // Test shutdown method signature
                        system.shutdown();
                        if (!system.shutdownCalled) return false;
                        if (system.isActive) return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test("Inheritance relationships are preserved", () => {
            fc.assert(
                fc.property(
                    fc
                        .string({ minLength: 1, maxLength: 20 })
                        .filter((s) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)),
                    (systemId) => {
                        // Create a class that extends BaseGameSystem
                        class DerivedSystem extends BaseGameSystem {
                            constructor() {
                                super(systemId, []);
                            }
                            update(): void {}
                        }

                        const system = new DerivedSystem();

                        // Verify inheritance relationship
                        if (!(system instanceof BaseGameSystem)) return false;

                        // Verify the system can be treated as GameSystem
                        const asGameSystem: GameSystem = system;
                        if (typeof asGameSystem.initialize !== "function")
                            return false;
                        if (typeof asGameSystem.update !== "function")
                            return false;
                        if (typeof asGameSystem.shutdown !== "function")
                            return false;

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // Unit tests for type accessibility
    describe("Type Accessibility", () => {
        test("All system interface types are importable", () => {
            // These imports would fail at compile time if types were not accessible
            const playerStatsType: PlayerStats = {
                moveSpeed: 240,
                damage: 12,
                fireRate: 4,
                projectileSpeed: 520,
                projectiles: 1,
                pierce: 0,
                bounce: 0,
                maxHealth: 5,
                health: 5,
                critChance: 0.05,
                critMultiplier: 2,
            };
            expect(isValidPlayerStats(playerStatsType)).toBe(true);

            const projectileConfigType: ProjectileConfig = {
                damage: 10,
                speed: 500,
                pierce: 0,
                bounce: 0,
                lifetime: 3000,
                size: 1,
                effects: [],
            };
            expect(isValidProjectileConfig(projectileConfigType)).toBe(true);

            const collisionResultType: CollisionResult = {
                projectileDestroyed: true,
                targetDestroyed: false,
                damageDealt: 10,
                effectsTriggered: [],
            };
            expect(isValidCollisionResult(collisionResultType)).toBe(true);

            const systemConfigType: SystemConfig = {
                enabled: true,
                priority: 0,
                dependencies: [],
            };
            expect(isValidSystemConfig(systemConfigType)).toBe(true);
        });

        test("Interface types can be used for type checking", () => {
            // Verify IPlayerSystem interface methods exist in type definition
            const playerSystemMethods: (keyof IPlayerSystem)[] = [
                "initialize",
                "update",
                "shutdown",
                "systemId",
                "dependencies",
                "isActive",
                "getPlayerStats",
                "updatePlayerStats",
                "getPlayerState",
                "handleMovement",
                "handleShooting",
                "handleAbilities",
                "takeDamage",
                "heal",
                "isAlive",
            ];
            expect(playerSystemMethods.length).toBeGreaterThan(0);

            // Verify IEnemySystem interface methods exist in type definition
            const enemySystemMethods: (keyof IEnemySystem)[] = [
                "initialize",
                "update",
                "shutdown",
                "systemId",
                "dependencies",
                "isActive",
                "startWave",
                "getCurrentWave",
                "spawnEnemy",
                "removeEnemy",
                "getActiveEnemies",
                "damageEnemy",
                "isWaveComplete",
                "getRemainingEnemyCount",
            ];
            expect(enemySystemMethods.length).toBeGreaterThan(0);

            // Verify IProjectileSystem interface methods exist in type definition
            const projectileSystemMethods: (keyof IProjectileSystem)[] = [
                "initialize",
                "update",
                "shutdown",
                "systemId",
                "dependencies",
                "isActive",
                "fireProjectile",
                "removeProjectile",
                "getActiveProjectiles",
                "getProjectilesByType",
                "handleCollision",
                "clearAllProjectiles",
            ];
            expect(projectileSystemMethods.length).toBeGreaterThan(0);

            // Verify IUpgradeSystem interface methods exist in type definition
            const upgradeSystemMethods: (keyof IUpgradeSystem)[] = [
                "initialize",
                "update",
                "shutdown",
                "systemId",
                "dependencies",
                "isActive",
                "applyUpgrade",
                "getUpgradeStacks",
                "getUpgradeStack",
                "rollUpgradeOptions",
                "getPendingUpgradeOptions",
                "clearPendingUpgradeOptions",
                "checkSynergies",
                "getActiveSynergies",
                "getUpgradeConfig",
                "resetUpgradeState",
                "setRng",
                "setAffix",
            ];
            expect(upgradeSystemMethods.length).toBeGreaterThan(0);

            // Verify IVFXSystem interface methods exist in type definition
            const vfxSystemMethods: (keyof IVFXSystem)[] = [
                "initialize",
                "update",
                "shutdown",
                "systemId",
                "dependencies",
                "isActive",
                "spawnBurstVisual",
                "spawnMuzzleFlash",
                "playCritFeedback",
                "updateShieldVisual",
                "applyBackgroundTone",
                "pulseBackgroundForBossPhase",
                "playBossIntroPulse",
                "createTexture",
                "setLowGraphicsMode",
                "isLowGraphicsMode",
                "spawnDashTrail",
                "setupBossIntroOverlay",
                "registerBackgroundFxTarget",
                "resetBackgroundEffects",
            ];
            expect(vfxSystemMethods.length).toBeGreaterThan(0);
        });

        test("GameSystemsConfig type is properly structured", () => {
            const config: GameSystemsConfig = {
                "player-system": {
                    enabled: true,
                    priority: 10,
                    dependencies: [],
                },
                "enemy-system": {
                    enabled: true,
                    priority: 5,
                    dependencies: ["player-system"],
                },
                "projectile-system": {
                    enabled: true,
                    priority: 3,
                    dependencies: [],
                },
            };

            // Verify each system config is valid
            for (const key of Object.keys(config)) {
                expect(isValidSystemConfig(config[key])).toBe(true);
            }
        });
    });
});
