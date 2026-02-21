/**
 * Review result types
 */

import type { ReviewCategory, SeverityLevel } from './config.js';

export interface ReviewIssue {
  id: string;
  category: ReviewCategory;
  severity: SeverityLevel;
  title: string;
  description: string;
  file: string;
  line: number;
  column?: number;
  suggestion?: string;
  fixable: boolean;
}

export interface Fix {
  issueId: string;
  file: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  lineStart: number;
  lineEnd: number;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  fixes: Fix[];
  totalFiles: number;
  filesReviewed: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}
