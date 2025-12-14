#!/usr/bin/env ts-node

/**
 * CLI tool to analyze file sizes and identify refactoring candidates
 */

import { checkTypeScriptCompilation } from '../src/utils/compilationCheck';
import {
  analyzeDirectory,
  generateSummary,
  getExtremeFiles,
  getLargeFiles,
  sortByLineCount,
} from '../src/utils/fileAnalysis';

function main() {
  console.log('🔍 Analyzing codebase for refactoring candidates...\n');

  // Analyze the src directory
  const results = analyzeDirectory('./src');
  const summary = generateSummary(results);
  const largeFiles = getLargeFiles(results);
  const extremeFiles = getExtremeFiles(results);
  const sortedResults = sortByLineCount(results);

  // Print summary
  console.log('📊 Analysis Summary:');
  console.log(`   Total files: ${summary.totalFiles}`);
  console.log(`   Large files (>300 lines): ${summary.largeFiles}`);
  console.log(`   Extreme files (>1000 lines): ${summary.extremeFiles}`);
  console.log(`   Average line count: ${summary.averageLineCount}`);
  console.log(`   Largest file: ${summary.largestFile} (${summary.maxLineCount} lines)\n`);

  // Show extreme files (highest priority for refactoring)
  if (extremeFiles.length > 0) {
    console.log('🚨 Extreme files requiring immediate refactoring:');
    extremeFiles.forEach((file) => {
      console.log(`   ${file.path}: ${file.lineCount} lines`);
    });
    console.log();
  }

  // Show large files
  if (largeFiles.length > 0) {
    console.log('⚠️  Large files that should be considered for refactoring:');
    largeFiles.slice(0, 10).forEach((file) => {
      console.log(`   ${file.path}: ${file.lineCount} lines`);
    });
    if (largeFiles.length > 10) {
      console.log(`   ... and ${largeFiles.length - 10} more files`);
    }
    console.log();
  }

  // Show top 10 largest files
  console.log('📈 Top 10 largest files:');
  sortedResults.slice(0, 10).forEach((file, index) => {
    const status = file.isExtreme ? '🚨' : file.isLarge ? '⚠️' : '✅';
    console.log(`   ${index + 1}. ${status} ${file.path}: ${file.lineCount} lines`);
  });
  console.log();

  // Check TypeScript compilation
  console.log('🔧 Checking TypeScript compilation...');
  const compilationResult = checkTypeScriptCompilation();

  if (compilationResult.success) {
    console.log('✅ TypeScript compilation successful');
  } else {
    console.log('❌ TypeScript compilation failed');
    if (compilationResult.errors.length > 0) {
      console.log('   Errors:');
      compilationResult.errors.slice(0, 5).forEach((error) => {
        console.log(`     ${error}`);
      });
      if (compilationResult.errors.length > 5) {
        console.log(`     ... and ${compilationResult.errors.length - 5} more errors`);
      }
    }
  }
  console.log();

  // Provide recommendations
  console.log('💡 Refactoring Recommendations:');
  if (extremeFiles.length > 0) {
    console.log(`   1. Prioritize refactoring ${extremeFiles.length} extreme file(s)`);
    console.log(`   2. Break down ${extremeFiles[0]?.path || 'largest file'} first`);
  }
  if (largeFiles.length > extremeFiles.length) {
    console.log(
      `   3. Consider refactoring ${largeFiles.length - extremeFiles.length} additional large files`
    );
  }
  console.log('   4. Aim for maximum 500 lines per file after refactoring');
  console.log('   5. Use system-based architecture for game logic separation');
}

if (require.main === module) {
  main();
}
