# Setup Guide for Organization Action

This guide will help you publish this action to your GitHub organization and use it across all your repositories.

## Step 1: Create GitHub Repository

Create a new repository in your organization:

```bash
# Option A: Via GitHub CLI
gh repo create SingulioDev/ollama-code-review-action --public --description "Automated code review powered by Ollama"

# Option B: Via GitHub web interface
# 1. Go to https://github.com/organizations/SingulioDev/repositories/new
# 2. Repository name: ollama-code-review-action
# 3. Description: Automated code review powered by Ollama
# 4. Public (so other repos can use it)
# 5. Do NOT initialize with README (we have one already)
```

## Step 2: Push Code to New Repository

```bash
cd /tmp/ollama-code-review-action

# Add remote
git remote add origin git@github.com:SingulioDev/ollama-code-review-action.git

# Push code and tags
git push -u origin main
git push origin --tags

# Verify
gh repo view SingulioDev/ollama-code-review-action
```

## Step 3: Update Consuming Repositories

In your `varxius` repository (and any others that want to use this action):

**Create `.github/workflows/code-review.yml`:**

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

      # Option A: Local Ollama (Free)
      - name: Setup Ollama
        uses: ai-action/setup-ollama@v2.0.14
        with:
          model: kimi-2.5

      # Option B: Cloud Ollama (comment out above, uncomment below)
      # No setup step needed - just provide secrets

      - name: Run code review
        uses: SingulioDev/ollama-code-review-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # Local: http://localhost:11434
          # Cloud: ${{ secrets.OLLAMA_API_URL }}
          ollama-api-url: ${{ secrets.OLLAMA_API_URL || 'http://localhost:11434' }}
          ollama-api-key: ${{ secrets.OLLAMA_API_KEY || '' }}
          config-path: .github/code-review-config.yml
```

**Create `.github/code-review-config.yml`:**

```yaml
# Review scope
scope: changed-imports  # changed-only | changed-imports | full-codebase

# Ollama configuration
ollama:
  model: kimi-2.5
  temperature: 0.7
  max_tokens: 4096

# Review categories
categories:
  security: true      # OWASP/CWE vulnerabilities
  quality: true       # Code smells, anti-patterns
  performance: true   # N+1 queries, inefficient algorithms
  tests: true         # Missing coverage, flaky tests
  documentation: false  # Missing/outdated docstrings
  style: false        # Formatting, naming conventions

# Severity actions
severity_rules:
  critical: block    # block | warn | ignore
  high: block
  medium: warn
  low: ignore
  info: ignore

# File exclusions
exclude:
  - '**/*.generated.*'
  - '**/node_modules/**'
  - '**/dist/**'
  - '**/*.min.js'
  - '**/coverage/**'

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

## Step 4: Configure Secrets (Cloud Ollama Only)

If using Ollama Cloud instead of local Ollama:

```bash
# In each repository that will use this action
gh secret set OLLAMA_API_URL --body "https://api.ollama.com"
gh secret set OLLAMA_API_KEY --body "your-ollama-cloud-api-key"

# Or via GitHub web interface:
# Repository → Settings → Secrets and variables → Actions → New repository secret
```

## Step 5: Remove Old Local Action

In `varxius` repository:

```bash
cd /opt/dev/varxius

# Remove the local action (it's now an organization action)
rm -rf .github/actions/code-review

# Commit the cleanup
git add .github/actions/
git commit -m "chore: remove local code review action (now uses organization action)"
git push origin main
```

## Versioning Strategy

**Major versions** (v1, v2, v3): Breaking changes
- Update consuming repos when ready: `uses: SingulioDev/ollama-code-review-action@v2`

**Minor/patch updates**: Backwards compatible
- Consuming repos automatically get updates (v1 always points to latest v1.x.x)

**Creating new versions:**

```bash
cd /tmp/ollama-code-review-action

# For patch/minor updates
git tag -a v1.1.0 -m "Add new feature"
git push origin v1.1.0

# Update the v1 tag to point to latest
git tag -fa v1 -m "Update v1 to v1.1.0"
git push origin v1 --force

# For breaking changes
git tag -a v2 -m "Release v2.0.0 - Breaking changes"
git push origin v2
```

## Maintenance

The action repository has an automatic build workflow that:
- Builds the TypeScript on every push to main
- Commits the built `dist/index.js` automatically
- Verifies PRs have up-to-date dist/

## Testing

Before releasing new versions:

1. Create a test repository
2. Use the action with `@main` branch reference
3. Create a test PR and verify it works
4. Tag a new version once confirmed

```yaml
# For testing unreleased changes
uses: SingulioDev/ollama-code-review-action@main
```

## Troubleshooting

**Action not found:**
- Verify repository is public
- Check repository name matches: `SingulioDev/ollama-code-review-action`

**Permission denied:**
- Ensure consuming repository has correct permissions in workflow

**Build failures:**
- Check `.github/workflows/build.yml` in action repository
- Verify Bun 1.3.10 is installed correctly

---

✨ Your organization action is now ready to use across all repositories!
