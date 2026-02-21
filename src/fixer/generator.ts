/**
 * Auto-fix generation logic
 */

import { OllamaClient } from '../ollama/client.js';
import type { ReviewIssue, Fix } from '../types/review.js';
import type { AutoFixConfig } from '../types/config.js';
import { getCurrentFileContent } from '../analyzer/diff.js';
import {
  FIX_GENERATION_PROMPT,
  buildFixPrompt,
} from '../reviewer/prompts.js';
import { parseFixResponse } from '../reviewer/parser.js';

export class FixGenerator {
  private client: OllamaClient;
  private config: AutoFixConfig;

  constructor(client: OllamaClient, config: AutoFixConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Generate fixes for a list of issues
   */
  async generateFixes(issues: ReviewIssue[]): Promise<Fix[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Filter to fixable issues in allowed categories
    const fixableIssues = issues.filter((issue) =>
      this.canAutoFix(issue)
    );

    if (fixableIssues.length === 0) {
      return [];
    }

    const fixes: Fix[] = [];

    for (const issue of fixableIssues) {
      try {
        const fix = await this.generateFix(issue);
        if (fix) {
          fixes.push(fix);
        }
      } catch (error) {
        console.error(
          `Failed to generate fix for issue ${issue.id}:`,
          error
        );
      }
    }

    return fixes;
  }

  /**
   * Generate a fix for a single issue
   */
  async generateFix(issue: ReviewIssue): Promise<Fix | null> {
    try {
      // Read the current file content
      const fileContent = await getCurrentFileContent(issue.file);

      // Build the fix prompt
      const prompt = buildFixPrompt(
        issue.description,
        fileContent,
        issue.file,
        issue.line
      );

      // Request fix from Ollama
      const response = await this.client.prompt(
        FIX_GENERATION_PROMPT,
        prompt
      );

      // Parse the response
      const parsed = parseFixResponse(response);

      // Extract the affected code section
      const lines = fileContent.split('\n');
      const lineStart = Math.max(0, issue.line - 1);
      const lineEnd = Math.min(lines.length, lineStart + this.estimateAffectedLines(issue));

      const originalCode = lines.slice(lineStart, lineEnd).join('\n');

      return {
        issueId: issue.id,
        file: issue.file,
        originalCode,
        fixedCode: parsed.fixedCode,
        explanation: parsed.explanation,
        lineStart: lineStart + 1,
        lineEnd: lineEnd + 1,
      };
    } catch (error) {
      console.error(`Fix generation failed for ${issue.file}:`, error);
      return null;
    }
  }

  /**
   * Check if an issue can be auto-fixed
   */
  private canAutoFix(issue: ReviewIssue): boolean {
    if (!issue.fixable) {
      return false;
    }

    if (!this.config.enabled) {
      return false;
    }

    // Check if category is in allowed list
    return this.config.categories.includes(issue.category);
  }

  /**
   * Estimate how many lines are affected by an issue
   */
  private estimateAffectedLines(issue: ReviewIssue): number {
    // For style issues, usually 1-3 lines
    if (issue.category === 'style') {
      return 3;
    }

    // For documentation, could be more lines
    if (issue.category === 'documentation') {
      return 5;
    }

    // For other issues, be conservative
    return 10;
  }

  /**
   * Validate a generated fix
   */
  async validateFix(fix: Fix): Promise<boolean> {
    // Basic validation - ensure fix is not empty
    if (!fix.fixedCode || fix.fixedCode.trim() === '') {
      return false;
    }

    // Ensure fix is different from original
    if (fix.fixedCode === fix.originalCode) {
      return false;
    }

    // TODO: Could add more validation:
    // - Syntax validation
    // - Linting checks
    // - Test runs

    return true;
  }

  /**
   * Group fixes by file
   */
  groupFixesByFile(fixes: Fix[]): Map<string, Fix[]> {
    const groups = new Map<string, Fix[]>();

    for (const fix of fixes) {
      if (!groups.has(fix.file)) {
        groups.set(fix.file, []);
      }
      groups.get(fix.file)!.push(fix);
    }

    return groups;
  }

  /**
   * Sort fixes by line number (highest to lowest)
   * This allows applying fixes from bottom to top without affecting line numbers
   */
  sortFixesByLine(fixes: Fix[]): Fix[] {
    return [...fixes].sort((a, b) => b.lineStart - a.lineStart);
  }
}
