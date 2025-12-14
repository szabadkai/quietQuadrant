/**
 * Unit tests for UpgradeSystem
 * Tests upgrade application, synergy calculations, and progression tracking
 */

import { UpgradeSystem } from "../game/systems/UpgradeSystem";
import { SynergyProcessor } from "../game/systems/SynergyProcessor";
import type { UpgradeDefinition, WeeklyAffix } from "../models/types";

// Mock dependencies
jest.mock("../config/upgrades", () => ({
    getUpgradeDefinition: jest.fn(),
    UPGRADE_CATALOG: [
        {
            id: "power-shot",
            name: "Power Shot",
            description: "Test upgrade",
            rarity: "common" as const,
            category: "offense" as const,
            maxStacks: 8,
            dropWeight: 1.1,
        },
        {
            id: "rapid-fire",
            name: "Rapid Fire",
            description: "Test upgrade",
            rarity: "common" as const,
            category: "offense" as const,
            maxStacks: 8,
            dropWeight: 1.1,
        },
        {
            id: "prism-spread",
            name: "Prism Spread",
            description: "Test upgrade",
            rarity: "rare" as const,
            category: "offense" as const,
            maxStacks: 3,
            dropWeight: 1,
        },
    ],
    UPGRADE_RARITY_ODDS: {
        common: 0.65,
        rare: 0.3,
        legendary: 0.05,
    },
}));

jest.mock("../config/synergies", () => ({
    SYNERGY_DEFINITIONS: [
        {
            id: "railgun",
            name: "Railgun",
            description: "Test synergy",
            requires: ["held-charge", "quantum-tunneling", "swift-projectiles"],
        },
        {
            id: "vampire",
            name: "Vampire",
            description: "Test synergy",
            requires: ["blood-fuel", "berserk-module"],
        },
    ],
}));

jest.mock("../state/useRunStore", () => ({
    useRunStore: {
        getState: () => ({
            actions: {
                addUpgrade: jest.fn(),
                unlockSynergy: jest.fn(),
            },
        }),
    },
}));

jest.mock("../state/useUIStore", () => ({
    useUIStore: {
        getState: () => ({
            actions: {
                closeUpgradeSelection: jest.fn(),
            },
        }),
    },
}));

jest.mock("../game/events", () => ({
    GAME_EVENT_KEYS: {
        synergyActivated: "synergyActivated",
    },
    gameEvents: {
        emit: jest.fn(),
    },
}));

