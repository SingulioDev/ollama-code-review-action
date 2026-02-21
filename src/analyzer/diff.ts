/**
 * Git diff analysis and file change detection
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import type { FileChange, Hunk } from '../types/github.js';

const git: SimpleGit = simpleGit();

/**
 * Get changed files between two commits
 */
export async function getChangedFiles(
  baseSha: string,
  headSha: string
): Promise<FileChange[]> {
  try {
    // Get diff with numstat for file statistics
    const diffSummary = await git.diffSummary([baseSha, headSha]);

    // Get full diff with patches
    const diffText = await git.diff([baseSha, headSha]);

    // Parse diff into structured changes
    const fileChanges: FileChange[] = [];

    for (const file of diffSummary.files) {
      const status = determineStatus(file);

      // Extract patch for this file from full diff
      const patch = extractFilePatch(diffText, file.file);
      const hunks = patch ? parseHunks(patch) : [];

      fileChanges.push({
        path: file.file,
        status,
        additions: file.insertions,
        deletions: file.deletions,
        changes: file.changes,
        patch,
        hunks,
      });
    }

    return fileChanges;
  } catch (error) {
    throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Determine file change status
 */
function determineStatus(file: { file: string; binary: boolean }): FileChange['status'] {
  const path = file.file;

  if (path.includes(' => ')) {
    return 'renamed';
  }

  // Check git diff summary for status indicators
  // This is a simplified version - git diff provides status in --name-status
  return 'modified';
}

/**
 * Extract patch for a specific file from full diff text
 */
function extractFilePatch(diffText: string, filePath: string): string | undefined {
  const lines = diffText.split('\n');
  const patchLines: string[] = [];
  let inFilePatch = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start of file patch: "diff --git a/file b/file"
    if (line.startsWith('diff --git')) {
      if (line.includes(filePath)) {
        inFilePatch = true;
        patchLines.push(line);
      } else {
        inFilePatch = false;
      }
    } else if (inFilePatch) {
      // Next file starts
      if (line.startsWith('diff --git')) {
        break;
      }
      patchLines.push(line);
    }
  }

  return patchLines.length > 0 ? patchLines.join('\n') : undefined;
}

/**
 * Parse unified diff hunks from patch text
 */
function parseHunks(patch: string): Hunk[] {
  const lines = patch.split('\n');
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);

    if (hunkMatch) {
      // Save previous hunk
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      // Start new hunk
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      };
    } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      // Hunk content line
      currentHunk.lines.push(line);
    }
  }

  // Save last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Get file content at specific commit
 */
export async function getFileContent(
  filePath: string,
  commitSha: string
): Promise<string> {
  try {
    const content = await git.show([`${commitSha}:${filePath}`]);
    return content;
  } catch (error) {
    throw new Error(`Failed to get file content: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get current file content from working directory
 */
export async function getCurrentFileContent(filePath: string): Promise<string> {
  try {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
  }
}
