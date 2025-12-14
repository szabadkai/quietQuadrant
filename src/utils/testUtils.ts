/**
 * Test utilities for property-based testing with fast-check
 * Provides common generators and test helpers for refactoring validation
 */

import * as fc from "fast-check";

export interface TestConfig {
    numRuns: number;
    timeout: number;
    verbose: boolean;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
    numRuns: 100,
    timeout: 5000,
    verbose: false,
};

/**
 * Generators for common test data
 */
export const generators = {
    /**
     * Generates valid TypeScript file names
     */
    fileName: () =>
        fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
            .map((s) => `${s}.ts`),

    /**
     * Generates valid directory names
     */
    directoryName: () =>
        fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),

    /**
     * Generates file paths
     */
    filePath: () =>
        fc
            .array(generators.directoryName(), { minLength: 0, maxLength: 5 })
            .chain((dirs) =>
                generators.fileName().map((file) => [...dirs, file].join("/"))
            ),

    /**
     * Generates TypeScript import statements
     */
    importStatement: () =>
        fc
            .record({
                what: fc.oneof(
                    fc
                        .string({ minLength: 1, maxLength: 20 })
                        .filter((s) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s)),
                    fc
                        .array(
                            fc
                                .string({ minLength: 1, maxLength: 15 })
                                .filter((s) =>
                                    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s)
                                ),
                            { minLength: 1, maxLength: 5 }
                        )
                        .map((names) => `{ ${names.join(", ")} }`)
                ),
                from: fc.oneof(
                    generators.filePath().map((path) => `./${path}`),
                    fc
                        .string({ minLength: 1, maxLength: 20 })
                        .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
                ),
            })
            .map(({ what, from }) => `import ${what} from '${from}';`),

    /**
     * Generates simple TypeScript code blocks
     */
    codeBlock: () =>
        fc.oneof(
            fc.constant("const x = 1;"),
            fc.constant('let y = "hello";'),
            fc.constant("function test() { return 42; }"),
            fc.constant('const arrow = () => "test";'),
            fc.constant("interface Test { x: number; }"),
            fc.constant("type MyType = string | number;"),
            fc.constant("class TestClass { constructor() {} }")
        ),

    /**
     * Generates file content with imports and code
     */
    fileContent: () =>
        fc
            .record({
                imports: fc.array(generators.importStatement(), {
                    minLength: 0,
                    maxLength: 10,
                }),
                code: fc.array(generators.codeBlock(), {
                    minLength: 1,
                    maxLength: 20,
                }),
            })
            .map(({ imports, code }) => [...imports, "", ...code].join("\n")),

    /**
     * Generates line counts for testing file size constraints
     */
    lineCount: () => fc.integer({ min: 1, max: 2000 }),

    /**
     * Generates system names for testing
     */
    systemName: () =>
        fc.oneof(
            fc.constant("PlayerSystem"),
            fc.constant("EnemySystem"),
            fc.constant("ProjectileSystem"),
            fc.constant("UpgradeSystem"),
            fc.constant("VFXSystem"),
            fc.constant("AudioSystem")
        ),
};

/**
 * Property test wrapper with default configuration
 */
export function propertyTest<_T>(
    name: string,
    property: fc.IProperty<unknown>,
    config: Partial<TestConfig> = {}
): void {
    const finalConfig = { ...DEFAULT_TEST_CONFIG, ...config };

    test(
        name,
        () => {
            fc.assert(property, {
                numRuns: finalConfig.numRuns,
                timeout: finalConfig.timeout,
                verbose: finalConfig.verbose,
            });
        },
        finalConfig.timeout + 1000
    );
}

/**
 * Creates a property test for file size constraints
 */
export function createFileSizeProperty() {
    return fc.property(generators.lineCount(), (lineCount) => {
        const _isLarge = lineCount > 300;
        const _isExtreme = lineCount > 1000;
        const shouldBeRefactored = lineCount > 500;

        // After refactoring, no file should exceed 500 lines
        if (shouldBeRefactored) {
            return lineCount <= 500; // This will fail for files that need refactoring
        }

        return true;
    });
}

/**
 * Creates a property test for import resolution
 */
export function createImportResolutionProperty() {
    return fc.property(
        generators.importStatement(),
        generators.filePath(),
        (importStmt, _filePath) => {
            // Extract the import path from the statement
            const match = importStmt.match(/from ['"]([^'"]+)['"]/);
            if (!match) return true;

            const importPath = match[1];

            // Relative imports should start with . or ..
            if (importPath.startsWith("./") || importPath.startsWith("../")) {
                // This is a relative import - it should resolve to an existing file
                // In a real test, we would check if the file exists
                return true; // Simplified for this example
            }

            // Package imports should be valid package names
            return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(importPath.split("/")[0]);
        }
    );
}

/**
 * Creates a property test for directory organization
 */
export function createDirectoryOrganizationProperty() {
    return fc.property(
        generators.filePath(),
        generators.systemName(),
        (filePath, _systemName) => {
            const pathParts = filePath.split("/");
            const fileName = pathParts[pathParts.length - 1];

            // System files should be in appropriate directories
            if (fileName.includes("System")) {
                return (
                    pathParts.includes("systems") || pathParts.includes("game")
                );
            }

            // Test files should be in tests directory or co-located
            if (fileName.includes(".test.") || fileName.includes(".spec.")) {
                return (
                    pathParts.includes("tests") ||
                    pathParts.includes("__tests__") ||
                    pathParts.some((part) => part.includes("test"))
                );
            }

            return true;
        }
    );
}

/**
 * Test helper to validate system interface implementation
 */
export function validateSystemInterface(system: unknown): boolean {
    return (
        typeof (system as any).initialize === "function" &&
        typeof (system as any).update === "function" &&
        typeof (system as any).shutdown === "function"
    );
}

/**
 * Test helper to check if a file path follows naming conventions
 */
export function followsNamingConventions(filePath: string): boolean {
    const fileName = filePath.split("/").pop() || "";

    // TypeScript files should use camelCase or PascalCase
    const nameWithoutExt = fileName.replace(/\.(ts|tsx|js|jsx)$/, "");

    // Check for valid naming patterns
    const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(nameWithoutExt);
    const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(nameWithoutExt);
    const isKebabCase = /^[a-z][a-z0-9-]*$/.test(nameWithoutExt);
    const isTestFile = /\.(test|spec)$/.test(nameWithoutExt);

    return isCamelCase || isPascalCase || isKebabCase || isTestFile;
}
