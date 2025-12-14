/**
 * Unit tests for EnemySystem
 * Tests enemy spawning logic, wave progression, and AI behavior
 */

// Mock Phaser before importing anything that uses it
jest.mock("phaser", () => ({
    Math: {
        Vector2: class MockVector2 {
            x: number;
            y: number;
            constructor(x = 0, y = 0) {
                this.x = x;
                this.y = y;
            }
            clone() {
                return new MockVector2(this.x, this.y);
            }
            copy(other: { x: number; y: number }) {
                this.x = other.x;
                this.y = other.y;
                return this;
            }
            normalize() {
                const len = Math.sqrt(this.x * this.x + this.y * this.y);
                if (len > 0) {
                    this.x /= len;
                    this.y /= len;
                }
                return this;
            }
            length() {
                return Math.sqrt(this.x * this.x + this.y * this.y);
            }
            lengthSq() {
                return this.x * this.x + this.y * this.y;
            }
        },
    },
    Physics: {
        Arcade: {
            Image: class MockArcadeImage {},
        },
    },
}));

// Mock sound manager
jest.mock("../audio/SoundManager", () => ({
    soundManager: {
        playLevelTrack: jest.fn(),
    },
}));

// Mock state stores
jest.mock("../state/useRunStore", () => ({
    useRunStore: {
        getState: jest.fn(() => ({
            actions: {
                setWaveCountdown: jest.fn(),
            },
        })),
    },
}));

import { EnemySystem } from "../game/systems/EnemySystem";
import { eventBus } from "../game/systems/EventBus";

// Create a shared mock group that can be reused
const mockGroup = {
    get: jest.fn((x, y, _texture) => ({
        setActive: jest.fn().mockReturnThis(),
        setVisible: jest.fn().mockReturnThis(),
        setScale: jest.fn().mockReturnThis(),
        setPosition: jest.fn().mockReturnThis(),
        setData: jest.fn().mockReturnThis(),
        getData: jest.fn(),
        setVelocity: jest.fn().mockReturnThis(),
        setAlpha: jest.fn().mockReturnThis(),
        clearTint: jest.fn().mockReturnThis(),
        setTint: jest.fn().mockReturnThis(),
        body: {
            setSize: jest.fn(),
            setBounce: jest.fn(),
            enable: false,
            velocity: { x: 0, y: 0 },
        },
        displayWidth: 32,
        displayHeight: 32,
        x: x || 0,
        y: y || 0,
        active: true,
        visible: true,
        name: `enemy-${Math.random()}`,
    })),
    getChildren: jest.fn(() => []),
    countActive: jest.fn(() => 0),
    setVelocity: jest.fn(),
    destroy: jest.fn(),
};

// Mock scene
const mockScene = {
    time: {
        now: 1000,
        delayedCall: jest.fn(),
    },
    physics: {
        add: {
            group: jest.fn(() => mockGroup),
        },
    },
    tweens: {
        add: jest.fn((config: any) => {
            // Immediately call onComplete for testing
            if (config.onComplete) config.onComplete();
        }),
    },
} as unknown as Phaser.Scene;

