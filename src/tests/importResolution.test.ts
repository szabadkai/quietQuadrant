/**
 * Property-based tests for import resolution
 * Feature: code-refactoring, Property 6: Import path correctness
 * Validates: Requirements 3.5, 4.5
 */

import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";

// Define source directories to check
const SOURCE_DIRECTORIES = [
    "src/audio",
    "src/config",
    "src/game",
    "src/game/systems",
    "src/game/systems/interfaces",
    "src/game/types",
    "src/models",
    "src/persistence",
    "src/state",
    "src/ui/components",
    "src/ui/input",
    "src/utils",
];

// Import statement patterns
const IMPORT_PATTERNS = {
    // Match: import { X } from "path" or import X from "path"
    namedImport: /import\s+(?:type\s+)?{[^}]+}\s+from\s+["']([^"']+)["']/g,
    defaultImport: /import\s+(?:type\s+)?(\w+)\s+from\s+["']([^"']+)["']/g,
    sideEffectImport: /import\s+["']([^"']+)["']/g,
    exportFrom: /export\s+(?:\*|{[^}]+})\s+from\s+["']([^"']+)["']/g,
};

/**
 * Extract all import paths from a TypeScript file
 */
function extractImportPaths(content: string): string[] {
    const paths: string[] = [];

    // Match named imports: import { X } from "path"
    const namedMatches = content.matchAll(IMPORT_PATTERNS.namedImport);
    for (const match of namedMatches) {
        paths.push(match[1]);
    }

    // Match default imports: import X from "path"
    const defaultMatches = content.matchAll(IMPORT_PATTERNS.defaultImport);
    for (const match of defaultMatches) {
        paths.push(match[2]);
    }

    // Match export from: export * from "path"
    const exportMatches = content.matchAll(IMPORT_PATTERNS.exportFrom);
    for (const match of exportMatches) {
        paths.push(match[1]);
    }

    return [...new Set(paths)]; // Remove duplicates
}

/**
 * Check if an import path is a relative path
 */
function isRelativePath(importPath: string): boolean {
    return importPath.startsWith("./") || importPath.startsWith("../");
}

/**
 * Check if an import path is a node module
 */
function isNodeModule(importPath: string): boolean {
    // Common node modules and external packages
    const nodeModules = [
        "react",
        "phaser",
        "zustand",
        "fast-check",
        "fs",
        "path",
    ];
    return (
        nodeModules.some(
            (mod) => importPath === mod || importPath.startsWith(`${mod}/`)
        ) || !importPath.startsWith(".")
    );
}

/**
 * Resolve a relative import path to an absolute path
 */
function resolveImportPath(
    importPath: string,
    fromFile: string
): string | null {
    if (!isRelativePath(importPath)) {
        return null; // Skip node modules
    }

    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.resolve(fromDir, importPath);

    // Try different extensions
    const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx", ".js"];

    for (const ext of extensions) {
        const fullPath = resolvedPath + ext;
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    // Check if it's already a complete path
    if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
    }

    return null;
}

/**
 * Get all TypeScript files in a directory
 */
function getTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Skip node_modules and hidden directories
            if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
                files.push(...getTypeScriptFiles(fullPath));
            }
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
}

