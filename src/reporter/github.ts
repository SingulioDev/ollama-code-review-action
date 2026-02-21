/**
 * GitHub API integration for PR comments, reviews, and checks
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { ReviewIssue } from '../types/review.js';
import type { ReviewStats } from '../reviewer/engine.js';
import type { PullRequestContext } from '../types/github.js';
import {
  formatReviewSummary,
  formatLineComment,
  formatCheckAnnotation,
  formatFilesSummary,
} from './formatter.js';

export class GitHubReporter {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: PullRequestContext;

  constructor(token: string, context: PullRequestContext) {
    this.octokit = github.getOctokit(token);
    this.context = context;
  }

  /**
   * Report review results to GitHub
   */
  async reportReview(
    issues: ReviewIssue[],
    stats: ReviewStats,
    fixesApplied?: number
  ): Promise<void> {
    await Promise.all([
      this.createPRComment(issues, stats, fixesApplied),
      this.createPRReview(issues),
      this.createCheckRun(issues, stats),
    ]);
  }

  /**
   * Create a PR comment with review summary
   */
  async createPRComment(
    issues: ReviewIssue[],
    stats: ReviewStats,
    fixesApplied?: number
  ): Promise<void> {
    try {
      const body =
        formatReviewSummary(issues, stats, fixesApplied) +
        '\n\n' +
        formatFilesSummary(issues);

      await this.octokit.rest.issues.createComment({
        ...this.context,
        issue_number: this.context.number,
        body,
      });

      core.info('Created PR comment with review summary');
    } catch (error) {
      core.warning(`Failed to create PR comment: ${error}`);
    }
  }

  /**
   * Create a PR review with line comments
   */
  async createPRReview(issues: ReviewIssue[]): Promise<void> {
    if (issues.length === 0) {
      return;
    }

    try {
      // Group issues by file for better organization
      const comments = this.buildReviewComments(issues);

      // Create review with line comments
      await this.octokit.rest.pulls.createReview({
        ...this.context,
        pull_number: this.context.number,
        event: 'COMMENT',
        comments,
      });

      core.info(`Created PR review with ${comments.length} line comments`);
    } catch (error) {
      core.warning(`Failed to create PR review: ${error}`);
    }
  }

  /**
   * Create a GitHub Check Run with annotations
   */
  async createCheckRun(
    issues: ReviewIssue[],
    stats: ReviewStats
  ): Promise<void> {
    try {
      const annotations = this.buildAnnotations(issues);

      const conclusion = this.determineConclusion(issues);
      const summary = this.buildCheckSummary(stats);

      await this.octokit.rest.checks.create({
        ...this.context,
        name: 'Ollama Code Review',
        head_sha: this.context.headSha,
        status: 'completed',
        conclusion,
        output: {
          title: `Found ${stats.total} issue${stats.total !== 1 ? 's' : ''}`,
          summary,
          annotations: annotations.slice(0, 50), // GitHub limits to 50 annotations per request
        },
      });

      core.info('Created check run with annotations');
    } catch (error) {
      core.warning(`Failed to create check run: ${error}`);
    }
  }

  /**
   * Build review comments from issues
   */
  private buildReviewComments(
    issues: ReviewIssue[]
  ): Array<{
    path: string;
    line: number;
    side: string;
    body: string;
  }> {
    return issues.map((issue) => ({
      path: issue.file,
      line: issue.line,
      side: 'RIGHT',
      body: formatLineComment(issue),
    }));
  }

  /**
   * Build check annotations from issues
   */
  private buildAnnotations(
    issues: ReviewIssue[]
  ): Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'notice' | 'warning' | 'failure';
    message: string;
  }> {
    return issues.map((issue) => ({
      path: issue.file,
      start_line: issue.line,
      end_line: issue.line,
      annotation_level: this.mapSeverityToLevel(issue.severity),
      message: formatCheckAnnotation(issue),
    }));
  }

  /**
   * Map severity to GitHub annotation level
   */
  private mapSeverityToLevel(
    severity: string
  ): 'notice' | 'warning' | 'failure' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'failure';
      case 'medium':
        return 'warning';
      default:
        return 'notice';
    }
  }

  /**
   * Determine check run conclusion
   */
  private determineConclusion(
    issues: ReviewIssue[]
  ): 'success' | 'neutral' | 'failure' {
    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasHigh = issues.some((i) => i.severity === 'high');

    if (hasCritical) {
      return 'failure';
    }

    if (hasHigh) {
      return 'neutral';
    }

    return 'success';
  }

  /**
   * Build check summary
   */
  private buildCheckSummary(stats: ReviewStats): string {
    const lines: string[] = [];

    lines.push('## Review Statistics\n');
    lines.push(`- **Files Reviewed:** ${stats.filesReviewed}`);
    lines.push(`- **Total Issues:** ${stats.total}`);

    if (stats.critical > 0) {
      lines.push(`- **🔴 Critical:** ${stats.critical}`);
    }
    if (stats.high > 0) {
      lines.push(`- **🟠 High:** ${stats.high}`);
    }
    if (stats.medium > 0) {
      lines.push(`- **🟡 Medium:** ${stats.medium}`);
    }
    if (stats.low > 0) {
      lines.push(`- **🔵 Low:** ${stats.low}`);
    }
    if (stats.info > 0) {
      lines.push(`- **ℹ️ Info:** ${stats.info}`);
    }

    lines.push(`\n**Fixable Issues:** ${stats.fixable}`);

    return lines.join('\n');
  }

  /**
   * Update existing comment instead of creating new one
   */
  async updateOrCreateComment(
    issues: ReviewIssue[],
    stats: ReviewStats,
    fixesApplied?: number
  ): Promise<void> {
    try {
      // Find existing bot comment
      const { data: comments } = await this.octokit.rest.issues.listComments({
        ...this.context,
        issue_number: this.context.number,
      });

      const botComment = comments.find((comment) =>
        comment.body?.includes('🤖 Code Review Summary')
      );

      const body =
        formatReviewSummary(issues, stats, fixesApplied) +
        '\n\n' +
        formatFilesSummary(issues);

      if (botComment) {
        // Update existing comment
        await this.octokit.rest.issues.updateComment({
          ...this.context,
          comment_id: botComment.id,
          body,
        });
        core.info('Updated existing PR comment');
      } else {
        // Create new comment
        await this.octokit.rest.issues.createComment({
          ...this.context,
          issue_number: this.context.number,
          body,
        });
        core.info('Created new PR comment');
      }
    } catch (error) {
      core.warning(`Failed to update/create comment: ${error}`);
    }
  }
}
