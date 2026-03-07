# Ollama Code Review GitHub Action

Automated code review powered by Ollama Kimi 2.5 with comprehensive analysis and auto-fix capabilities. Runs Ollama locally in GitHub Actions or connects to cloud Ollama.

## Features

- 🔍 **Comprehensive Review**: Security (OWASP/CWE), quality, performance, tests, documentation, style
- 🤖 **Auto-Fix**: Automatically commits fixes for style and documentation issues directly to PR branch
- 💬 **Triple Output**: Line comments + summary comment + GitHub Check annotations
- ⚙️ **Configurable**: Flexible scope (changed-only, changed-imports, full-codebase), severity rules, merge blocking
- 🚀 **Fast**: Batched processing with intelligent file scoping (5 files per request)
- 🎯 **Dual Trigger**: Auto on PR open/ready + manual `/review` comment
- 📊 **Smart Reporting**: Severity-based grouping with auto-collapse for low-priority issues
- 🆓 **Free Option**: Run Ollama locally in GitHub Actions (no API costs)

## Quick Start

### Option A: Local Ollama (Recommended)

No secrets needed! Ollama runs directly in the GitHub Actions runner.

**1. Create Workflow**

Create `.github/workflows/code-review.yml`:

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  checks: write
  issues: write

jobs:
  review:
    if: >
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       contains(github.event.comment.body, '/review'))

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.ref }}

      - uses: oven-sh/setup-bun@v2.1.3
        with:
          bun-version: 1.3.10

      - name: Setup Ollama
        uses: ai-action/setup-ollama@v2.0.14
        with:
          model: kimi-2.5

      - name: Run code review
        uses: SingulioDev/ollama-code-review-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          ollama-api-url: http://localhost:11434
          config-path: .github/code-review-config.yml
```

**2. Create Configuration**

Create `.github/code-review-config.yml`:

```yaml
# Review scope
scope: changed-imports # changed-only | changed-imports | full-codebase

# Ollama configuration
ollama:
  model: kimi-2.5
  temperature: 0.7
  max_tokens: 4096

# Review categories
categories:
  security: true # OWASP/CWE vulnerabilities
  quality: true # Code smells, anti-patterns
  performance: true # N+1 queries, inefficient algorithms
  tests: true # Missing coverage, flaky tests
  documentation: false # Missing/outdated docstrings
  style: false # Formatting, naming conventions

# Severity actions
severity_rules:
  critical: block # block | warn | ignore
  high: block
  medium: warn
  low: ignore
  info: ignore

