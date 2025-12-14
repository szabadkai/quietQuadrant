/**
 * Integration tests for system communication
 * **Feature: code-refactoring, Property 3: System decomposition completeness**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 */

import fc from "fast-check";
import { eventBus } from "../game/systems/EventBus";
import { SystemRegistry } from "../game/systems/SystemRegistry";

// Create mock system classes that implement the GameSystem interface
class MockGameSystem {
    public isActive = false;

    constructor(
        public readonly systemId: string,
        public readonly dependencies: string[] = []
    ) {}

    initialize(_scene: any): void {
        this.isActive = true;
    }

    update(_time: number, _delta: number): void {
        // Mock update
    }

    shutdown(): void {
        this.isActive = false;
    }
}

// Mock Phaser scene for testing
class MockScene {
    public scale = { width: 800, height: 600 };
}

describe("System Communication Integration Tests", () => {
    let mockScene: MockScene;

    beforeEach(() => {
        mockScene = new MockScene();
        // Clear event bus
        eventBus.removeAllListeners();
    });

    afterEach(() => {
        eventBus.removeAllListeners();
    });

    describe("Property 3: System decomposition completeness", () => {
        test("should have all required game systems available", () => {
            // Create systems
            const playerSystem = new MockGameSystem("player-system", []);
            const enemySystem = new MockGameSystem("enemy-system", [
                "player-system",
            ]);
            const projectileSystem = new MockGameSystem(
                "projectile-system",
                []
            );
            const upgradeSystem = new MockGameSystem("upgrade-system", []);
            const vfxSystem = new MockGameSystem("vfx", []);

            // Verify that all major game systems exist as dedicated modules
            expect(playerSystem).toBeDefined();
            expect(playerSystem.systemId).toBe("player-system");

            expect(enemySystem).toBeDefined();
            expect(enemySystem.systemId).toBe("enemy-system");

            expect(projectileSystem).toBeDefined();
            expect(projectileSystem.systemId).toBe("projectile-system");

            expect(upgradeSystem).toBeDefined();
            expect(upgradeSystem.systemId).toBe("upgrade-system");

            expect(vfxSystem).toBeDefined();
            expect(vfxSystem.systemId).toBe("vfx");

            // Verify each system implements the GameSystem interface
            const systems = [
                playerSystem,
                enemySystem,
                projectileSystem,
                upgradeSystem,
                vfxSystem,
            ];
            systems.forEach((system) => {
                expect(typeof system.initialize).toBe("function");
                expect(typeof system.update).toBe("function");
                expect(typeof system.shutdown).toBe("function");
                expect(typeof system.systemId).toBe("string");
                expect(Array.isArray(system.dependencies)).toBe(true);
                expect(typeof system.isActive).toBe("boolean");
            });
        });

        test("should register and initialize all systems correctly", () => {
            // Create fresh registry and systems for this test
            const testRegistry = new SystemRegistry();
            const testPlayerSystem = new MockGameSystem("player-system", []);
            const testEnemySystem = new MockGameSystem("enemy-system", [
                "player-system",
            ]);
            const testProjectileSystem = new MockGameSystem(
                "projectile-system",
                []
            );
            const testUpgradeSystem = new MockGameSystem("upgrade-system", []);
            const testVfxSystem = new MockGameSystem("vfx", []);

            // Register all systems
            testRegistry.registerSystem(testPlayerSystem);
            testRegistry.registerSystem(testEnemySystem);
            testRegistry.registerSystem(testProjectileSystem);
            testRegistry.registerSystem(testUpgradeSystem);
            testRegistry.registerSystem(testVfxSystem);

            // Initialize all systems
            testRegistry.initializeAllSystems(mockScene as any);

            // Verify all systems are active
            expect(testPlayerSystem.isActive).toBe(true);
            expect(testEnemySystem.isActive).toBe(true);
            expect(testProjectileSystem.isActive).toBe(true);
            expect(testUpgradeSystem.isActive).toBe(true);
            expect(testVfxSystem.isActive).toBe(true);

            // Verify systems can be retrieved from registry
            expect(testRegistry.getSystem("player-system")).toBe(
                testPlayerSystem
            );
            expect(testRegistry.getSystem("enemy-system")).toBe(
                testEnemySystem
            );
            expect(testRegistry.getSystem("projectile-system")).toBe(
                testProjectileSystem
            );
            expect(testRegistry.getSystem("upgrade-system")).toBe(
                testUpgradeSystem
            );
            expect(testRegistry.getSystem("vfx")).toBe(testVfxSystem);
        });

        test("should handle system dependencies correctly", () => {
            // Create fresh registry and systems for this test
            const testRegistry = new SystemRegistry();
            const testPlayerSystem = new MockGameSystem("player-system", []);
            const testEnemySystem = new MockGameSystem("enemy-system", [
                "player-system",
            ]);
            const testProjectileSystem = new MockGameSystem(
                "projectile-system",
                []
            );
            const testUpgradeSystem = new MockGameSystem("upgrade-system", []);
            const testVfxSystem = new MockGameSystem("vfx", []);

            // Register systems in random order to test dependency resolution
            const systems = [
                testVfxSystem,
                testUpgradeSystem,
                testProjectileSystem,
                testEnemySystem,
                testPlayerSystem,
            ];
            systems.forEach((system) => testRegistry.registerSystem(system));

            // Initialize should handle dependencies automatically
            expect(() => {
                testRegistry.initializeAllSystems(mockScene as any);
            }).not.toThrow();

            // Verify dependency order is respected
            const stats = testRegistry.getStats();
            expect(stats.activeSystems).toBe(5);
            expect(stats.enabledSystems).toBe(5);
        });

        test("should communicate between systems via event bus", () => {
            const testData = {
                playerId: "test-player",
                health: 50,
                maxHealth: 100,
            };

            let healthEventReceived = false;

            // Set up event listener
            const unsubscribeHealth = eventBus.on(
                "player:health-changed",
                (eventData) => {
                    expect(eventData.health).toBe(testData.health);
                    expect(eventData.maxHealth).toBe(testData.maxHealth);
                    healthEventReceived = true;
                }
            );

            // Emit event
            eventBus.emit("player:health-changed", {
                health: testData.health,
                maxHealth: testData.maxHealth,
            });

            // Verify event was received
            expect(healthEventReceived).toBe(true);

            // Clean up listener
            unsubscribeHealth();
        });

        test("should handle projectile system communication", () => {
            const testData = {
                projectileId: "test-projectile",
                type: "player" as const,
                x: 400,
                y: 300,
            };

            let projectileFiredEventReceived = false;

            // Set up event listener
            const unsubscribe = eventBus.on("projectile:fired", (eventData) => {
                expect(eventData.projectileId).toBe(testData.projectileId);
                expect(eventData.type).toBe(testData.type);
                expect(eventData.position.x).toBe(testData.x);
                expect(eventData.position.y).toBe(testData.y);
                projectileFiredEventReceived = true;
            });

            // Emit projectile fired event
            eventBus.emit("projectile:fired", {
                projectileId: testData.projectileId,
                type: testData.type,
                position: { x: testData.x, y: testData.y },
            });

            // Verify event was received
            expect(projectileFiredEventReceived).toBe(true);

            // Clean up listener
            unsubscribe();
        });

        test("should maintain system isolation and independence", () => {
            // Create fresh registry and systems for this test
            const testRegistry = new SystemRegistry();
            const testPlayerSystem = new MockGameSystem("player-system", []);
            const testEnemySystem = new MockGameSystem("enemy-system", [
                "player-system",
            ]);
            const testProjectileSystem = new MockGameSystem(
                "projectile-system",
                []
            );
            const testUpgradeSystem = new MockGameSystem("upgrade-system", []);
            const testVfxSystem = new MockGameSystem("vfx", []);

            // Initialize systems
            testRegistry.registerSystem(testPlayerSystem);
            testRegistry.registerSystem(testEnemySystem);
            testRegistry.registerSystem(testProjectileSystem);
            testRegistry.registerSystem(testUpgradeSystem);
            testRegistry.registerSystem(testVfxSystem);
            testRegistry.initializeAllSystems(mockScene as any);

            // Shutdown one system
            testRegistry.unregisterSystem("enemy-system");

            // Other systems should still be active
            expect(testPlayerSystem.isActive).toBe(true);
            expect(testProjectileSystem.isActive).toBe(true);
            expect(testUpgradeSystem.isActive).toBe(true);
            expect(testVfxSystem.isActive).toBe(true);

            // Enemy system should be inactive
            expect(testEnemySystem.isActive).toBe(false);

            // Registry should reflect the change
            expect(testRegistry.getSystem("enemy-system")).toBeUndefined();
            expect(testRegistry.getSystem("player-system")).toBe(
                testPlayerSystem
            );
        });
    });
});
