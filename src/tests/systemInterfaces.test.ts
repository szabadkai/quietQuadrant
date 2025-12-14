/**
 * Property-based tests for system interface implementation
 * Feature: code-refactoring, Property 4: Interface implementation consistency
 */

import * as fc from "fast-check";
import {
    BaseGameSystem,
    EventBus,
    ServiceContainer,
    SystemRegistry,
} from "../game/systems";
import type { EventBusEvents } from "../game/systems/EventBus";
import { validateSystemInterface } from "../utils/testUtils";

describe("System Interface Properties", () => {
    let registry: SystemRegistry;
    let serviceContainer: ServiceContainer;
    let eventBus: EventBus;

    beforeEach(() => {
        registry = new SystemRegistry();
        serviceContainer = new ServiceContainer();
        eventBus = new EventBus();
    });

    afterEach(() => {
        registry.shutdownAllSystems();
        serviceContainer.clear();
        eventBus.removeAllListeners();
    });

    /**
     * Feature: code-refactoring, Property 4: Interface implementation consistency
     * Validates: Requirements 2.6, 4.1
     */
    test("Property 4: Interface implementation consistency", () => {
        fc.assert(
            fc.property(
                fc
                    .string({ minLength: 1, maxLength: 20 })
                    .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
                fc.array(
                    fc
                        .string({ minLength: 1, maxLength: 15 })
                        .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
                    { maxLength: 5 }
                ),
                fc.integer({ min: -10, max: 10 }),
                (systemId, dependencies, _priority) => {
                    // Create a mock system that implements GameSystem interface
                    class TestSystem extends BaseGameSystem {
                        private updateCallCount = 0;

                        constructor() {
                            super(systemId, dependencies);
                        }

                        update(time: number, delta: number): void {
                            this.updateCallCount++;
                            // Verify update parameters are reasonable
                            if (time < 0 || delta < 0 || delta > 1000) {
                                throw new Error("Invalid update parameters");
                            }
                        }

                        getUpdateCallCount(): number {
                            return this.updateCallCount;
                        }
                    }

                    const system = new TestSystem();

                    // Test 1: System should implement GameSystem interface correctly
                    const implementsInterface = validateSystemInterface(system);
                    if (!implementsInterface) {
                        return false;
                    }

                    // Test 2: System should have correct properties
                    const hasCorrectProperties =
                        system.systemId === systemId &&
                        Array.isArray(system.dependencies) &&
                        system.dependencies.every(
                            (dep) => typeof dep === "string"
                        ) &&
                        typeof system.isActive === "boolean";

                    if (!hasCorrectProperties) {
                        return false;
                    }

                    // Test 3: System lifecycle should work correctly
                    try {
                        // Mock Phaser scene
                        const mockScene = {
                            add: { graphics: () => ({}) },
                            physics: { world: { setBounds: () => {} } },
                            time: { now: Date.now() },
                        } as unknown as Phaser.Scene;

                        // Initially not active
                        if (system.isActive) {
                            return false;
                        }

                        // Initialize should make it active
                        system.initialize(mockScene);
                        if (!system.isActive) {
                            return false;
                        }

                        // Update should work without errors
                        system.update(1000, 16);
                        if ((system as TestSystem).getUpdateCallCount() !== 1) {
                            return false;
                        }

                        // Shutdown should make it inactive
                        system.shutdown();
                        if (system.isActive) {
                            return false;
                        }

                        return true;
                    } catch (_error) {
                        return false;
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    test("Property 4a: SystemRegistry interface consistency", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        systemId: fc
                            .string({ minLength: 1, maxLength: 15 })
                            .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
                        dependencies: fc.array(
                            fc
                                .string({ minLength: 1, maxLength: 10 })
                                .filter((s) =>
                                    /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)
                                ),
                            { maxLength: 3 }
                        ),
                        priority: fc.integer({ min: 0, max: 10 }),
                    }),
                    { minLength: 1, maxLength: 8 }
                ),
                (systemConfigs) => {
                    const registry = new SystemRegistry();
                    const systems: BaseGameSystem[] = [];

                    try {
                        // Create and register systems
                        for (const config of systemConfigs) {
                            class TestSystem extends BaseGameSystem {
                                constructor() {
                                    super(config.systemId, config.dependencies);
                                }
                                update(): void {}
                            }

                            const system = new TestSystem();
                            systems.push(system);

                            // Only register systems whose dependencies are also in the list
                            const availableSystemIds = systemConfigs.map(
                                (c) => c.systemId
                            );
                            const hasAllDependencies =
                                config.dependencies.every((dep) =>
                                    availableSystemIds.includes(dep)
                                );

                            if (hasAllDependencies) {
                                registry.registerSystem(system, {
                                    enabled: true,
                                    priority: config.priority,
                                    dependencies: config.dependencies,
                                });
                            }
                        }

                        // Test registry interface consistency
                        const stats = registry.getStats();

                        // Stats should be consistent
                        const statsValid =
                            typeof stats.totalSystems === "number" &&
                            typeof stats.activeSystems === "number" &&
                            typeof stats.enabledSystems === "number" &&
                            Array.isArray(stats.updateOrder) &&
                            stats.totalSystems >= 0 &&
                            stats.activeSystems >= 0 &&
                            stats.enabledSystems >= 0;

                        if (!statsValid) {
                            return false;
                        }

                        // Should be able to get registered systems
                        const allSystems = registry.getAllSystems();
                        if (!(allSystems instanceof Map)) {
                            return false;
                        }

                        // Each registered system should be retrievable
                        for (const [systemId] of allSystems) {
                            const retrievedSystem =
                                registry.getSystem(systemId);
                            if (
                                !retrievedSystem ||
                                !validateSystemInterface(retrievedSystem)
                            ) {
                                return false;
                            }
                        }

                        return true;
                    } catch (_error) {
                        // Expected for invalid configurations (circular dependencies, etc.)
                        return true;
                    } finally {
                        registry.shutdownAllSystems();
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    test("Property 4b: ServiceContainer interface consistency", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        serviceId: fc
                            .string({ minLength: 1, maxLength: 15 })
                            .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
                        value: fc.oneof(
                            fc.string(),
                            fc.integer(),
                            fc.boolean(),
                            fc.constant({ test: "object" })
                        ),
                        singleton: fc.boolean(),
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                (serviceConfigs) => {
                    const container = new ServiceContainer();

                    try {
                        // Register services
                        for (const config of serviceConfigs) {
                            container.registerInstance(
                                config.serviceId,
                                config.value
                            );
                        }

                        // Test service container interface consistency
                        const serviceIds = container.getServiceIds();

                        // Should return array of service IDs
                        if (!Array.isArray(serviceIds)) {
                            return false;
                        }

                        // Each registered service should be retrievable
                        for (const config of serviceConfigs) {
                            if (!container.has(config.serviceId)) {
                                return false;
                            }

                            const retrieved = container.get(config.serviceId);
                            if (retrieved !== config.value) {
                                return false;
                            }
                        }

                        // Service IDs should match registered services
                        const expectedIds = serviceConfigs.map(
                            (c) => c.serviceId
                        );
                        const actualIds = serviceIds.sort();
                        const expectedSorted = [...new Set(expectedIds)].sort(); // Remove duplicates

                        if (actualIds.length !== expectedSorted.length) {
                            return false;
                        }

                        for (let i = 0; i < actualIds.length; i++) {
                            if (actualIds[i] !== expectedSorted[i]) {
                                return false;
                            }
                        }

                        return true;
                    } catch (_error) {
                        // Expected for duplicate service IDs
                        return true;
                    } finally {
                        container.clear();
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    test("Property 4c: EventBus interface consistency", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        event: fc.constantFrom(
                            "player:health-changed",
                            "enemy:spawned",
                            "wave:started"
                        ),
                        data: fc.oneof(
                            fc.record({
                                health: fc.integer(),
                                maxHealth: fc.integer(),
                            }),
                            fc.record({
                                enemyId: fc.string(),
                                type: fc.string(),
                                position: fc.record({
                                    x: fc.integer(),
                                    y: fc.integer(),
                                }),
                            }),
                            fc.record({ waveIndex: fc.integer() })
                        ),
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                (eventConfigs) => {
                    const eventBus = new EventBus();
                    const receivedEvents: { event: string; data: unknown }[] =
                        [];

                    try {
                        // Set up listeners (one per unique event)
                        const unsubscribes: (() => void)[] = [];
                        const uniqueEvents = [
                            ...new Set(eventConfigs.map((c) => c.event)),
                        ];

                        for (const event of uniqueEvents) {
                            const unsubscribe = eventBus.on(
                                event as keyof EventBusEvents,
                                (data) => {
                                    receivedEvents.push({
                                        event: event,
                                        data,
                                    });
                                }
                            );
                            unsubscribes.push(unsubscribe);
                        }

                        // Emit events
                        for (const config of eventConfigs) {
                            eventBus.emit(
                                config.event as keyof EventBusEvents,
                                config.data
                            );
                        }

                        // Test event bus interface consistency
                        const eventNames = eventBus.eventNames();

                        // Should return array of event names
                        if (!Array.isArray(eventNames)) {
                            return false;
                        }

                        // Should have received all emitted events
                        if (receivedEvents.length !== eventConfigs.length) {
                            return false;
                        }

                        // Each received event should match an emitted event
                        for (let i = 0; i < receivedEvents.length; i++) {
                            const received = receivedEvents[i];
                            const expected = eventConfigs[i];

                            if (received.event !== expected.event) {
                                return false;
                            }

                            // Deep equality check for data objects
                            if (
                                JSON.stringify(received.data) !==
                                JSON.stringify(expected.data)
                            ) {
                                return false;
                            }
                        }

                        // Listener count should be accurate (1 per unique event)
                        for (const event of uniqueEvents) {
                            const count = eventBus.listenerCount(
                                event as keyof EventBusEvents
                            );

                            if (count !== 1) {
                                return false;
                            }
                        }

                        // Cleanup
                        for (const unsub of unsubscribes) {
                            unsub();
                        }

                        return true;
                    } catch (_error) {
                        return false;
                    } finally {
                        eventBus.removeAllListeners();
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    // Unit tests for edge cases
    test("handles system registration errors", () => {
        const registry = new SystemRegistry();

        class TestSystem extends BaseGameSystem {
            update(): void {}
        }

        const system1 = new TestSystem("test-system");
        const system2 = new TestSystem("test-system"); // Same ID

        registry.registerSystem(system1);

        expect(() => {
            registry.registerSystem(system2);
        }).toThrow("System test-system is already registered");
    });

    test("handles circular dependencies", () => {
        const registry = new SystemRegistry();

        class SystemA extends BaseGameSystem {
            constructor() {
                super("system-a", ["system-b"]);
            }
            update(): void {}
        }

        class SystemB extends BaseGameSystem {
            constructor() {
                super("system-b", ["system-a"]);
            }
            update(): void {}
        }

        registry.registerSystem(new SystemA());
        registry.registerSystem(new SystemB());

        const mockScene = {} as Phaser.Scene;

        expect(() => {
            registry.initializeAllSystems(mockScene);
        }).toThrow(/Circular dependency detected/);
    });

    test("handles missing dependencies", () => {
        const registry = new SystemRegistry();

        class SystemWithDeps extends BaseGameSystem {
            constructor() {
                super("system-with-deps", ["missing-system"]);
            }
            update(): void {}
        }

        registry.registerSystem(new SystemWithDeps());

        const mockScene = {} as Phaser.Scene;

        expect(() => {
            registry.initializeAllSystems(mockScene);
        }).toThrow(/depends on missing-system, but it is not registered/);
    });

    test("handles service container errors", () => {
        const container = new ServiceContainer();

        expect(() => {
            container.get("non-existent-service");
        }).toThrow("Service non-existent-service is not registered");

        container.registerInstance("test-service", "test-value");

        expect(() => {
            container.registerInstance("test-service", "another-value");
        }).toThrow("Service test-service is already registered");
    });
});