# File exclusions
exclude:
  - "**/*.generated.*"
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/*.min.js"
  - "**/coverage/**"

# Batch configuration
batch:
  files_per_request: 5
  max_tokens_per_file: 2000

# Auto-fix configuration
auto_fix:
  enabled: true
  categories:
    - style
    - documentation
```

### Option B: Cloud Ollama

If you have your own Ollama instance or cloud API:

**1. Add Secrets**

Add these secrets to your repository:

- `OLLAMA_API_URL`: Your Ollama API endpoint (e.g., `https://api.ollama.com`)
- `OLLAMA_API_KEY`: Your Ollama API key (if required)

**2. Create Workflow**

Create `.github/workflows/code-review.yml` (skip the `Setup Ollama` step):

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  checks: write
  issues: write

jobs:
  review:
    if: >
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       contains(github.event.comment.body, '/review'))

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.ref }}

      - uses: oven-sh/setup-bun@v2.1.3
        with:
          bun-version: 1.3.10

      - name: Run code review
        uses: SingulioDev/ollama-code-review-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          ollama-api-url: ${{ secrets.OLLAMA_API_URL }}
          ollama-api-key: ${{ secrets.OLLAMA_API_KEY }}
          config-path: .github/code-review-config.yml
```

**3. Use the same configuration** as Option A above.

## Usage

### Automatic Triggers

The action runs automatically when:

1. A pull request is opened
2. A draft PR is marked "ready for review"

### Manual Trigger

Comment `/review` on any pull request to trigger an immediate review.

## Inputs

| Input            | Description                   | Required | Default                          |
| ---------------- | ----------------------------- | -------- | -------------------------------- |
| `github-token`   | GitHub token for API access   | Yes      | N/A                              |
| `ollama-api-url` | Ollama API endpoint URL       | No       | `http://localhost:11434`         |
| `ollama-api-key` | Ollama API authentication key | No       | `''` (empty)                     |
| `config-path`    | Path to config file           | No       | `.github/code-review-config.yml` |

## Outputs

| Output          | Description                    | Values                          |
| --------------- | ------------------------------ | ------------------------------- |
| `review-status` | Overall review result          | `success`, `warning`, `failure` |
| `issues-found`  | Total number of issues         | Number                          |
| `fixes-applied` | Number of auto-fixes committed | Number                          |

## Configuration Options

### Scope Modes

- **`changed-only`**: Review only changed files
- **`changed-imports`**: Review changed files + files that import them (default)
- **`full-codebase`**: Review all source files

### Review Categories

Each category can be enabled/disabled independently:

- **Security**: SQL injection, XSS, CSRF, hardcoded secrets, authentication flaws, OWASP Top 10
- **Quality**: Code smells, duplication, complex logic, missing error handling, SOLID violations
- **Performance**: N+1 queries, memory leaks, inefficient algorithms, missing caching
- **Tests**: Missing coverage, flaky tests, over-mocking, missing edge cases
- **Documentation**: Missing docstrings, outdated comments, unclear error messages
- **Style**: Formatting, naming conventions, import organization, linting violations

### Severity Rules

Each severity level can be configured with an action:

- **`block`**: Fails the check and blocks merge
- **`warn`**: Creates warning but allows merge
- **`ignore`**: Issue is not reported

Severity levels: `critical`, `high`, `medium`, `low`, `info`

### Auto-Fix

Auto-fix can be enabled for specific categories. Fixes are:

- Generated by Ollama Kimi 2.5
- Applied directly to PR branch
- Committed with bot attribution
- Only for safe categories (style, documentation)

## Review Output

The action provides three types of output:

### 1. PR Summary Comment

Markdown comment with:

- Stats table (files reviewed, issue counts by severity)
- Critical issues (🔴)
- High priority issues (🟠)
- Medium priority issues (🟡)
- Low priority issues (🔵) - collapsed
- Informational (ℹ️) - collapsed
- Auto-fix notification if fixes were applied

### 2. Line Comments

Individual comments on specific lines:

- Severity emoji (🔴 🟠 🟡 🔵 ℹ️)
- Issue title and description
- Suggested fix
- Category badge (🔒 ⭐ ⚡ 🧪 📚 🎨)

### 3. GitHub Check Run

Annotations on files with:

- Check status based on severity
- Summary statistics
- Clickable annotations at issue locations
- Conclusion: `success`, `neutral`, or `failure`

## Development

### Prerequisites

- Bun 1.3.10+
- Node.js 20+

### Setup

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Build
bun run build

# Run tests
bun test
```

### Project Structure

```
.github/actions/code-review/
├── src/
│   ├── analyzer/        # Diff analysis, AST parsing, scope resolution
│   ├── ollama/          # Ollama API client
│   ├── reviewer/        # Review engine, prompts, response parsing
│   ├── fixer/           # Auto-fix generation and application
│   ├── reporter/        # GitHub API integration, formatting
│   ├── config/          # Configuration loading and validation
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main entry point
├── dist/                # Built output
├── action.yml           # GitHub Action metadata
├── package.json
└── tsconfig.json
```

### Key Components

- **ReviewEngine**: Orchestrates the review process
- **OllamaClient**: HTTP client for Ollama API
- **FixGenerator**: Generates auto-fixes using Ollama
- **FixApplier**: Applies fixes and commits to PR branch
- **GitHubReporter**: Creates PR comments, reviews, and checks

## Troubleshooting

### No issues found but expected some

- Check that review categories are enabled in config
- Verify Ollama API is responding
- Check file exclusion patterns
- Ensure files are in reviewable languages

### Auto-fix not working

- Verify `auto_fix.enabled: true` in config
- Check that issue category is in `auto_fix.categories`
- Ensure GitHub token has `contents: write` permission

### Ollama API errors

- Verify `OLLAMA_API_URL` and `OLLAMA_API_KEY` secrets
- Check Ollama API health at `$OLLAMA_API_URL/api/tags`
- Ensure model `kimi-2.5` is available

### Check run not appearing

- Verify `checks: write` permission in workflow
- Ensure `headSha` is correct
- Check GitHub API rate limits

## Migration from chatgpt-codex-connector

Differences from the old connector:

1. **Ollama (Local or Cloud)**: Uses Ollama instead of OpenAI - run locally in GitHub Actions (free) or connect to Ollama Cloud
2. **Auto-fix commits**: Commits fixes directly to PR branch
3. **Triple output**: Adds GitHub Checks in addition to comments
4. **Scope modes**: More flexible file scoping options
5. **Batching**: Processes files in batches for efficiency
6. **Severity blocking**: Configurable merge blocking per severity
7. **No API costs**: Optional free local execution with setup-ollama action

## License

MIT

---

🤖 _Powered by [Ollama](https://ollama.ai) Kimi 2.5_
