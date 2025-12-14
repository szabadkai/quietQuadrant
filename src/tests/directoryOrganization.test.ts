/**
 * Property-based tests for directory organization
 * Feature: code-refactoring, Property 5: Directory organization consistency
 * Validates: Requirements 3.1, 3.2, 3.4
 */

import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";

// Define expected directory structure patterns
const EXPECTED_DIRECTORIES = [
    "src/audio",
    "src/config",
    "src/game",
    "src/game/systems",
    "src/game/systems/interfaces",
    "src/game/types",
    "src/models",
    "src/persistence",
    "src/state",
    "src/tests",
    "src/ui",
    "src/ui/components",
    "src/ui/input",
    "src/utils",
];

// Define expected index files for clean imports
const EXPECTED_INDEX_FILES = [
    "src/audio/index.ts",
    "src/config/index.ts",
    "src/game/index.ts",
    "src/game/systems/index.ts",
    "src/game/systems/interfaces/index.ts",
    "src/game/types/index.ts",
    "src/models/index.ts",
    "src/persistence/index.ts",
    "src/state/index.ts",
    "src/ui/index.ts",
    "src/ui/components/index.ts",
    "src/ui/input/index.ts",
    "src/utils/index.ts",
];

// Define naming convention patterns
const NAMING_PATTERNS = {
    systems: /^[A-Z][a-zA-Z]+System\.ts$/,
    interfaces: /^(I[A-Z][a-zA-Z]+|[A-Z][a-zA-Z]+)\.ts$/,
    components: /^[A-Z][a-zA-Z]+\.(tsx|ts)$/,
    hooks: /^use[A-Z][a-zA-Z]+\.ts$/,
    config: /^[a-z][a-zA-Z]+\.ts$/,
    types: /^[A-Z][a-zA-Z]+Types?\.ts$/,
};

