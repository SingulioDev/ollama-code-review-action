/**
 * Parse Ollama responses into structured ReviewIssue objects
 */

import type { ReviewIssue } from '../types/review.js';
import type { ReviewCategory, SeverityLevel } from '../types/config.js';
import { v4 as uuidv4 } from 'uuid';

interface RawIssue {
  category: string;
  severity: string;
  title: string;
  description: string;
  file?: string;
  line: number;
  column?: number;
  suggestion?: string;
  fixable: boolean;
}

/**
 * Parse JSON response from Ollama into ReviewIssue array
 */
export function parseReviewResponse(
  response: string,
  defaultFile: string
): ReviewIssue[] {
  try {
    // Strip markdown code fences if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const rawIssues = JSON.parse(cleaned) as RawIssue[];

    if (!Array.isArray(rawIssues)) {
      throw new Error('Response is not an array');
    }

    return rawIssues.map((raw) =>
      convertRawIssue(raw, defaultFile)
    );
  } catch (error) {
    throw new Error(
      `Failed to parse review response: ${error instanceof Error ? error.message : String(error)}\nResponse: ${response}`
    );
  }
}

/**
 * Convert raw issue object to ReviewIssue
 */
function convertRawIssue(
  raw: RawIssue,
  defaultFile: string
): ReviewIssue {
  return {
    id: uuidv4(),
    category: validateCategory(raw.category),
    severity: validateSeverity(raw.severity),
    title: raw.title || 'Untitled issue',
    description: raw.description || '',
    file: raw.file || defaultFile,
    line: raw.line || 1,
    column: raw.column,
    suggestion: raw.suggestion,
    fixable: raw.fixable !== false, // Default to fixable if not specified
  };
}

/**
 * Validate and normalize category
 */
function validateCategory(category: string): ReviewCategory {
  const normalized = category.toLowerCase();

  const validCategories = [
    'security',
    'quality',
    'performance',
    'tests',
    'documentation',
    'style',
  ];

  if (validCategories.includes(normalized)) {
    return normalized as ReviewCategory;
  }

  // Default to quality if unknown
  return 'quality' as ReviewCategory;
}

/**
 * Validate and normalize severity
 */
function validateSeverity(severity: string): SeverityLevel {
  const normalized = severity.toLowerCase();

  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];

  if (validSeverities.includes(normalized)) {
    return normalized as SeverityLevel;
  }

  // Default to medium if unknown
  return 'medium';
}

/**
 * Parse fix generation response
 */
export interface FixResponse {
  fixedCode: string;
  explanation: string;
}

export function parseFixResponse(response: string): FixResponse {
  try {
    // Strip markdown code fences
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned) as FixResponse;

    if (!parsed.fixedCode) {
      throw new Error('Missing fixedCode in response');
    }

    return {
      fixedCode: parsed.fixedCode,
      explanation: parsed.explanation || 'Auto-generated fix',
    };
  } catch (error) {
    // If JSON parsing fails, try to extract code from response
    const codeMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

    if (codeMatch) {
      return {
        fixedCode: codeMatch[1],
        explanation: 'Auto-generated fix',
      };
    }

    throw new Error(
      `Failed to parse fix response: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Group issues by file
 */
export function groupIssuesByFile(
  issues: ReviewIssue[]
): Map<string, ReviewIssue[]> {
  const groups = new Map<string, ReviewIssue[]>();

  for (const issue of issues) {
    if (!groups.has(issue.file)) {
      groups.set(issue.file, []);
    }
    groups.get(issue.file)!.push(issue);
  }

  return groups;
}

/**
 * Group issues by severity
 */
export function groupIssuesBySeverity(
  issues: ReviewIssue[]
): Map<SeverityLevel, ReviewIssue[]> {
  const groups = new Map<SeverityLevel, ReviewIssue[]>();

  const severities: SeverityLevel[] = [
    'critical',
    'high',
    'medium',
    'low',
    'info',
  ];

  for (const severity of severities) {
    groups.set(severity, []);
  }

  for (const issue of issues) {
    groups.get(issue.severity)!.push(issue);
  }

  return groups;
}

/**
 * Filter issues by severity threshold
 */
export function filterBySeverity(
  issues: ReviewIssue[],
  minSeverity: SeverityLevel
): ReviewIssue[] {
  const severityOrder: Record<SeverityLevel, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  const threshold = severityOrder[minSeverity];

  return issues.filter(
    (issue) => severityOrder[issue.severity] >= threshold
  );
}
