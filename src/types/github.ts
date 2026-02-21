/**
 * GitHub API types
 */

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  hunks: Hunk[];
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface PullRequestContext {
  owner: string;
  repo: string;
  number: number;
  baseSha: string;
  headSha: string;
  headRef: string;
}

export interface ImportedFile {
  path: string;
  importedBy: string[];
}
