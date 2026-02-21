/**
 * Format review results as markdown
 */

import type { ReviewIssue } from '../types/review.js';
import type { ReviewStats } from '../reviewer/engine.js';
import { groupIssuesBySeverity, groupIssuesByFile } from '../reviewer/parser.js';

/**
 * Format a full review summary for PR comment
 */
export function formatReviewSummary(
  issues: ReviewIssue[],
  stats: ReviewStats,
  fixesApplied?: number
): string {
  const sections: string[] = [];

  // Header
  sections.push('## 🤖 Code Review Summary\n');

  // Stats overview
  sections.push(formatStatsOverview(stats, fixesApplied));

  // Issues by severity
  if (issues.length > 0) {
    sections.push(formatIssuesBySeverity(issues));
  } else {
    sections.push('✅ **No issues found!** Great work!\n');
  }

  // Footer
  sections.push(formatFooter(fixesApplied));

  return sections.join('\n');
}

/**
 * Format stats overview section
 */
function formatStatsOverview(stats: ReviewStats, fixesApplied?: number): string {
  const lines: string[] = ['### 📊 Overview\n'];

  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Files Reviewed | ${stats.filesReviewed} |`);
  lines.push(`| Total Issues | ${stats.total} |`);

  if (stats.critical > 0) {
    lines.push(`| 🔴 Critical | ${stats.critical} |`);
  }
  if (stats.high > 0) {
    lines.push(`| 🟠 High | ${stats.high} |`);
  }
  if (stats.medium > 0) {
    lines.push(`| 🟡 Medium | ${stats.medium} |`);
  }
  if (stats.low > 0) {
    lines.push(`| 🔵 Low | ${stats.low} |`);
  }
  if (stats.info > 0) {
    lines.push(`| ℹ️ Info | ${stats.info} |`);
  }

  if (fixesApplied !== undefined && fixesApplied > 0) {
    lines.push(`| ✅ Auto-Fixed | ${fixesApplied} |`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format issues grouped by severity
 */
function formatIssuesBySeverity(issues: ReviewIssue[]): string {
  const bySeverity = groupIssuesBySeverity(issues);
  const sections: string[] = [];

  // Critical
  if (bySeverity.get('critical')!.length > 0) {
    sections.push('### 🔴 Critical Issues\n');
    sections.push(formatIssueList(bySeverity.get('critical')!));
  }

  // High
  if (bySeverity.get('high')!.length > 0) {
    sections.push('### 🟠 High Priority\n');
    sections.push(formatIssueList(bySeverity.get('high')!));
  }

  // Medium
  if (bySeverity.get('medium')!.length > 0) {
    sections.push('### 🟡 Medium Priority\n');
    sections.push(formatIssueList(bySeverity.get('medium')!));
  }

  // Low
  if (bySeverity.get('low')!.length > 0) {
    sections.push('<details>\n<summary>🔵 Low Priority Issues</summary>\n');
    sections.push(formatIssueList(bySeverity.get('low')!));
    sections.push('</details>\n');
  }

  // Info
  if (bySeverity.get('info')!.length > 0) {
    sections.push('<details>\n<summary>ℹ️ Informational</summary>\n');
    sections.push(formatIssueList(bySeverity.get('info')!));
    sections.push('</details>\n');
  }

  return sections.join('\n');
}

/**
 * Format a list of issues
 */
function formatIssueList(issues: ReviewIssue[]): string {
  return issues
    .map((issue, idx) => {
      const lines: string[] = [];

      // Issue header with title
      lines.push(`**${idx + 1}. ${issue.title}**`);

      // Category badge
      const categoryBadge = getCategoryEmoji(issue.category);
      lines.push(`${categoryBadge} ${issue.category}`);

      // File and line
      lines.push(`📄 \`${issue.file}:${issue.line}\``);

      // Description
      if (issue.description) {
        lines.push(`\n${issue.description}`);
      }

      // Suggestion
      if (issue.suggestion) {
        lines.push(`\n💡 **Suggestion:** ${issue.suggestion}`);
      }

      // Fixable indicator
      if (issue.fixable) {
        lines.push('\n✅ *Auto-fixable*');
      }

      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

/**
 * Format line comment for GitHub review
 */
export function formatLineComment(issue: ReviewIssue): string {
  const lines: string[] = [];

  // Emoji + severity
  const severityEmoji = getSeverityEmoji(issue.severity);
  lines.push(`${severityEmoji} **${issue.title}**`);

  // Description
  if (issue.description) {
    lines.push(`\n${issue.description}`);
  }

  // Suggestion
  if (issue.suggestion) {
    lines.push(`\n💡 **Suggestion:**\n${issue.suggestion}`);
  }

  // Category
  const categoryEmoji = getCategoryEmoji(issue.category);
  lines.push(`\n${categoryEmoji} *Category: ${issue.category}*`);

  return lines.join('\n');
}

/**
 * Format footer with metadata
 */
function formatFooter(fixesApplied?: number): string {
  const lines: string[] = [];

  if (fixesApplied !== undefined && fixesApplied > 0) {
    lines.push(
      `\n---\n\n✨ **${fixesApplied} issues were automatically fixed and committed to this PR.**\n`
    );
  }

  lines.push('---');
  lines.push('*🤖 Powered by [Ollama](https://ollama.ai) Kimi 2.5 via GitHub Actions*');

  return lines.join('\n');
}

/**
 * Format check annotation message
 */
export function formatCheckAnnotation(issue: ReviewIssue): string {
  const parts: string[] = [];

  parts.push(`[${issue.severity.toUpperCase()}] ${issue.title}`);

  if (issue.description) {
    parts.push(issue.description);
  }

  if (issue.suggestion) {
    parts.push(`Suggestion: ${issue.suggestion}`);
  }

  return parts.join('\n\n');
}

/**
 * Get emoji for severity level
 */
function getSeverityEmoji(severity: string): string {
  const emojis: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: 'ℹ️',
  };

  return emojis[severity] || '⚪';
}

/**
 * Get emoji for category
 */
function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    security: '🔒',
    quality: '⭐',
    performance: '⚡',
    tests: '🧪',
    documentation: '📚',
    style: '🎨',
  };

  return emojis[category] || '📋';
}

/**
 * Format a table of files with issue counts
 */
export function formatFilesSummary(issues: ReviewIssue[]): string {
  const byFile = groupIssuesByFile(issues);

  if (byFile.size === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('### 📁 Issues by File\n');
  lines.push('| File | Issues |');
  lines.push('|------|--------|');

  for (const [file, fileIssues] of byFile.entries()) {
    const count = fileIssues.length;
    const criticalCount = fileIssues.filter((i) => i.severity === 'critical')
      .length;

    let display = `\`${file}\``;
    if (criticalCount > 0) {
      display += ` 🔴`;
    }

    lines.push(`| ${display} | ${count} |`);
  }

  lines.push('');

  return lines.join('\n');
}
