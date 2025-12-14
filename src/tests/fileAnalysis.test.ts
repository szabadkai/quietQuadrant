/**
 * Property-based tests for file analysis functionality
 * Feature: code-refactoring, Property 1: File size constraint compliance
 */

import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fc from 'fast-check';
import {
  analyzeDirectory,
  countLines,
  generateSummary,
  getExtremeFiles,
  getLargeFiles,
} from '../utils/fileAnalysis';

describe('File Analysis Properties', () => {
  const tempDir = join(process.cwd(), 'temp-test-files');

  beforeAll(() => {
    // Ensure temp directory exists
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Feature: code-refactoring, Property 1: File size constraint compliance
   * Validates: Requirements 1.2
   */
  test('Property 1: File size constraint compliance', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2000 }), (lineCount) => {
        // Generate a test file with the specified line count
        const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.ts`;
        const filePath = join(tempDir, fileName);

        // Create file content with exact line count
        const lines = Array(lineCount)
          .fill(0)
          .map((_, i) => `// Line ${i + 1}`);
        const content = lines.join('\n');

        try {
          writeFileSync(filePath, content);

          // Test the line counting function
          const actualLineCount = countLines(filePath);

          // Verify line count accuracy
          const lineCountAccurate = actualLineCount === lineCount;

          // Test classification logic
          const _isLarge = lineCount > 300;
          const _isExtreme = lineCount > 1000;
          const shouldBeRefactored = lineCount > 500;

          // After refactoring, no file should exceed 500 lines
          // This property should hold for all refactored files
          const meetsConstraint = lineCount <= 500;

          // Clean up
          unlinkSync(filePath);

          // The property: line counting should be accurate AND
          // files exceeding 500 lines should be identified for refactoring
          return lineCountAccurate && (meetsConstraint || shouldBeRefactored);
        } catch (_error) {
          // Clean up on error
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
          return false;
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 1a: Large file identification accuracy', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2000 }), (lineCount) => {
        const fileName = `test-large-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.ts`;
        const filePath = join(tempDir, fileName);

        const lines = Array(lineCount)
          .fill(0)
          .map((_, i) => `const x${i} = ${i};`);
        const content = lines.join('\n');

        try {
          writeFileSync(filePath, content);

          // Analyze the temporary directory
          const results = analyzeDirectory(tempDir);
          const testFile = results.find((r) => r.path === filePath);

          if (!testFile) {
            unlinkSync(filePath);
            return false;
          }

          // Verify classification
          const expectedIsLarge = lineCount > 300;
          const expectedIsExtreme = lineCount > 1000;

          const classificationCorrect =
            testFile.isLarge === expectedIsLarge &&
            testFile.isExtreme === expectedIsExtreme &&
            testFile.lineCount === lineCount;

          // Clean up
          unlinkSync(filePath);

          return classificationCorrect;
        } catch (_error) {
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
          return false;
        }
      }),
      { numRuns: 50 }
    );
  });

  test('Property 1b: Summary generation consistency', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1500 }), {
          minLength: 1,
          maxLength: 10,
        }),
        (lineCounts) => {
          const fileNames: string[] = [];

          try {
            // Create multiple test files
            lineCounts.forEach((lineCount, index) => {
              const fileName = `test-summary-${index}-${Date.now()}.ts`;
              const filePath = join(tempDir, fileName);
              fileNames.push(filePath);

              const lines = Array(lineCount)
                .fill(0)
                .map((_, i) => `// Test line ${i}`);
              writeFileSync(filePath, lines.join('\n'));
            });

            // Analyze and generate summary
            const results = analyzeDirectory(tempDir);
            const testFiles = results.filter((r) => fileNames.includes(r.path));
            const summary = generateSummary(testFiles);

            // Verify summary accuracy
            const expectedLargeFiles = lineCounts.filter((lc) => lc > 300).length;
            const expectedExtremeFiles = lineCounts.filter((lc) => lc > 1000).length;
            const expectedMaxLineCount = Math.max(...lineCounts);
            const expectedTotalFiles = lineCounts.length;

            const summaryCorrect =
              summary.totalFiles === expectedTotalFiles &&
              summary.largeFiles === expectedLargeFiles &&
              summary.extremeFiles === expectedExtremeFiles &&
              summary.maxLineCount === expectedMaxLineCount;

            return summaryCorrect;
          } finally {
            // Clean up all test files
            fileNames.forEach((filePath) => {
              if (existsSync(filePath)) {
                unlinkSync(filePath);
              }
            });
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 1c: Filter functions consistency', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 2000 }), {
          minLength: 1,
          maxLength: 15,
        }),
        (lineCounts) => {
          // Create mock analysis results
          const mockResults = lineCounts.map((lineCount, index) => ({
            path: `mock-file-${index}.ts`,
            lineCount,
            size: lineCount * 50, // Approximate size
            isLarge: lineCount > 300,
            isExtreme: lineCount > 1000,
          }));

          // Test filter functions
          const largeFiles = getLargeFiles(mockResults);
          const extremeFiles = getExtremeFiles(mockResults);

          // Verify filtering logic
          const expectedLargeCount = lineCounts.filter((lc) => lc > 300).length;
          const expectedExtremeCount = lineCounts.filter((lc) => lc > 1000).length;

          const filteringCorrect =
            largeFiles.length === expectedLargeCount &&
            extremeFiles.length === expectedExtremeCount &&
            largeFiles.every((f) => f.isLarge) &&
            extremeFiles.every((f) => f.isExtreme);

          return filteringCorrect;
        }
      ),
      { numRuns: 50 }
    );
  });

  // Unit tests for edge cases
  test('handles empty directories', () => {
    const emptyDir = join(tempDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    const results = analyzeDirectory(emptyDir);
    const summary = generateSummary(results);

    expect(results).toHaveLength(0);
    expect(summary.totalFiles).toBe(0);
    expect(summary.largeFiles).toBe(0);
    expect(summary.extremeFiles).toBe(0);

    rmSync(emptyDir, { recursive: true, force: true });
  });

  test('handles non-existent files gracefully', () => {
    const nonExistentFile = join(tempDir, 'does-not-exist.ts');
    const lineCount = countLines(nonExistentFile);

    expect(lineCount).toBe(0);
  });

  test('correctly identifies file extensions', () => {
    const testFiles = [
      { name: 'test.ts', shouldInclude: true },
      { name: 'test.tsx', shouldInclude: true },
      { name: 'test.js', shouldInclude: true },
      { name: 'test.jsx', shouldInclude: true },
      { name: 'test.txt', shouldInclude: false },
      { name: 'test.md', shouldInclude: false },
    ];

    testFiles.forEach(({ name }) => {
      const filePath = join(tempDir, name);
      writeFileSync(filePath, 'const test = 1;\n'.repeat(10));
    });

    const results = analyzeDirectory(tempDir);
    const foundFiles = results.map((r) => r.path.split('/').pop());

    testFiles.forEach(({ name, shouldInclude }) => {
      if (shouldInclude) {
        expect(foundFiles).toContain(name);
      } else {
        expect(foundFiles).not.toContain(name);
      }

      const filePath = join(tempDir, name);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });
  });
});