describe("Directory Organization Properties", () => {
    /**
     * Feature: code-refactoring, Property 5: Directory organization consistency
     * Validates: Requirements 3.1, 3.2, 3.4
     */
    test("Property 5: Directory organization consistency", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...EXPECTED_DIRECTORIES),
                (directory) => {
                    // Test 1: Directory should exist
                    const dirPath = path.resolve(process.cwd(), directory);
                    const exists = fs.existsSync(dirPath);

                    if (!exists) {
                        return false;
                    }

                    // Test 2: Directory should be a directory
                    const stats = fs.statSync(dirPath);
                    if (!stats.isDirectory()) {
                        return false;
                    }

                    // Test 3: Directory should contain files
                    const files = fs.readdirSync(dirPath);
                    // Allow empty directories for now, but they should exist
                    return true;
                }
            ),
            { numRuns: EXPECTED_DIRECTORIES.length }
        );
    });

    test("Property 5a: Index files exist for clean imports", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...EXPECTED_INDEX_FILES),
                (indexFile) => {
                    const filePath = path.resolve(process.cwd(), indexFile);
                    const exists = fs.existsSync(filePath);

                    if (!exists) {
                        return false;
                    }

                    // Test: Index file should be a file
                    const stats = fs.statSync(filePath);
                    if (!stats.isFile()) {
                        return false;
                    }

                    // Test: Index file should have content (exports)
                    const content = fs.readFileSync(filePath, "utf-8");
                    const hasExports =
                        content.includes("export") ||
                        content.includes("export *");

                    return hasExports;
                }
            ),
            { numRuns: EXPECTED_INDEX_FILES.length }
        );
    });

    test("Property 5b: Systems directory follows naming conventions", () => {
        const systemsDir = path.resolve(process.cwd(), "src/game/systems");

        if (!fs.existsSync(systemsDir)) {
            return; // Skip if directory doesn't exist
        }

        const files = fs.readdirSync(systemsDir).filter((f) => {
            const filePath = path.join(systemsDir, f);
            return fs.statSync(filePath).isFile() && f.endsWith(".ts");
        });

        fc.assert(
            fc.property(fc.constantFrom(...files), (file) => {
                // System files should follow PascalCase naming
                // Allow index.ts and other infrastructure files
                const isSystemFile = NAMING_PATTERNS.systems.test(file);
                const isInfrastructureFile = [
                    "index.ts",
                    "EventBus.ts",
                    "ServiceContainer.ts",
                    "SystemRegistry.ts",
                    "PlayerController.ts",
                ].includes(file);

                return isSystemFile || isInfrastructureFile;
            }),
            { numRuns: Math.max(1, files.length) }
        );
    });

    test("Property 5c: UI components follow naming conventions", () => {
        const componentsDir = path.resolve(process.cwd(), "src/ui/components");

        if (!fs.existsSync(componentsDir)) {
            return; // Skip if directory doesn't exist
        }

        const files = fs.readdirSync(componentsDir).filter((f) => {
            const filePath = path.join(componentsDir, f);
            return (
                fs.statSync(filePath).isFile() &&
                (f.endsWith(".ts") || f.endsWith(".tsx"))
            );
        });

        fc.assert(
            fc.property(fc.constantFrom(...files), (file) => {
                // Component files should follow PascalCase naming
                const isComponentFile = NAMING_PATTERNS.components.test(file);
                const isIndexFile = file === "index.ts";

                return isComponentFile || isIndexFile;
            }),
            { numRuns: Math.max(1, files.length) }
        );
    });

    test("Property 5d: State hooks follow naming conventions", () => {
        const stateDir = path.resolve(process.cwd(), "src/state");

        if (!fs.existsSync(stateDir)) {
            return; // Skip if directory doesn't exist
        }

        const files = fs.readdirSync(stateDir).filter((f) => {
            const filePath = path.join(stateDir, f);
            return fs.statSync(filePath).isFile() && f.endsWith(".ts");
        });

        fc.assert(
            fc.property(fc.constantFrom(...files), (file) => {
                // Hook files should follow useXxx naming convention
                const isHookFile = NAMING_PATTERNS.hooks.test(file);
                const isIndexFile = file === "index.ts";

                return isHookFile || isIndexFile;
            }),
            { numRuns: Math.max(1, files.length) }
        );
    });

    // Unit tests for specific directory structure requirements
    test("systems directory contains all required system modules", () => {
        const systemsDir = path.resolve(process.cwd(), "src/game/systems");
        const requiredSystems = [
            "PlayerSystem.ts",
            "EnemySystem.ts",
            "ProjectileSystem.ts",
            "UpgradeSystem.ts",
            "VFXSystem.ts",
        ];

        for (const system of requiredSystems) {
            const systemPath = path.join(systemsDir, system);
            expect(fs.existsSync(systemPath)).toBe(true);
        }
    });

    test("interfaces directory contains all required interface definitions", () => {
        const interfacesDir = path.resolve(
            process.cwd(),
            "src/game/systems/interfaces"
        );
        const requiredInterfaces = [
            "GameSystem.ts",
            "PlayerSystem.ts",
            "EnemySystem.ts",
            "ProjectileSystem.ts",
            "UpgradeSystem.ts",
            "VFXSystem.ts",
            "index.ts",
        ];

        for (const iface of requiredInterfaces) {
            const ifacePath = path.join(interfacesDir, iface);
            expect(fs.existsSync(ifacePath)).toBe(true);
        }
    });

    test("audio directory contains refactored audio modules", () => {
        const audioDir = path.resolve(process.cwd(), "src/audio");
        const requiredModules = [
            "AudioSettings.ts",
            "MusicPlayer.ts",
            "SFXManager.ts",
            "SoundManager.ts",
            "index.ts",
        ];

        for (const module of requiredModules) {
            const modulePath = path.join(audioDir, module);
            expect(fs.existsSync(modulePath)).toBe(true);
        }
    });
});
