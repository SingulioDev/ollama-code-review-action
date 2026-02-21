/**
 * AST parsing for import detection
 */

import { parse } from '@typescript-eslint/parser';
import type { ImportedFile } from '../types/github.js';
import { getCurrentFileContent } from './diff.js';
import path from 'node:path';

/**
 * Find files imported by changed files
 */
export async function findRelatedImports(
  changedFilePaths: string[]
): Promise<ImportedFile[]> {
  const importMap = new Map<string, Set<string>>();

  for (const filePath of changedFilePaths) {
    // Only analyze JS/TS files
    if (!isJavaScriptOrTypeScript(filePath)) {
      continue;
    }

    try {
      const content = await getCurrentFileContent(filePath);
      const imports = extractImports(content, filePath);

      for (const importPath of imports) {
        if (!importMap.has(importPath)) {
          importMap.set(importPath, new Set());
        }
        importMap.get(importPath)!.add(filePath);
      }
    } catch {
      // Skip files that can't be read or parsed
    }
  }

  // Convert map to array
  const result: ImportedFile[] = [];
  for (const [importPath, importedBy] of importMap.entries()) {
    result.push({
      path: importPath,
      importedBy: Array.from(importedBy),
    });
  }

  return result;
}

/**
 * Extract import paths from file content
 */
function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];

  try {
    // Parse with TypeScript parser
    const ast = parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    });

    // Walk AST to find import declarations
    if (ast.body) {
      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration' && node.source) {
          const importPath = resolveImportPath(
            String(node.source.value),
            filePath
          );
          if (importPath) {
            imports.push(importPath);
          }
        }
      }
    }
  } catch {
    // If parsing fails, try regex fallback
    const regexImports = extractImportsWithRegex(content, filePath);
    imports.push(...regexImports);
  }

  return imports;
}

/**
 * Fallback: Extract imports using regex
 */
function extractImportsWithRegex(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = resolveImportPath(match[1], filePath);
    if (importPath) {
      imports.push(importPath);
    }
  }

  return imports;
}

/**
 * Resolve relative import path to absolute
 */
function resolveImportPath(importPath: string, sourceFile: string): string | null {
  if (!importPath.startsWith('.')) {
    return null;
  }

  const sourceDir = path.dirname(sourceFile);
  let resolved = path.resolve(sourceDir, importPath);

  if (!path.extname(resolved)) {
    return resolved + '.ts';
  }

  return resolved;
}

/**
 * Check if file is JavaScript or TypeScript
 */
function isJavaScriptOrTypeScript(filePath: string): boolean {
  const ext = path.extname(filePath);
  return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
}