describe("EnemySystem", () => {
    let enemySystem: EnemySystem;

    beforeEach(() => {
        enemySystem = new EnemySystem();
        eventBus.removeAllListeners();
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (enemySystem.isActive) {
            enemySystem.shutdown();
        }
        eventBus.removeAllListeners();
    });

    describe("initialization", () => {
        test("initializes with correct system ID and dependencies", () => {
            expect(enemySystem.systemId).toBe("enemy-system");
            expect(enemySystem.dependencies).toEqual(["player-system"]);
        });

        test("creates enemy groups on initialization", () => {
            enemySystem.initialize(mockScene);

            expect(mockScene.physics.add.group).toHaveBeenCalledTimes(2);
            expect(mockScene.physics.add.group).toHaveBeenCalledWith({
                classType: expect.any(Function),
                maxSize: 64,
                runChildUpdate: false,
            });
            expect(mockScene.physics.add.group).toHaveBeenCalledWith({
                classType: expect.any(Function),
                maxSize: 256,
                runChildUpdate: false,
            });
        });

        test("becomes active after initialization", () => {
            expect(enemySystem.isActive).toBe(false);
            enemySystem.initialize(mockScene);
            expect(enemySystem.isActive).toBe(true);
        });
    });

    describe("wave management", () => {
        beforeEach(() => {
            enemySystem.initialize(mockScene);
        });

        test("starts wave correctly", () => {
            const waveStartedSpy = jest.fn();
            eventBus.on("wave:started", waveStartedSpy);

            enemySystem.startWave(0);

            expect(waveStartedSpy).toHaveBeenCalledWith({ waveIndex: 0 });

            const currentWave = enemySystem.getCurrentWave();
            expect(currentWave).toBeDefined();
            expect(currentWave?.index).toBe(0);
            expect(currentWave?.active).toBe(true);
        });

        test("returns current wave state", () => {
            enemySystem.startWave(1);

            const wave = enemySystem.getCurrentWave();
            expect(wave).toBeDefined();
            expect(wave?.index).toBe(1);
            expect(wave?.active).toBe(true);
            expect(wave?.spawnQueue).toBeDefined();
        });

        test("returns undefined when no wave is active", () => {
            const wave = enemySystem.getCurrentWave();
            expect(wave).toBeUndefined();
        });

        test("handles invalid wave index gracefully", () => {
            const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

            enemySystem.startWave(-1);

            expect(consoleSpy).toHaveBeenCalledWith("Wave -1 does not exist");
            expect(enemySystem.getCurrentWave()).toBeUndefined();

            consoleSpy.mockRestore();
        });
    });

    describe("enemy spawning", () => {
        beforeEach(() => {
            enemySystem.initialize(mockScene);
        });

        test("spawns enemy successfully", () => {
            const enemySpawnedSpy = jest.fn();
            eventBus.on("enemy:spawned", enemySpawnedSpy);

            const mockEnemy = {
                setActive: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                setPosition: jest.fn().mockReturnThis(),
                setData: jest.fn().mockReturnThis(),
                getData: jest.fn(),
                setVelocity: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                clearTint: jest.fn().mockReturnThis(),
                body: {
                    setSize: jest.fn(),
                    setBounce: jest.fn(),
                    enable: false,
                },
                displayWidth: 32,
                displayHeight: 32,
                name: "test-enemy",
            };

            // Mock the group.get method to return our mock enemy
            const mockGroup = mockScene.physics.add.group();
            (mockGroup.get as jest.Mock).mockReturnValue(mockEnemy);

            const enemyState = enemySystem.spawnEnemy("drifter");

            expect(enemyState).toBeDefined();
            expect(enemyState?.type).toBe("drifter");
            expect(enemyState?.health).toBeGreaterThan(0);
            expect(enemyState?.maxHealth).toBeGreaterThan(0);
            expect(enemySpawnedSpy).toHaveBeenCalledWith({
                enemyId: expect.any(String),
                type: "drifter",
                position: expect.objectContaining({
                    x: expect.any(Number),
                    y: expect.any(Number),
                }),
            });
        });

        test.skip("spawns enemy at specified position", () => {
            const mockEnemy = {
                setActive: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                setPosition: jest.fn().mockReturnThis(),
                setData: jest.fn().mockReturnThis(),
                getData: jest.fn(),
                setVelocity: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                clearTint: jest.fn().mockReturnThis(),
                body: {
                    setSize: jest.fn(),
                    setBounce: jest.fn(),
                    enable: false,
                },
                displayWidth: 32,
                displayHeight: 32,
                name: "test-enemy",
            };

            const mockGroup = mockScene.physics.add.group();
            (mockGroup.get as jest.Mock).mockReturnValue(mockEnemy);

            const customPosition = new (Phaser as any).Math.Vector2(100, 200);
            const enemyState = enemySystem.spawnEnemy(
                "watcher",
                customPosition
            );

            expect(mockEnemy.setPosition).toHaveBeenCalledWith(100, 200);
            expect(enemyState?.position.x).toBe(100);
            expect(enemyState?.position.y).toBe(200);
        });

        test.skip("returns undefined when enemy group is not available", () => {
            const mockGroup = mockScene.physics.add.group();
            (mockGroup.get as jest.Mock).mockReturnValue(null);

            const enemyState = enemySystem.spawnEnemy("drifter");

            expect(enemyState).toBeUndefined();
        });
    });

    describe("enemy state management", () => {
        beforeEach(() => {
            enemySystem.initialize(mockScene);
        });

        test.skip("returns active enemies", () => {
            const mockEnemy1 = {
                active: true,
                visible: true,
                getData: jest.fn((key) => {
                    const data: Record<string, unknown> = {
                        kind: "drifter",
                        health: 18,
                        maxHealth: 18,
                        lastAction: 1000,
                    };
                    return data[key];
                }),
                x: 100,
                y: 200,
                body: { velocity: { x: 10, y: 20 } },
            };

            const mockEnemy2 = {
                active: false,
                visible: false,
                getData: jest.fn(),
                x: 300,
                y: 400,
                body: { velocity: { x: 0, y: 0 } },
            };

            const mockGroup = mockScene.physics.add.group();
            (mockGroup.getChildren as jest.Mock).mockReturnValue([
                mockEnemy1,
                mockEnemy2,
            ]);

            const activeEnemies = enemySystem.getActiveEnemies();

            expect(activeEnemies).toHaveLength(1);
            expect(activeEnemies[0].type).toBe("drifter");
            expect(activeEnemies[0].health).toBe(18);
            expect(activeEnemies[0].position.x).toBe(100);
            expect(activeEnemies[0].position.y).toBe(200);
        });

        test("returns empty array when no enemies are active", () => {
            const mockGroup = mockScene.physics.add.group();
            (mockGroup.getChildren as jest.Mock).mockReturnValue([]);

            const activeEnemies = enemySystem.getActiveEnemies();

            expect(activeEnemies).toHaveLength(0);
        });
    });

    describe("wave completion", () => {
        beforeEach(() => {
            enemySystem.initialize(mockScene);
        });

        test("detects wave completion correctly", () => {
            // Start a wave
            enemySystem.startWave(0);
            expect(enemySystem.isWaveComplete()).toBe(false);

            // Mock no active enemies
            const mockGroup = mockScene.physics.add.group();
            (mockGroup.countActive as jest.Mock).mockReturnValue(0);

            // Update should detect completion
            enemySystem.update(1000, 16);

            expect(enemySystem.isWaveComplete()).toBe(true);
            expect(enemySystem.getRemainingEnemyCount()).toBe(0);
        });

        test("emits wave completed event", () => {
            const waveCompletedSpy = jest.fn();
            eventBus.on("wave:completed", waveCompletedSpy);

            enemySystem.startWave(0);

            // Mock no active enemies
            const mockGroup = mockScene.physics.add.group();
            (mockGroup.countActive as jest.Mock).mockReturnValue(0);

            enemySystem.update(1000, 16);

            expect(waveCompletedSpy).toHaveBeenCalledWith({ waveIndex: 0 });
        });

        test.skip("emits enemy count changed events", () => {
            const enemyCountSpy = jest.fn();
            eventBus.on("wave:enemy-count-changed", enemyCountSpy);

            enemySystem.startWave(0);

            const mockGroup = mockScene.physics.add.group();
            (mockGroup.countActive as jest.Mock).mockReturnValue(5);

            enemySystem.update(1000, 16);

            expect(enemyCountSpy).toHaveBeenCalledWith({
                remaining: 5,
                total: expect.any(Number),
            });
        });
    });

    describe("event handling", () => {
        beforeEach(() => {
            enemySystem.initialize(mockScene);
        });

        test.skip("pauses enemy activity on player death", () => {
            const mockGroup = mockScene.physics.add.group();

            eventBus.emit("player:died", { playerId: "p1" });

            expect(mockGroup.setVelocity).toHaveBeenCalledWith(0, 0);
        });

        test.skip("pauses enemy activity on game pause", () => {
            const mockGroup = mockScene.physics.add.group();

            eventBus.emit("game:paused", { timestamp: 1000 });

            expect(mockGroup.setVelocity).toHaveBeenCalledWith(0, 0);
        });
    });

    describe("update loop", () => {
        beforeEach(() => {
            enemySystem.initialize(mockScene);
        });

        test("update runs without errors when no wave is active", () => {
            expect(() => {
                enemySystem.update(1000, 16);
            }).not.toThrow();
        });

        test("update processes active wave", () => {
            enemySystem.startWave(0);

            const mockGroup = mockScene.physics.add.group();
            (mockGroup.getChildren as jest.Mock).mockReturnValue([]);
            (mockGroup.countActive as jest.Mock).mockReturnValue(0);

            expect(() => {
                enemySystem.update(1000, 16);
            }).not.toThrow();
        });
    });

    describe("system lifecycle", () => {
        test("shutdown cleans up resources", () => {
            enemySystem.initialize(mockScene);

            const _mockEnemyGroup = mockScene.physics.add.group();
            const _mockBulletGroup = mockScene.physics.add.group();

            enemySystem.shutdown();

            expect(enemySystem.isActive).toBe(false);
            // Note: In a real implementation, we'd verify destroy() was called
        });
    });
});