describe("UpgradeSystem", () => {
    let upgradeSystem: UpgradeSystem;
    let mockScene: any;
    let mockPlayerStatsUpdater: jest.Mock;
    let mockProjectileScaleUpdater: jest.Mock;
    let mockGlassCannonCapUpdater: jest.Mock;

    beforeEach(() => {
        upgradeSystem = new UpgradeSystem();
        mockScene = {};
        mockPlayerStatsUpdater = jest.fn();
        mockProjectileScaleUpdater = jest.fn();
        mockGlassCannonCapUpdater = jest.fn();

        upgradeSystem.setPlayerStatsUpdater(mockPlayerStatsUpdater);
        upgradeSystem.setProjectileScaleUpdater(mockProjectileScaleUpdater);
        upgradeSystem.setGlassCannonCapUpdater(mockGlassCannonCapUpdater);

        upgradeSystem.initialize(mockScene);

        // Mock getUpgradeDefinition
        const { getUpgradeDefinition } = require("../config/upgrades");
        getUpgradeDefinition.mockImplementation((id: string) => {
            const upgrades: Record<string, UpgradeDefinition> = {
                "power-shot": {
                    id: "power-shot",
                    name: "Power Shot",
                    description: "Test upgrade",
                    rarity: "common",
                    category: "offense",
                    maxStacks: 8,
                },
                "rapid-fire": {
                    id: "rapid-fire",
                    name: "Rapid Fire",
                    description: "Test upgrade",
                    rarity: "common",
                    category: "offense",
                    maxStacks: 8,
                },
                "glass-cannon": {
                    id: "glass-cannon",
                    name: "Glass Cannon",
                    description: "Test upgrade",
                    rarity: "legendary",
                    category: "offense",
                    maxStacks: 1,
                },
                "held-charge": {
                    id: "held-charge",
                    name: "Held Charge",
                    description: "Test upgrade",
                    rarity: "rare",
                    category: "offense",
                    maxStacks: 3,
                },
                "quantum-tunneling": {
                    id: "quantum-tunneling",
                    name: "Quantum Tunneling",
                    description: "Test upgrade",
                    rarity: "legendary",
                    category: "utility",
                    maxStacks: 1,
                },
                "swift-projectiles": {
                    id: "swift-projectiles",
                    name: "Swift Projectiles",
                    description: "Test upgrade",
                    rarity: "common",
                    category: "offense",
                    maxStacks: 6,
                },
                "heavy-barrel": {
                    id: "heavy-barrel",
                    name: "Heavy Barrel",
                    description: "Test upgrade",
                    rarity: "common",
                    category: "offense",
                    maxStacks: 3,
                },
            };
            return upgrades[id];
        });
    });

    afterEach(() => {
        upgradeSystem.shutdown();
        jest.clearAllMocks();
    });

    describe("System Lifecycle", () => {
        test("should initialize with default state", () => {
            const stacks = upgradeSystem.getUpgradeStacks();
            expect(Object.keys(stacks)).toHaveLength(0);
            expect(upgradeSystem.getActiveSynergies().size).toBe(0);
            expect(upgradeSystem.getPendingUpgradeOptions()).toHaveLength(0);
        });

        test("should reset state on shutdown", () => {
            upgradeSystem.applyUpgrade("power-shot");
            expect(upgradeSystem.getUpgradeStack("power-shot")).toBe(1);

            upgradeSystem.shutdown();
            upgradeSystem.initialize(mockScene);

            expect(upgradeSystem.getUpgradeStack("power-shot")).toBe(0);
        });
    });

    describe("Upgrade Application", () => {
        test("should apply upgrade and update stacks", () => {
            upgradeSystem.applyUpgrade("power-shot");

            expect(upgradeSystem.getUpgradeStack("power-shot")).toBe(1);
            expect(mockPlayerStatsUpdater).toHaveBeenCalledWith({
                damage: { multiply: 1.15 },
                critChance: { add: 0.05 },
            });
        });

        test("should handle multiple stacks of same upgrade", () => {
            upgradeSystem.applyUpgrade("power-shot");
            upgradeSystem.applyUpgrade("power-shot");

            expect(upgradeSystem.getUpgradeStack("power-shot")).toBe(2);
            expect(mockPlayerStatsUpdater).toHaveBeenCalledTimes(2);
        });

        test("should respect max stacks limit", () => {
            // Apply glass-cannon (max stacks: 1) twice
            upgradeSystem.applyUpgrade("glass-cannon");
            const firstStack = upgradeSystem.getUpgradeStack("glass-cannon");

            upgradeSystem.applyUpgrade("glass-cannon");
            const secondStack = upgradeSystem.getUpgradeStack("glass-cannon");

            expect(firstStack).toBe(1);
            expect(secondStack).toBe(1); // Should not increase beyond max
        });

        test("should handle unknown upgrade gracefully", () => {
            upgradeSystem.applyUpgrade("unknown-upgrade");
            expect(upgradeSystem.getUpgradeStack("unknown-upgrade")).toBe(0);
        });

        test("should clear pending options after applying upgrade", () => {
            // Set up pending options
            const options = upgradeSystem.rollUpgradeOptions();
            expect(
                upgradeSystem.getPendingUpgradeOptions().length
            ).toBeGreaterThan(0);

            upgradeSystem.applyUpgrade("power-shot");
            expect(upgradeSystem.getPendingUpgradeOptions()).toHaveLength(0);
        });
    });

    describe("Upgrade Rolling", () => {
        test("should roll upgrade options", () => {
            const options = upgradeSystem.rollUpgradeOptions();
            expect(options.length).toBeGreaterThan(0);
            expect(options.length).toBeLessThanOrEqual(3);
        });

        test("should filter out prism-spread when sidecar not present", () => {
            // Mock UPGRADE_CATALOG to include prism-spread
            const { UPGRADE_CATALOG } = require("../config/upgrades");
            UPGRADE_CATALOG.push({
                id: "sidecar",
                name: "Sidecar",
                description: "Test upgrade",
                rarity: "common",
                category: "offense",
                maxStacks: 3,
                dropWeight: 1,
            });

            const options = upgradeSystem.rollUpgradeOptions();
            const hasPrismSpread = options.some(
                (opt) => opt.id === "prism-spread"
            );
            expect(hasPrismSpread).toBe(false);
        });

        test("should respect rarity weights with affix bonus", () => {
            const affix: WeeklyAffix = {
                id: "test-affix",
                name: "Test Affix",
                description: "Test",
                rareUpgradeBonus: 0.5,
            };

            upgradeSystem.setAffix(affix);
            const options = upgradeSystem.rollUpgradeOptions();
            expect(options.length).toBeGreaterThan(0);
        });

        test("should use custom RNG when provided", () => {
            let callCount = 0;
            const mockRng = {
                next: () => {
                    callCount++;
                    return 0.5;
                },
                nextInt: (max: number) => Math.floor(max / 2),
            };

            upgradeSystem.setRng(mockRng);
            upgradeSystem.rollUpgradeOptions();
            expect(callCount).toBeGreaterThan(0);
        });
    });

    describe("Synergy System", () => {
        test("should check and activate synergies", () => {
            // Apply upgrades required for railgun synergy
            upgradeSystem.applyUpgrade("held-charge");
            upgradeSystem.applyUpgrade("quantum-tunneling");
            upgradeSystem.applyUpgrade("swift-projectiles");

            const activeSynergies = upgradeSystem.getActiveSynergies();
            expect(activeSynergies.has("railgun")).toBe(true);
        });

        test("should not activate synergy if requirements not met", () => {
            upgradeSystem.applyUpgrade("held-charge");
            // Missing quantum-tunneling and swift-projectiles

            const activeSynergies = upgradeSystem.getActiveSynergies();
            expect(activeSynergies.has("railgun")).toBe(false);
        });

        test("should not activate same synergy twice", () => {
            // Apply upgrades for railgun synergy
            upgradeSystem.applyUpgrade("held-charge");
            upgradeSystem.applyUpgrade("quantum-tunneling");
            upgradeSystem.applyUpgrade("swift-projectiles");

            const firstCheck = upgradeSystem.getActiveSynergies().size;
            upgradeSystem.checkSynergies(); // Call again
            const secondCheck = upgradeSystem.getActiveSynergies().size;

            expect(firstCheck).toBe(secondCheck);
        });
    });

    describe("Upgrade Configuration", () => {
        test("should update upgrade config for complex upgrades", () => {
            upgradeSystem.applyUpgrade("held-charge");

            const config = upgradeSystem.getUpgradeConfig();
            expect(config.capacitorConfig.stacks).toBe(1);
            expect(config.capacitorConfig.idleMs).toBe(800);
            expect(config.capacitorConfig.damageBonus).toBe(0.8);
        });

        test("should handle projectile scale updates", () => {
            upgradeSystem.applyUpgrade("heavy-barrel");
            expect(mockProjectileScaleUpdater).toHaveBeenCalledWith(1.1);
        });

        test("should handle glass cannon health cap", () => {
            upgradeSystem.applyUpgrade("glass-cannon");
            expect(mockGlassCannonCapUpdater).toHaveBeenCalledWith(1);
        });
    });

    describe("State Management", () => {
        test("should reset upgrade state", () => {
            upgradeSystem.applyUpgrade("power-shot");
            upgradeSystem.applyUpgrade("rapid-fire");

            expect(upgradeSystem.getUpgradeStack("power-shot")).toBe(1);
            expect(upgradeSystem.getUpgradeStack("rapid-fire")).toBe(1);

            upgradeSystem.resetUpgradeState();

            expect(upgradeSystem.getUpgradeStack("power-shot")).toBe(0);
            expect(upgradeSystem.getUpgradeStack("rapid-fire")).toBe(0);
            expect(upgradeSystem.getActiveSynergies().size).toBe(0);
        });

        test("should return copy of upgrade stacks", () => {
            upgradeSystem.applyUpgrade("power-shot");
            const stacks1 = upgradeSystem.getUpgradeStacks();
            const stacks2 = upgradeSystem.getUpgradeStacks();

            expect(stacks1).toEqual(stacks2);
            expect(stacks1).not.toBe(stacks2); // Different objects
        });

        test("should return copy of active synergies", () => {
            upgradeSystem.applyUpgrade("held-charge");
            upgradeSystem.applyUpgrade("quantum-tunneling");
            upgradeSystem.applyUpgrade("swift-projectiles");

            const synergies1 = upgradeSystem.getActiveSynergies();
            const synergies2 = upgradeSystem.getActiveSynergies();

            expect(synergies1).toEqual(synergies2);
            expect(synergies1).not.toBe(synergies2); // Different objects
        });
    });
});

