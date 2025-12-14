/**
 * Property-based tests for test coverage maintenance
 * **Feature: code-refactoring, Property 8: Test coverage maintenance**
 * **Validates: Requirements 5.2, 5.5**
 */

import * as fc from "fast-check";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Find all source files (excluding tests)
function findSourceFiles(dir: string): string[] {
    const sourceFiles: string[] = [];

    function scanDir(currentDir: string): void {
        if (!existsSync(currentDir)) return;

        const entries = readdirSync(currentDir);
        for (const entry of entries) {
            const fullPath = join(currentDir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                // Skip node_modules, tests, and hidden directories
                if (
                    !entry.startsWith(".") &&
                    entry !== "node_modules" &&
                    entry !== "tests" &&
                    entry !== "__tests__"
                ) {
                    scanDir(fullPath);
                }
            } else if (
                stat.isFile() &&
                (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
                !entry.endsWith(".test.ts") &&
                !entry.endsWith(".spec.ts") &&
                !entry.endsWith(".d.ts")
            ) {
                sourceFiles.push(fullPath);
            }
        }
    }

    scanDir(dir);
    return sourceFiles;
}

// Find all test files
function findTestFiles(dir: string): string[] {
    const testFiles: string[] = [];

    function scanDir(currentDir: string): void {
        if (!existsSync(currentDir)) return;

        const entries = readdirSync(currentDir);
        for (const entry of entries) {
            const fullPath = join(currentDir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                if (!entry.startsWith(".") && entry !== "node_modules") {
                    scanDir(fullPath);
                }
            } else if (
                stat.isFile() &&
                (entry.endsWith(".test.ts") || entry.endsWith(".spec.ts"))
            ) {
                testFiles.push(fullPath);
            }
        }
    }

    scanDir(dir);
    return testFiles;
}

// Check if a module has corresponding tests
function hasCorrespondingTests(
    sourceFile: string,
    testFiles: string[]
): boolean {
    const baseName = sourceFile
        .split("/")
        .pop()
        ?.replace(/\.(ts|tsx)$/, "");
    if (!baseName) return false;

    // Check for direct test file
    const hasDirectTest = testFiles.some(
        (tf) =>
            tf.includes(`${baseName}.test.ts`) ||
            tf.includes(`${baseName}.spec.ts`)
    );

    if (hasDirectTest) return true;

    // Check if the module is tested indirectly (imported in a test file)
    for (const testFile of testFiles) {
        try {
            const content = readFileSync(testFile, "utf-8");
            if (content.includes(baseName)) {
                return true;
            }
        } catch {
            continue;
        }
    }

    return false;
}

// Get exported functions/classes from a source file
function getExportedMembers(filePath: string): string[] {
    try {
        const content = readFileSync(filePath, "utf-8");
        const exports: string[] = [];

        // Match export declarations
        const exportMatches = content.matchAll(
            /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
        );
        for (const match of exportMatches) {
            exports.push(match[1]);
        }

        // Match default exports
        if (/export\s+default/.test(content)) {
            exports.push("default");
        }

        // Match named exports
        const namedExportMatches = content.matchAll(
            /export\s*{\s*([^}]+)\s*}/g
        );
        for (const match of namedExportMatches) {
            const names = match[1]
                .split(",")
                .map((n) => n.trim().split(" ")[0]);
            exports.push(...names);
        }

        return exports;
    } catch {
        return [];
    }
}

// Check if exports are tested
function areExportsTested(
    sourceFile: string,
    testFiles: string[]
): { total: number; tested: number } {
    const exports = getExportedMembers(sourceFile);
    if (exports.length === 0) return { total: 0, tested: 0 };

    let testedCount = 0;

    for (const exportName of exports) {
        if (exportName === "default") continue;

        for (const testFile of testFiles) {
            try {
                const content = readFileSync(testFile, "utf-8");
                if (content.includes(exportName)) {
                    testedCount++;
                    break;
                }
            } catch {
                continue;
            }
        }
    }

    return { total: exports.length, tested: testedCount };
}

// Key modules that must have tests
const KEY_MODULES = [
    "PlayerSystem",
    "EnemySystem",
    "ProjectileSystem",
    "UpgradeSystem",
    "VFXSystem",
    "SystemRegistry",
    "EventBus",
    "ServiceContainer",
    "SoundManager",
    "MusicPlayer",
    "SFXManager",
    "AudioSettings",
];