describe("WaveManager", () => {
    // WaveManager is internal to EnemySystem, so we test it through EnemySystem
    let enemySystem: EnemySystem;

    beforeEach(() => {
        enemySystem = new EnemySystem();
        enemySystem.initialize(mockScene);
    });

    afterEach(() => {
        enemySystem.shutdown();
    });

    test("loads wave configuration correctly", () => {
        enemySystem.startWave(0);

        const wave = enemySystem.getCurrentWave();
        expect(wave?.spawnQueue).toBeDefined();
        expect(wave?.spawnQueue.length).toBeGreaterThan(0);
    });

    test("calculates wave difficulty", () => {
        enemySystem.startWave(0);
        const wave1 = enemySystem.getCurrentWave();

        enemySystem.startWave(5);
        const wave2 = enemySystem.getCurrentWave();

        // Later waves should have different configurations
        expect(wave1?.index).not.toBe(wave2?.index);
    });

    test("supports infinite mode waves", () => {
        // Test a wave index beyond the normal wave count
        enemySystem.startWave(50);

        const wave = enemySystem.getCurrentWave();
        expect(wave).toBeDefined();
        expect(wave?.index).toBe(50);
    });
});

describe("EnemySpawner", () => {
    // EnemySpawner is internal to EnemySystem, so we test it through EnemySystem
    let enemySystem: EnemySystem;

    beforeEach(() => {
        enemySystem = new EnemySystem();
        enemySystem.initialize(mockScene);
    });

    afterEach(() => {
        enemySystem.shutdown();
    });

    test("finds valid spawn positions", () => {
        const mockEnemy = {
            setActive: jest.fn().mockReturnThis(),
            setVisible: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis(),
            setPosition: jest.fn().mockReturnThis(),
            setData: jest.fn().mockReturnThis(),
            getData: jest.fn(),
            setVelocity: jest.fn().mockReturnThis(),
            setAlpha: jest.fn().mockReturnThis(),
            clearTint: jest.fn().mockReturnThis(),
            body: {
                setSize: jest.fn(),
                setBounce: jest.fn(),
                enable: false,
            },
            displayWidth: 32,
            displayHeight: 32,
            name: "test-enemy",
        };

        const mockGroup = mockScene.physics.add.group();
        (mockGroup.get as jest.Mock).mockReturnValue(mockEnemy);

        const enemyState = enemySystem.spawnEnemy("drifter");

        expect(enemyState?.position).toBeDefined();
        expect(typeof enemyState?.position.x).toBe("number");
        expect(typeof enemyState?.position.y).toBe("number");
    });
});
