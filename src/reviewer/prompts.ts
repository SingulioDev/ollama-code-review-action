/**
 * Review prompt templates for different categories
 */

import { ReviewCategory } from '../types/config.js';

export const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze code for issues and suggest improvements.

Your review should be:
- Specific and actionable
- Focused on real problems, not nitpicks
- Constructive and educational
- Prioritized by severity

Return your findings as a JSON array of issues with this structure:
[
  {
    "category": "security|quality|performance|tests|documentation|style",
    "severity": "critical|high|medium|low|info",
    "title": "Brief issue title",
    "description": "Detailed explanation of the issue",
    "line": line_number,
    "column": column_number (optional),
    "suggestion": "How to fix it",
    "fixable": true|false
  }
]

If no issues found, return an empty array: []`;

export const CATEGORY_PROMPTS: Record<ReviewCategory, string> = {
  [ReviewCategory.Security]: `Focus on security vulnerabilities:
- SQL injection, XSS, CSRF, command injection
- Hardcoded secrets, credentials, API keys
- Insecure cryptography, weak hashing
- Authentication/authorization flaws
- Input validation issues
- Path traversal, file upload vulnerabilities
- OWASP Top 10 vulnerabilities
- Security headers, CORS misconfigurations
- Sensitive data exposure`,

  [ReviewCategory.Quality]: `Focus on code quality issues:
- Code smells and anti-patterns
- Duplication and redundancy
- Complex logic that could be simplified
- Missing error handling
- Poor variable/function naming
- Violation of SOLID principles
- Coupling and cohesion issues
- Missing edge case handling
- Code maintainability concerns`,

  [ReviewCategory.Performance]: `Focus on performance issues:
- Inefficient algorithms (N+1 queries, nested loops)
- Memory leaks, excessive memory usage
- Blocking operations in async code
- Missing caching opportunities
- Inefficient data structures
- Resource cleanup issues
- Database query optimization
- Bundle size and lazy loading
- Unnecessary re-renders (React/Vue)`,

  [ReviewCategory.Tests]: `Focus on testing quality:
- Missing test coverage for critical paths
- Flaky or brittle tests
- Test readability and maintainability
- Missing edge cases in tests
- Over-mocking reducing test value
- Missing integration/e2e tests
- Test setup/teardown issues
- Assertion quality and completeness
- Test isolation problems`,

  [ReviewCategory.Documentation]: `Focus on documentation:
- Missing or outdated docstrings/JSDoc
- Unclear function/class descriptions
- Missing parameter/return value docs
- Complex logic without comments
- API documentation gaps
- Missing usage examples
- Outdated README or guides
- Missing type annotations
- Unclear error messages`,

  [ReviewCategory.Style]: `Focus on code style:
- Inconsistent formatting
- Naming convention violations
- Import organization
- File structure issues
- Line length violations
- Inconsistent patterns
- Missing type definitions
- Linting rule violations
- Inconsistent quotes/semicolons`,
};

export function buildReviewPrompt(
  categories: ReviewCategory[],
  fileContent: string,
  filePath: string
): string {
  const activeCategories = categories
    .map((cat) => CATEGORY_PROMPTS[cat])
    .join('\n\n');

  return `Review the following code file and identify issues in these categories:

${activeCategories}

File: ${filePath}

\`\`\`
${fileContent}
\`\`\`

Return your findings as a JSON array.`;
}

export function buildBatchReviewPrompt(
  categories: ReviewCategory[],
  files: Array<{ path: string; content: string }>
): string {
  const activeCategories = categories
    .map((cat) => CATEGORY_PROMPTS[cat])
    .join('\n\n');

  const filesContext = files
    .map((file) => {
      return `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
    })
    .join('\n\n---\n\n');

  return `Review the following code files and identify issues in these categories:

${activeCategories}

Files to review:

${filesContext}

Return your findings as a JSON array. Include the file path in each issue.`;
}

export const FIX_GENERATION_PROMPT = `You are a code fix generator.

Given an issue description and the problematic code, generate a minimal fix.

Rules:
1. Only fix the specific issue described
2. Maintain code style and conventions
3. Don't introduce new dependencies unless necessary
4. Preserve existing functionality
5. Return ONLY the fixed code, no explanations

Return the fix as JSON:
{
  "fixedCode": "The complete fixed code",
  "explanation": "Brief explanation of the fix"
}`;

export function buildFixPrompt(
  issueDescription: string,
  fileContent: string,
  filePath: string,
  lineNumber: number
): string {
  return `Issue: ${issueDescription}

File: ${filePath} (line ${lineNumber})

Current code:
\`\`\`
${fileContent}
\`\`\`

Generate the fixed code.`;
}

export const SUMMARY_PROMPT = `You are a code review summarizer.

Given a list of code review issues, create a concise summary for a pull request comment.

The summary should:
1. Group issues by severity
2. Highlight the most critical findings
3. Provide actionable next steps
4. Be encouraging but direct
5. Use markdown formatting

Format:
## Code Review Summary

### Critical Issues (🔴)
[List critical issues]

### High Priority (🟠)
[List high priority issues]

### Medium Priority (🟡)
[List medium priority issues]

### Suggestions (ℹ️)
[List low priority and info items]

### Next Steps
[Recommended actions]

---
*Powered by Ollama Kimi 2.5*`;
