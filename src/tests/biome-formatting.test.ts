/**
 * Property-based tests for Biome formatting functionality
 * Feature: biome-setup, Property 1: Formatting preserves code functionality
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fc from 'fast-check';

describe('Biome Formatting Properties', () => {
  const tempDir = join(process.cwd(), 'temp-test-files');

  beforeAll(() => {
    // Ensure temp directory exists
    if (!existsSync(tempDir)) {
      execSync(`mkdir -p ${tempDir}`);
    }
  });

  afterAll(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
  });

  /**
   * Feature: biome-setup, Property 1: Formatting preserves code functionality
   * Validates: Requirements 2.2
   */
  test('Property 1: Formatting preserves code functionality', () => {
    fc.assert(
      fc.property(
        // Generate simple, valid JavaScript code patterns
        fc.record({
          variables: fc.array(
            fc.oneof(
              fc.constant('const x = 1'),
              fc.constant("let y = 'hello'"),
              fc.constant('const arr = [1, 2, 3]'),
              fc.constant('const obj = { a: 1, b: 2 }')
            ),
            { minLength: 1, maxLength: 3 }
          ),

          functions: fc.array(
            fc.oneof(
              fc.constant('function test() { return 42 }'),
              fc.constant("const arrow = () => 'test'"),
              fc.constant('function add(a, b) { return a + b }')
            ),
            { minLength: 0, maxLength: 2 }
          ),
        }),
        (codeStructure) => {
          // Generate the original code with proper semicolons
          const originalCode = [
            ...codeStructure.variables.map((v) => `${v};`),
            '',
            ...codeStructure.functions.map((f) => f + (f.includes('=>') ? ';' : '')),
          ].join('\n');

          // Skip empty or trivial cases
          if (originalCode.trim().length < 10) {
            return true;
          }

          const testFileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.js`;
          const testFilePath = join(tempDir, testFileName);

          try {
            // Write original code to temp file
            writeFileSync(testFilePath, originalCode);

            // Format the code using Biome
            execSync(`npx biome format --write ${testFilePath}`, {
              cwd: process.cwd(),
              stdio: 'pipe',
            });

            // Read the formatted code
            const formattedCode = readFileSync(testFilePath, 'utf8');

            // Basic syntax preservation checks
            const originalLines = originalCode.split('\n').filter((line) => line.trim());
            const formattedLines = formattedCode.split('\n').filter((line) => line.trim());

            // Check that essential code elements are preserved
            const hasVariables = originalLines.some(
              (line) => line.includes('const') || line.includes('let') || line.includes('var')
            );
            const hasFunctions = originalLines.some(
              (line) => line.includes('function') || line.includes('=>')
            );

            if (hasVariables) {
              expect(
                formattedLines.some(
                  (line) => line.includes('const') || line.includes('let') || line.includes('var')
                )
              ).toBe(true);
            }
            if (hasFunctions) {
              expect(
                formattedLines.some((line) => line.includes('function') || line.includes('=>'))
              ).toBe(true);
            }

            // Check that formatting doesn't break basic syntax
            // Count braces, brackets, and parentheses
            const countChars = (str: string, char: string) =>
              (str.match(new RegExp(`\\${char}`, 'g')) || []).length;

            const originalBraces = countChars(originalCode, '{') - countChars(originalCode, '}');
            const formattedBraces = countChars(formattedCode, '{') - countChars(formattedCode, '}');

            const originalBrackets = countChars(originalCode, '[') - countChars(originalCode, ']');
            const formattedBrackets =
              countChars(formattedCode, '[') - countChars(formattedCode, ']');

            const originalParens = countChars(originalCode, '(') - countChars(originalCode, ')');
            const formattedParens = countChars(formattedCode, '(') - countChars(formattedCode, ')');

            // Balanced braces, brackets, and parentheses should remain balanced
            expect(originalBraces).toBe(formattedBraces);
            expect(originalBrackets).toBe(formattedBrackets);
            expect(originalParens).toBe(formattedParens);

            return true;
          } catch (error) {
            console.error('Error in formatting test:', error);
            return false;
          } finally {
            // Clean up temp file
            if (existsSync(testFilePath)) {
              unlinkSync(testFilePath);
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  /**
   * Feature: biome-setup, Property 2: JSX formatting correctness
   * Validates: Requirements 2.3
   */
  test('Property 2: JSX formatting correctness', () => {
    fc.assert(
      fc.property(
        // Generate valid JSX code patterns
        fc.record({
          imports: fc.array(
            fc.oneof(
              fc.constant("import React from 'react'"),
              fc.constant("import { useState } from 'react'")
            ),
            { minLength: 1, maxLength: 2 }
          ),

          components: fc.array(
            fc.oneof(
              fc.constant('function Button() { return <button>Click me</button> }'),
              fc.constant("const Card = () => <div className='card'><h2>Title</h2></div>"),
              fc.constant(
                'function App() { return <div><h1>Hello World</h1><p>Welcome</p></div> }'
              ),
              fc.constant(
                'const List = ({ items }) => <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>'
              )
            ),
            { minLength: 1, maxLength: 2 }
          ),

          exports: fc.array(
            fc.oneof(fc.constant('export default Button'), fc.constant('export { Card }')),
            { minLength: 0, maxLength: 1 }
          ),
        }),
        (codeStructure) => {
          // Generate the original JSX code
          const originalCode = [
            ...codeStructure.imports.map((i) => `${i};`),
            '',
            ...codeStructure.components.map((c) => c + (c.includes('=>') ? ';' : '')),
            '',
            ...codeStructure.exports.map((e) => `${e};`),
          ].join('\n');

          // Skip empty or trivial cases
          if (originalCode.trim().length < 20) {
            return true;
          }

          const testFileName = `jsx-test-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}.jsx`;
          const testFilePath = join(tempDir, testFileName);

          try {
            // Write original JSX code to temp file
            writeFileSync(testFilePath, originalCode);

            // Format the JSX code using Biome
            execSync(`npx biome format --write ${testFilePath}`, {
              cwd: process.cwd(),
              stdio: 'pipe',
            });

            // Read the formatted code
            const formattedCode = readFileSync(testFilePath, 'utf8');

            // JSX-specific preservation checks
            const originalLines = originalCode.split('\n').filter((line) => line.trim());
            const formattedLines = formattedCode.split('\n').filter((line) => line.trim());

            // Check that JSX elements are preserved
            const hasJSXElements = originalLines.some(
              (line) => line.includes('<') && line.includes('>')
            );
            const hasReactImport = originalLines.some(
              (line) => line.includes('import') && line.includes('react')
            );

            if (hasJSXElements) {
              expect(formattedLines.some((line) => line.includes('<') && line.includes('>'))).toBe(
                true
              );
            }
            if (hasReactImport) {
              expect(
                formattedLines.some((line) => line.includes('import') && line.includes('react'))
              ).toBe(true);
            }

            // Check JSX tag balance
            const countJSXTags = (str: string) => {
              const openTags = (str.match(/<[^/][^>]*>/g) || []).length;
              const closeTags = (str.match(/<\/[^>]*>/g) || []).length;
              const selfClosing = (str.match(/<[^>]*\/>/g) || []).length;
              return { openTags, closeTags, selfClosing };
            };

            const originalTags = countJSXTags(originalCode);
            const formattedTags = countJSXTags(formattedCode);

            // JSX tag structure should be preserved
            expect(originalTags.openTags).toBe(formattedTags.openTags);
            expect(originalTags.closeTags).toBe(formattedTags.closeTags);
            expect(originalTags.selfClosing).toBe(formattedTags.selfClosing);

            // Check that braces are balanced
            const countChars = (str: string, char: string) =>
              (str.match(new RegExp(`\\${char}`, 'g')) || []).length;

            const originalBraces = countChars(originalCode, '{') - countChars(originalCode, '}');
            const formattedBraces = countChars(formattedCode, '{') - countChars(formattedCode, '}');

            expect(originalBraces).toBe(formattedBraces);

            return true;
          } catch (error) {
            console.error('Error in JSX formatting test:', error);
            return false;
          } finally {
            // Clean up temp file
            if (existsSync(testFilePath)) {
              unlinkSync(testFilePath);
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });
});