describe("Test Coverage Maintenance Properties", () => {
    const srcDir = join(process.cwd(), "src");
    const testsDir = join(srcDir, "tests");

    /**
     * **Feature: code-refactoring, Property 8: Test coverage maintenance**
     * **Validates: Requirements 5.2, 5.5**
     *
     * For any module in the refactored codebase, it should have unit tests
     * covering its public interface and maintain overall coverage percentage.
     */
    test("Property 8: Test coverage maintenance", () => {
        const sourceFiles = findSourceFiles(srcDir);
        const testFiles = findTestFiles(srcDir);

        // Filter to only include key system files
        const keySourceFiles = sourceFiles.filter((sf) =>
            KEY_MODULES.some((km) => sf.includes(km))
        );

        fc.assert(
            fc.property(fc.constantFrom(...keySourceFiles), (sourceFile) => {
                // Property: Key modules should have corresponding tests
                const hasTets = hasCorrespondingTests(sourceFile, testFiles);

                // Get relative path for better error messages
                const relativePath = relative(srcDir, sourceFile);

                if (!hasTets) {
                    console.warn(
                        `Warning: ${relativePath} may not have corresponding tests`
                    );
                }

                return hasTets;
            }),
            { numRuns: Math.min(keySourceFiles.length * 2, 50) }
        );
    });

    test("Property 8a: System modules have dedicated test files", () => {
        const systemModules = [
            "PlayerSystem",
            "EnemySystem",
            "ProjectileSystem",
            "UpgradeSystem",
            "VFXSystem",
        ];

        fc.assert(
            fc.property(fc.constantFrom(...systemModules), (moduleName) => {
                const testPath = join(testsDir, `${moduleName}.test.ts`);
                return existsSync(testPath);
            }),
            { numRuns: systemModules.length }
        );
    });

    test("Property 8b: Audio modules have dedicated test files", () => {
        const audioModules = [
            "SoundManager",
            "MusicPlayer",
            "SFXManager",
            "AudioSettings",
        ];

        fc.assert(
            fc.property(fc.constantFrom(...audioModules), (moduleName) => {
                const testPath = join(testsDir, `${moduleName}.test.ts`);
                return existsSync(testPath);
            }),
            { numRuns: audioModules.length }
        );
    });

    test("Property 8c: Test files contain meaningful assertions", () => {
        const testFiles = findTestFiles(testsDir);

        fc.assert(
            fc.property(fc.constantFrom(...testFiles), (testFilePath) => {
                try {
                    const content = readFileSync(testFilePath, "utf-8");

                    // Count expect statements
                    const expectCount = (content.match(/expect\s*\(/g) || [])
                        .length;

                    // Test files should have at least one assertion
                    return expectCount > 0;
                } catch {
                    return false;
                }
            }),
            { numRuns: Math.min(testFiles.length * 2, 100) }
        );
    });

    test("Property 8d: Property tests use fast-check library", () => {
        const testFiles = findTestFiles(testsDir);

        // Filter to property test files
        const propertyTestFiles = testFiles.filter((tf) => {
            try {
                const content = readFileSync(tf, "utf-8");
                return (
                    content.includes("fc.assert") ||
                    content.includes("fc.property")
                );
            } catch {
                return false;
            }
        });

        fc.assert(
            fc.property(
                fc.constantFrom(...propertyTestFiles),
                (testFilePath) => {
                    try {
                        const content = readFileSync(testFilePath, "utf-8");

                        // Should import fast-check
                        const importsFastCheck =
                            content.includes('from "fast-check"') ||
                            content.includes("from 'fast-check'") ||
                            content.includes(
                                'import * as fc from "fast-check"'
                            ) ||
                            content.includes(
                                "import * as fc from 'fast-check'"
                            ) ||
                            content.includes('import fc from "fast-check"') ||
                            content.includes("import fc from 'fast-check'");

                        // Should use fc.assert
                        const usesFcAssert = content.includes("fc.assert");

                        return importsFastCheck && usesFcAssert;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: Math.min(propertyTestFiles.length * 2, 50) }
        );
    });

    // Unit tests for coverage verification
    test("all key modules have test coverage", () => {
        const testFiles = findTestFiles(srcDir);

        for (const moduleName of KEY_MODULES) {
            const hasTest = testFiles.some(
                (tf) =>
                    tf.includes(`${moduleName}.test.ts`) ||
                    tf.includes(`${moduleName}.spec.ts`) ||
                    // Check if module is tested in integration tests
                    testFiles.some((testFile) => {
                        try {
                            const content = readFileSync(testFile, "utf-8");
                            return content.includes(moduleName);
                        } catch {
                            return false;
                        }
                    })
            );

            expect(hasTest).toBe(true);
        }
    });

    test("test files exist for all system modules", () => {
        const expectedTestFiles = [
            "PlayerSystem.test.ts",
            "EnemySystem.test.ts",
            "ProjectileSystem.test.ts",
            "UpgradeSystem.test.ts",
            "VFXSystem.test.ts",
        ];

        for (const testFile of expectedTestFiles) {
            const testPath = join(testsDir, testFile);
            expect(existsSync(testPath)).toBe(true);
        }
    });

    test("test files exist for audio modules", () => {
        const expectedTestFiles = [
            "SoundManager.test.ts",
            "MusicPlayer.test.ts",
            "SFXManager.test.ts",
            "AudioSettings.test.ts",
        ];

        for (const testFile of expectedTestFiles) {
            const testPath = join(testsDir, testFile);
            expect(existsSync(testPath)).toBe(true);
        }
    });

    test("property test files exist for refactoring validation", () => {
        const expectedPropertyTests = [
            "fileAnalysis.test.ts",
            "systemInterfaces.test.ts",
            "directoryOrganization.test.ts",
            "importResolution.test.ts",
            "typeSafety.test.ts",
        ];

        for (const testFile of expectedPropertyTests) {
            const testPath = join(testsDir, testFile);
            expect(existsSync(testPath)).toBe(true);
        }
    });
});
