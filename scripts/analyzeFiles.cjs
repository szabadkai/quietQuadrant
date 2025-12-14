#!/usr/bin/env node

/**
 * CLI tool to analyze file sizes and identify refactoring candidates
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function countLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        return content.split("\n").length;
    } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error.message);
        return 0;
    }
}

function analyzeDirectory(dirPath) {
    const results = [];
    const excludeDirectories = [
        "node_modules",
        ".git",
        "dist",
        "build",
        "coverage",
    ];
    const includeExtensions = [".ts", ".tsx", ".js", ".jsx"];

    function analyzeRecursive(currentPath) {
        try {
            const items = fs.readdirSync(currentPath);

            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stats = fs.statSync(itemPath);

                if (stats.isDirectory()) {
                    if (!excludeDirectories.includes(item)) {
                        analyzeRecursive(itemPath);
                    }
                } else if (stats.isFile()) {
                    const ext = path.extname(item);

                    if (includeExtensions.includes(ext)) {
                        const lineCount = countLines(itemPath);
                        const result = {
                            path: itemPath,
                            lineCount,
                            size: stats.size,
                            isLarge: lineCount > 300,
                            isExtreme: lineCount > 1000,
                        };
                        results.push(result);
                    }
                }
            }
        } catch (error) {
            console.warn(
                `Failed to analyze directory ${currentPath}:`,
                error.message
            );
        }
    }

    analyzeRecursive(dirPath);
    return results;
}

function generateSummary(results) {
    if (results.length === 0) {
        return {
            totalFiles: 0,
            largeFiles: 0,
            extremeFiles: 0,
            averageLineCount: 0,
            maxLineCount: 0,
            largestFile: null,
        };
    }

    const largeFiles = results.filter((r) => r.isLarge);
    const extremeFiles = results.filter((r) => r.isExtreme);
    const totalLines = results.reduce(
        (sum, result) => sum + result.lineCount,
        0
    );
    const sortedResults = [...results].sort(
        (a, b) => b.lineCount - a.lineCount
    );

    return {
        totalFiles: results.length,
        largeFiles: largeFiles.length,
        extremeFiles: extremeFiles.length,
        averageLineCount: Math.round(totalLines / results.length),
        maxLineCount: sortedResults[0]?.lineCount || 0,
        largestFile: sortedResults[0]?.path || null,
    };
}

function main() {
    console.log("🔍 Analyzing codebase for refactoring candidates...\n");

    // Analyze the src directory
    const results = analyzeDirectory("./src");
    const summary = generateSummary(results);
    const largeFiles = results.filter((r) => r.isLarge);
    const extremeFiles = results.filter((r) => r.isExtreme);
    const sortedResults = [...results].sort(
        (a, b) => b.lineCount - a.lineCount
    );

    // Print summary
    console.log("📊 Analysis Summary:");
    console.log(`   Total files: ${summary.totalFiles}`);
    console.log(`   Large files (>300 lines): ${summary.largeFiles}`);
    console.log(`   Extreme files (>1000 lines): ${summary.extremeFiles}`);
    console.log(`   Average line count: ${summary.averageLineCount}`);
    console.log(
        `   Largest file: ${summary.largestFile} (${summary.maxLineCount} lines)\n`
    );

    // Show extreme files (highest priority for refactoring)
    if (extremeFiles.length > 0) {
        console.log("🚨 Extreme files requiring immediate refactoring:");
        extremeFiles.forEach((file) => {
            console.log(`   ${file.path}: ${file.lineCount} lines`);
        });
        console.log();
    }

    // Show large files
    if (largeFiles.length > 0) {
        console.log(
            "⚠️  Large files that should be considered for refactoring:"
        );
        largeFiles.slice(0, 10).forEach((file) => {
            console.log(`   ${file.path}: ${file.lineCount} lines`);
        });
        if (largeFiles.length > 10) {
            console.log(`   ... and ${largeFiles.length - 10} more files`);
        }
        console.log();
    }

    // Show top 10 largest files
    console.log("📈 Top 10 largest files:");
    sortedResults.slice(0, 10).forEach((file, index) => {
        const status = file.isExtreme ? "🚨" : file.isLarge ? "⚠️" : "✅";
        console.log(
            `   ${index + 1}. ${status} ${file.path}: ${file.lineCount} lines`
        );
    });
    console.log();

    // Check TypeScript compilation
    console.log("🔧 Checking TypeScript compilation...");
    try {
        execSync("npx tsc --noEmit", { stdio: "pipe" });
        console.log("✅ TypeScript compilation successful");
    } catch (error) {
        console.log("❌ TypeScript compilation failed");
        const output =
            error.stdout?.toString() || error.stderr?.toString() || "";
        const lines = output
            .split("\n")
            .filter((line) => line.trim() && line.includes("error"));
        if (lines.length > 0) {
            console.log("   Errors:");
            lines.slice(0, 5).forEach((error) => {
                console.log(`     ${error.trim()}`);
            });
            if (lines.length > 5) {
                console.log(`     ... and ${lines.length - 5} more errors`);
            }
        }
    }
    console.log();

    // Provide recommendations
    console.log("💡 Refactoring Recommendations:");
    if (extremeFiles.length > 0) {
        console.log(
            `   1. Prioritize refactoring ${extremeFiles.length} extreme file(s)`
        );
        console.log(
            `   2. Break down ${extremeFiles[0]?.path || "largest file"} first`
        );
    }
    if (largeFiles.length > extremeFiles.length) {
        console.log(
            `   3. Consider refactoring ${
                largeFiles.length - extremeFiles.length
            } additional large files`
        );
    }
    console.log("   4. Aim for maximum 500 lines per file after refactoring");
    console.log(
        "   5. Use system-based architecture for game logic separation"
    );
}

if (require.main === module) {
    main();
}
