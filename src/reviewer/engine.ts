/**
 * Main review engine - orchestrates code review process
 */

import { OllamaClient } from '../ollama/client.js';
import type { ReviewConfig, ReviewCategory } from '../types/config.js';
import type { ReviewIssue } from '../types/review.js';
import type { FileChange } from '../types/github.js';
import { resolveScope, isReviewableFile } from '../analyzer/scope.js';
import { getCurrentFileContent } from '../analyzer/diff.js';
import {
  buildReviewPrompt,
  buildBatchReviewPrompt,
  SYSTEM_PROMPT,
} from './prompts.js';
import {
  parseReviewResponse,
  groupIssuesByFile,
  groupIssuesBySeverity,
} from './parser.js';

export class ReviewEngine {
  private client: OllamaClient;
  private config: ReviewConfig;

  constructor(config: ReviewConfig) {
    this.config = config;
    this.client = new OllamaClient(config.ollama);
  }

  /**
   * Review changed files in a pull request
   */
  async reviewPullRequest(
    changedFiles: FileChange[]
  ): Promise<ReviewIssue[]> {
    // Resolve which files to review based on scope
    const filePaths = await resolveScope(
      this.config.scope,
      changedFiles,
      this.config.exclude
    );

    // Filter to only reviewable files
    const reviewableFiles = filePaths.filter(isReviewableFile);

    if (reviewableFiles.length === 0) {
      return [];
    }

    // Get active review categories
    const activeCategories = this.getActiveCategories();

    if (activeCategories.length === 0) {
      return [];
    }

    // Batch files based on config
    const batches = this.createBatches(reviewableFiles);

    // Review batches in parallel
    const allIssues: ReviewIssue[] = [];

    for (const batch of batches) {
      const batchIssues = await this.reviewBatch(batch, activeCategories);
      allIssues.push(...batchIssues);
    }

    return allIssues;
  }

  /**
   * Review a batch of files
   */
  private async reviewBatch(
    filePaths: string[],
    categories: ReviewCategory[]
  ): Promise<ReviewIssue[]> {
    if (filePaths.length === 1) {
      return this.reviewSingleFile(filePaths[0], categories);
    }

    // Batch review multiple files
    const files = await Promise.all(
      filePaths.map(async (path) => ({
        path,
        content: await getCurrentFileContent(path),
      }))
    );

    const prompt = buildBatchReviewPrompt(categories, files);

    try {
      const response = await this.client.prompt(SYSTEM_PROMPT, prompt);
      return parseReviewResponse(response, files[0].path);
    } catch (error) {
      console.error(`Batch review failed:`, error);
      return [];
    }
  }

  /**
   * Review a single file
   */
  private async reviewSingleFile(
    filePath: string,
    categories: ReviewCategory[]
  ): Promise<ReviewIssue[]> {
    try {
      const content = await getCurrentFileContent(filePath);
      const prompt = buildReviewPrompt(categories, content, filePath);

      const response = await this.client.prompt(SYSTEM_PROMPT, prompt);
      return parseReviewResponse(response, filePath);
    } catch (error) {
      console.error(`Review failed for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Create batches of files based on batch size config
   */
  private createBatches(files: string[]): string[][] {
    const batchSize = this.config.batch?.files_per_request || 5;
    const batches: string[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Get active review categories from config
   */
  private getActiveCategories(): ReviewCategory[] {
    const categories: ReviewCategory[] = [];

    for (const [category, enabled] of Object.entries(this.config.categories)) {
      if (enabled) {
        categories.push(category as ReviewCategory);
      }
    }

    return categories;
  }

  /**
   * Filter issues based on severity rules
   */
  filterBySeverityRules(issues: ReviewIssue[]): ReviewIssue[] {
    return issues.filter((issue) => {
      const action = this.config.severity_rules[issue.severity];
      return action !== 'ignore';
    });
  }

  /**
   * Check if any issues should block merge
   */
  shouldBlockMerge(issues: ReviewIssue[]): boolean {
    return issues.some((issue) => {
      const action = this.config.severity_rules[issue.severity];
      return action === 'block';
    });
  }

  /**
   * Generate summary statistics
   */
  generateStats(issues: ReviewIssue[]): ReviewStats {
    const bySeverity = groupIssuesBySeverity(issues);
    const byFile = groupIssuesByFile(issues);

    return {
      total: issues.length,
      critical: bySeverity.get('critical')?.length || 0,
      high: bySeverity.get('high')?.length || 0,
      medium: bySeverity.get('medium')?.length || 0,
      low: bySeverity.get('low')?.length || 0,
      info: bySeverity.get('info')?.length || 0,
      filesReviewed: byFile.size,
      fixable: issues.filter((i) => i.fixable).length,
    };
  }

  /**
   * Get Ollama client for direct access
   */
  getClient(): OllamaClient {
    return this.client;
  }
}

export interface ReviewStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  filesReviewed: number;
  fixable: number;
}