describe("Import Resolution Properties", () => {
    /**
     * Feature: code-refactoring, Property 6: Import path correctness
     * Validates: Requirements 3.5, 4.5
     */
    test("Property 6: Import path correctness", () => {
        // Get all TypeScript files from source directories
        const allFiles: string[] = [];
        for (const dir of SOURCE_DIRECTORIES) {
            const dirPath = path.resolve(process.cwd(), dir);
            allFiles.push(...getTypeScriptFiles(dirPath));
        }

        // Filter to only include files that exist
        const existingFiles = allFiles.filter((f) => fs.existsSync(f));

        if (existingFiles.length === 0) {
            return; // Skip if no files found
        }

        fc.assert(
            fc.property(fc.constantFrom(...existingFiles), (filePath) => {
                const content = fs.readFileSync(filePath, "utf-8");
                const importPaths = extractImportPaths(content);

                // Check each relative import resolves correctly
                for (const importPath of importPaths) {
                    if (isRelativePath(importPath)) {
                        const resolved = resolveImportPath(
                            importPath,
                            filePath
                        );
                        if (resolved === null) {
                            // Import path doesn't resolve
                            console.error(
                                `Failed to resolve import "${importPath}" in ${filePath}`
                            );
                            return false;
                        }
                    }
                }

                return true;
            }),
            { numRuns: Math.min(100, existingFiles.length) }
        );
    });

    test("Property 6a: Index files export valid modules", () => {
        const indexFiles = [
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
        ].map((f) => path.resolve(process.cwd(), f));

        const existingIndexFiles = indexFiles.filter((f) => fs.existsSync(f));

        if (existingIndexFiles.length === 0) {
            return; // Skip if no index files found
        }

        fc.assert(
            fc.property(fc.constantFrom(...existingIndexFiles), (indexPath) => {
                const content = fs.readFileSync(indexPath, "utf-8");
                const importPaths = extractImportPaths(content);

                // All exports from index files should resolve
                for (const importPath of importPaths) {
                    if (isRelativePath(importPath)) {
                        const resolved = resolveImportPath(
                            importPath,
                            indexPath
                        );
                        if (resolved === null) {
                            console.error(
                                `Index file ${indexPath} has unresolved export: ${importPath}`
                            );
                            return false;
                        }
                    }
                }

                return true;
            }),
            { numRuns: existingIndexFiles.length }
        );
    });

    test("Property 6b: No circular imports in index files", () => {
        const indexFiles = [
            "src/game/systems/index.ts",
            "src/game/systems/interfaces/index.ts",
            "src/audio/index.ts",
        ].map((f) => path.resolve(process.cwd(), f));

        const existingIndexFiles = indexFiles.filter((f) => fs.existsSync(f));

        fc.assert(
            fc.property(fc.constantFrom(...existingIndexFiles), (indexPath) => {
                const content = fs.readFileSync(indexPath, "utf-8");
                const importPaths = extractImportPaths(content);

                // Index files should not import from themselves
                const indexDir = path.dirname(indexPath);
                for (const importPath of importPaths) {
                    if (isRelativePath(importPath)) {
                        const resolved = resolveImportPath(
                            importPath,
                            indexPath
                        );
                        if (resolved === indexPath) {
                            console.error(
                                `Circular import detected in ${indexPath}`
                            );
                            return false;
                        }
                    }
                }

                return true;
            }),
            { numRuns: Math.max(1, existingIndexFiles.length) }
        );
    });

    // Unit tests for specific import requirements
    test("systems index exports core infrastructure", () => {
        const indexPath = path.resolve(
            process.cwd(),
            "src/game/systems/index.ts"
        );
        const content = fs.readFileSync(indexPath, "utf-8");

        // Should export core infrastructure
        expect(content).toContain("EventBus");
        expect(content).toContain("ServiceContainer");
        expect(content).toContain("SystemRegistry");
        expect(content).toContain("BaseGameSystem");
    });

    test("audio index exports all audio modules", () => {
        const indexPath = path.resolve(process.cwd(), "src/audio/index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Should export audio modules
        expect(content).toContain("soundManager");
        expect(content).toContain("AudioSettings");
        expect(content).toContain("MusicPlayer");
        expect(content).toContain("SFXManager");
    });

    test("game index provides clean import path", () => {
        const indexPath = path.resolve(process.cwd(), "src/game/index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Should re-export from subdirectories
        expect(content).toContain("./systems");
        expect(content).toContain("./types");
    });

    test("interfaces index exports all system interfaces", () => {
        const indexPath = path.resolve(
            process.cwd(),
            "src/game/systems/interfaces/index.ts"
        );
        const content = fs.readFileSync(indexPath, "utf-8");

        // Should export all interface files
        expect(content).toContain("GameSystem");
        expect(content).toContain("PlayerSystem");
        expect(content).toContain("EnemySystem");
        expect(content).toContain("ProjectileSystem");
        expect(content).toContain("UpgradeSystem");
        expect(content).toContain("VFXSystem");
    });
});
