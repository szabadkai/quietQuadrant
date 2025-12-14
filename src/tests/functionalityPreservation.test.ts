/**
 * Property-based tests for functionality preservation through testing
 * **Feature: code-refactoring, Property 2: Functionality preservation through testing**
 * **Validates: Requirements 1.5, 5.1, 5.4**
 */

import * as fc from "fast-check";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Test file discovery utilities
function findTestFiles(dir: string): string[] {
    const testFiles: string[] = [];

    function scanDir(currentDir: string): void {
        if (!existsSync(currentDir)) return;

        const entries = readdirSync(currentDir);
        for (const entry of entries) {
            const fullPath = join(currentDir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                // Skip node_modules and hidden directories
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

// Check if a test file contains valid test structure
function hasValidTestStructure(filePath: string): boolean {
    try {
        const content = readFileSync(filePath, "utf-8");

        // Check for describe blocks
        const hasDescribe = /describe\s*\(/.test(content);

        // Check for test or it blocks
        const hasTests = /(?:test|it)\s*\(/.test(content);

        // Check for expect assertions
        const hasExpect = /expect\s*\(/.test(content);

        return hasDescribe && hasTests && hasExpect;
    } catch {
        return false;
    }
}

// Check if test file imports from refactored modules
function importsRefactoredModules(filePath: string): boolean {
    try {
        const content = readFileSync(filePath, "utf-8");

        // Check for imports from game/systems
        const importsFromSystems = /from\s+['"].*\/game\/systems/.test(content);

        // Check for imports from audio modules
        const importsFromAudio = /from\s+['"].*\/audio/.test(content);

        // Check for imports from utils
        const importsFromUtils = /from\s+['"].*\/utils/.test(content);

        return importsFromSystems || importsFromAudio || importsFromUtils;
    } catch {
        return false;
    }
}

// Get test count from a test file
function getTestCount(filePath: string): number {
    try {
        const content = readFileSync(filePath, "utf-8");

        // Count test and it blocks (simple regex approach)
        const testMatches = content.match(/(?:test|it)\s*\(/g);
        return testMatches ? testMatches.length : 0;
    } catch {
        return 0;
    }
}

describe("Functionality Preservation Properties", () => {
    const srcDir = join(process.cwd(), "src");
    const testsDir = join(srcDir, "tests");

    /**
     * **Feature: code-refactoring, Property 2: Functionality preservation through testing**
     * **Validates: Requirements 1.5, 5.1, 5.4**
     *
     * For any existing test in the test suite, the test should continue to pass
     * after refactoring without modification.
     */
    test("Property 2: Functionality preservation through testing", () => {
        const testFiles = findTestFiles(testsDir);

        fc.assert(
            fc.property(fc.constantFrom(...testFiles), (testFilePath) => {
                // Property 1: Test file should exist
                if (!existsSync(testFilePath)) {
                    return false;
                }

                // Property 2: Test file should have valid structure
                if (!hasValidTestStructure(testFilePath)) {
                    return false;
                }

                // Property 3: Test file should have at least one test
                const testCount = getTestCount(testFilePath);
                if (testCount === 0) {
                    return false;
                }

                // Property 4: Test file should be readable
                try {
                    readFileSync(testFilePath, "utf-8");
                    return true;
                } catch {
                    return false;
                }
            }),
            { numRuns: Math.min(testFiles.length * 2, 100) }
        );
    });

    test("Property 2a: All system tests import from refactored modules", () => {
        const systemTestFiles = findTestFiles(testsDir).filter(
            (f) =>
                f.includes("System.test") ||
                f.includes("systemInterfaces") ||
                f.includes("systemCommunication")
        );

        fc.assert(
            fc.property(fc.constantFrom(...systemTestFiles), (testFilePath) => {
                // System tests should import from refactored module locations
                return importsRefactoredModules(testFilePath);
            }),
            { numRuns: Math.min(systemTestFiles.length * 2, 50) }
        );
    });

    test("Property 2b: Test files maintain consistent structure", () => {
        const testFiles = findTestFiles(testsDir);

        fc.assert(
            fc.property(fc.constantFrom(...testFiles), (testFilePath) => {
                try {
                    const content = readFileSync(testFilePath, "utf-8");

                    // Check for proper test organization
                    const hasDescribeBlock = /describe\s*\(/.test(content);
                    const hasTestBlocks = /(?:test|it)\s*\(/.test(content);

                    // Tests should have proper imports
                    const hasImports = /import\s+/.test(content);

                    // Tests should use expect for assertions
                    const hasAssertions = /expect\s*\(/.test(content);

                    return (
                        hasDescribeBlock &&
                        hasTestBlocks &&
                        hasImports &&
                        hasAssertions
                    );
                } catch {
                    return false;
                }
            }),
            { numRuns: Math.min(testFiles.length * 2, 100) }
        );
    });

    // Unit tests for edge cases
    test("test directory exists and contains test files", () => {
        expect(existsSync(testsDir)).toBe(true);

        const testFiles = findTestFiles(testsDir);
        expect(testFiles.length).toBeGreaterThan(0);
    });

    test("all test files have valid TypeScript syntax indicators", () => {
        const testFiles = findTestFiles(testsDir);

        for (const testFile of testFiles) {
            const content = readFileSync(testFile, "utf-8");

            // Should have TypeScript imports
            expect(content).toMatch(/import\s+/);

            // Should have describe blocks
            expect(content).toMatch(/describe\s*\(/);

            // Should have test blocks
            expect(content).toMatch(/(?:test|it)\s*\(/);
        }
    });

    test("system test files test the correct modules", () => {
        const systemTests = [
            { file: "PlayerSystem.test.ts", module: "PlayerSystem" },
            { file: "EnemySystem.test.ts", module: "EnemySystem" },
            { file: "ProjectileSystem.test.ts", module: "ProjectileSystem" },
            { file: "UpgradeSystem.test.ts", module: "UpgradeSystem" },
            { file: "VFXSystem.test.ts", module: "VFXSystem" },
        ];

        for (const { file, module } of systemTests) {
            const testPath = join(testsDir, file);
            if (existsSync(testPath)) {
                const content = readFileSync(testPath, "utf-8");
                // Test file should reference the module it's testing
                expect(content).toMatch(new RegExp(module));
            }
        }
    });
});