describe("SynergyProcessor", () => {
    let synergyProcessor: SynergyProcessor;
    let mockPlayerStatsUpdater: jest.Mock;

    beforeEach(() => {
        mockPlayerStatsUpdater = jest.fn();
        synergyProcessor = new SynergyProcessor(mockPlayerStatsUpdater);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Synergy Processing", () => {
        test("should process railgun synergy", () => {
            synergyProcessor.processSynergy("railgun");

            expect(mockPlayerStatsUpdater).toHaveBeenCalledWith({
                critChance: 0.05,
                critMultiplier: 0.25,
            });
        });

        test("should process meat-grinder synergy", () => {
            synergyProcessor.processSynergy("meat-grinder");

            expect(mockPlayerStatsUpdater).toHaveBeenCalledWith({
                critChance: 0.03,
                critMultiplier: 0.15,
            });
        });

        test("should process vampire synergy", () => {
            synergyProcessor.processSynergy("vampire");

            expect(mockPlayerStatsUpdater).toHaveBeenCalledWith({
                critChance: 0.03,
            });
        });

        test("should handle unknown synergy gracefully", () => {
            synergyProcessor.processSynergy("unknown-synergy");
            expect(mockPlayerStatsUpdater).not.toHaveBeenCalled();
        });
    });

    describe("Synergy Requirements", () => {
        test("should check synergy requirements correctly", () => {
            const synergy = { requires: ["upgrade1", "upgrade2"] };
            const upgradeStacks = { upgrade1: 1, upgrade2: 1, upgrade3: 0 };

            const result = synergyProcessor.checkSynergyRequirements(
                synergy,
                upgradeStacks
            );
            expect(result).toBe(true);
        });

        test("should fail when requirements not met", () => {
            const synergy = { requires: ["upgrade1", "upgrade2"] };
            const upgradeStacks = { upgrade1: 1, upgrade3: 1 }; // Missing upgrade2

            const result = synergyProcessor.checkSynergyRequirements(
                synergy,
                upgradeStacks
            );
            expect(result).toBe(false);
        });

        test("should handle empty requirements", () => {
            const synergy = { requires: [] };
            const upgradeStacks = {};

            const result = synergyProcessor.checkSynergyRequirements(
                synergy,
                upgradeStacks
            );
            expect(result).toBe(true);
        });
    });

    describe("Synergy Effects", () => {
        test("should return correct effects for known synergies", () => {
            const railgunEffects =
                synergyProcessor.getSynergyEffects("railgun");
            expect(railgunEffects).toEqual({
                critChance: 0.05,
                critMultiplier: 0.25,
            });

            const vampireEffects =
                synergyProcessor.getSynergyEffects("vampire");
            expect(vampireEffects).toEqual({
                critChance: 0.03,
            });
        });

        test("should return empty object for unknown synergy", () => {
            const effects =
                synergyProcessor.getSynergyEffects("unknown-synergy");
            expect(effects).toEqual({});
        });
    });
});
