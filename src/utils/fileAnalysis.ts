/**
 * File analysis utilities for code refactoring
 * Identifies large files and measures line counts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export interface FileAnalysisResult {
  path: string;
  lineCount: number;
  size: number;
  isLarge: boolean;
  isExtreme: boolean;
}

export interface AnalysisConfig {
  largeFileThreshold: number;
  extremeFileThreshold: number;
  includeExtensions: string[];
  excludeDirectories: string[];
}

const DEFAULT_CONFIG: AnalysisConfig = {
  largeFileThreshold: 300,
  extremeFileThreshold: 1000,
  includeExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  excludeDirectories: ['node_modules', '.git', 'dist', 'build', 'coverage'],
};

/**
 * Counts the number of lines in a file
 */
export function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
    return 0;
  }
}

/**
 * Recursively analyzes files in a directory
 */
export function analyzeDirectory(
  dirPath: string,
  config: Partial<AnalysisConfig> = {}
): FileAnalysisResult[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const results: FileAnalysisResult[] = [];

  function analyzeRecursive(currentPath: string): void {
    try {
      const items = readdirSync(currentPath);

      for (const item of items) {
        const itemPath = join(currentPath, item);
        const stats = statSync(itemPath);

        if (stats.isDirectory()) {
          // Skip excluded directories
          if (!finalConfig.excludeDirectories.includes(item)) {
            analyzeRecursive(itemPath);
          }
        } else if (stats.isFile()) {
          const ext = extname(item);

          // Only analyze files with included extensions
          if (finalConfig.includeExtensions.includes(ext)) {
            const lineCount = countLines(itemPath);
            const result: FileAnalysisResult = {
              path: itemPath,
              lineCount,
              size: stats.size,
              isLarge: lineCount > finalConfig.largeFileThreshold,
              isExtreme: lineCount > finalConfig.extremeFileThreshold,
            };
            results.push(result);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to analyze directory ${currentPath}:`, error);
    }
  }

  analyzeRecursive(dirPath);
  return results;
}

/**
 * Filters analysis results to show only large files
 */
export function getLargeFiles(results: FileAnalysisResult[]): FileAnalysisResult[] {
  return results.filter((result) => result.isLarge);
}

/**
 * Filters analysis results to show only extreme files
 */
export function getExtremeFiles(results: FileAnalysisResult[]): FileAnalysisResult[] {
  return results.filter((result) => result.isExtreme);
}

/**
 * Sorts analysis results by line count (descending)
 */
export function sortByLineCount(results: FileAnalysisResult[]): FileAnalysisResult[] {
  return [...results].sort((a, b) => b.lineCount - a.lineCount);
}

/**
 * Generates a summary report of the analysis
 */
export function generateSummary(results: FileAnalysisResult[]): {
  totalFiles: number;
  largeFiles: number;
  extremeFiles: number;
  averageLineCount: number;
  maxLineCount: number;
  largestFile: string | null;
} {
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

  const largeFiles = getLargeFiles(results);
  const extremeFiles = getExtremeFiles(results);
  const totalLines = results.reduce((sum, result) => sum + result.lineCount, 0);
  const sortedResults = sortByLineCount(results);

  return {
    totalFiles: results.length,
    largeFiles: largeFiles.length,
    extremeFiles: extremeFiles.length,
    averageLineCount: Math.round(totalLines / results.length),
    maxLineCount: sortedResults[0]?.lineCount || 0,
    largestFile: sortedResults[0]?.path || null,
  };
}
