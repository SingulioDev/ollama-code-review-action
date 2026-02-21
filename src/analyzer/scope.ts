/**
 * Scope resolution for determining which files to review
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { FileChange, ImportedFile } from '../types/github.js';
import type { ScopeMode } from '../types/config.js';
import { findRelatedImports } from './ast.js';

/**
 * Resolve which files should be reviewed based on scope configuration
 */
export async function resolveScope(
  mode: ScopeMode,
  changedFiles: FileChange[],
  excludePatterns: string[]
): Promise<string[]> {
  let filesToReview: string[] = [];

  switch (mode) {
    case 'changed-only':
      filesToReview = changedFiles.map((f) => f.path);
      break;

    case 'changed-imports':
      const changedPaths = changedFiles.map((f) => f.path);
      const imports = await findRelatedImports(changedPaths);

      // Combine changed files + imported files
      const importedPaths = imports.map((i) => i.path);
      filesToReview = [...new Set([...changedPaths, ...importedPaths])];
      break;

    case 'full-codebase':
      filesToReview = await getAllSourceFiles();
      break;
  }

  // Apply exclusion patterns
  return filterExcluded(filesToReview, excludePatterns);
}

/**
 * Get all source files in the repository
 */
async function getAllSourceFiles(): Promise<string[]> {
  const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  const excludeDirs = ['node_modules', 'dist', 'build', '.next', 'coverage'];

  async function scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip excluded directories
        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            const subFiles = await scanDirectory(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (sourceExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore directories we can't read
    }

    return files;
  }

  return scanDirectory('.');
}

/**
 * Filter out files matching exclusion patterns
 */
function filterExcluded(files: string[], patterns: string[]): string[] {
  if (patterns.length === 0) {
    return files;
  }

  return files.filter((file) => {
    // Check if file matches any exclusion pattern
    return !patterns.some((pattern) => {
      // Convert glob pattern to regex
      const regex = globToRegex(pattern);
      return regex.test(file);
    });
  });
}

/**
 * Convert glob pattern to regular expression
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except glob wildcards
  let regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  // Handle ** for directory matching
  regexPattern = regexPattern.replace(/\.\*\.\*/g, '.*');

  return new RegExp(`^${regexPattern}$`);
}

/**
 * Check if a file should be reviewed based on type
 */
export function isReviewableFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const reviewableExtensions = [
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'rb', 'go', 'rs', 'java', 'kt',
    'c', 'cpp', 'h', 'hpp', 'cs',
    'php', 'swift', 'scala', 'sh'
  ];

  return ext ? reviewableExtensions.includes(ext) : false;
}

/**
 * Group files by language for language-specific review
 */
export function groupFilesByLanguage(files: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const ext = file.split('.').pop()?.toLowerCase() || 'unknown';

    if (!groups.has(ext)) {
      groups.set(ext, []);
    }

    groups.get(ext)!.push(file);
  }

  return groups;
}
