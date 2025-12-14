/**
 * TypeScript compilation utilities for import validation
 * Ensures all imports resolve correctly during refactoring
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  output: string;
}

export interface ImportValidationResult {
  file: string;
  imports: string[];
  invalidImports: string[];
  missingFiles: string[];
}

/**
 * Runs TypeScript compilation check
 */
export function checkTypeScriptCompilation(projectRoot: string = process.cwd()): CompilationResult {
  try {
    const tsconfigPath = join(projectRoot, 'tsconfig.json');

    if (!existsSync(tsconfigPath)) {
      return {
        success: false,
        errors: ['tsconfig.json not found'],
        warnings: [],
        output: '',
      };
    }

    // Run TypeScript compiler in check mode (no emit)
    const output = execSync('npx tsc --noEmit --pretty false', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      success: true,
      errors: [],
      warnings: [],
      output: output.toString(),
    };
  } catch (error: unknown) {
    const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
    const lines = output.split('\n').filter((line) => line.trim());

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const line of lines) {
      if (line.includes('error TS')) {
        errors.push(line.trim());
      } else if (line.includes('warning TS')) {
        warnings.push(line.trim());
      }
    }

    return {
      success: false,
      errors,
      warnings,
      output,
    };
  }
}

/**
 * Validates that all imports in a file can be resolved
 */
export function validateImports(filePath: string): ImportValidationResult {
  const result: ImportValidationResult = {
    file: filePath,
    imports: [],
    invalidImports: [],
    missingFiles: [],
  };

  try {
    const fs = require('node:fs');
    const path = require('node:path');

    if (!fs.existsSync(filePath)) {
      result.missingFiles.push(filePath);
      return result;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null = importRegex.exec(content);
    while (match !== null) {
      const importPath = match[1];
      result.imports.push(importPath);
      match = importRegex.exec(content);

      // Check if it's a relative import
      if (importPath.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filePath), importPath);
        const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];

        let found = false;
        for (const ext of possibleExtensions) {
          if (fs.existsSync(resolvedPath + ext)) {
            found = true;
            break;
          }
        }

        if (!found) {
          result.invalidImports.push(importPath);
        }
      }
      // For node_modules imports, we assume they're valid if the package exists
      // This is a simplified check - in practice, you might want to check package.json
    }
  } catch (error) {
    console.warn(`Failed to validate imports for ${filePath}:`, error);
  }

  return result;
}

/**
 * Validates imports for all TypeScript files in a directory
 */
export function validateAllImports(dirPath: string): ImportValidationResult[] {
  const results: ImportValidationResult[] = [];
  const fs = require('node:fs');
  const path = require('node:path');

  function validateRecursive(currentPath: string): void {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(item)) {
          validateRecursive(itemPath);
        } else if (stats.isFile() && /\.(ts|tsx)$/.test(item)) {
          const result = validateImports(itemPath);
          if (result.invalidImports.length > 0) {
            results.push(result);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to validate imports in directory ${currentPath}:`, error);
    }
  }

  validateRecursive(dirPath);
  return results;
}

/**
 * Checks if the project compiles successfully
 */
export function isProjectCompiling(): boolean {
  const result = checkTypeScriptCompilation();
  return result.success && result.errors.length === 0;
}
