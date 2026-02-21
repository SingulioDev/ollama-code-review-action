/**
 * Main entry point for Ollama Code Review GitHub Action
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { PullRequestContext } from './types/github.js';
import { loadConfigWithEnv, validateConfig } from './config/loader.js';
import { getChangedFiles } from './analyzer/diff.js';
import { ReviewEngine } from './reviewer/engine.js';
import { FixGenerator } from './fixer/generator.js';
import { FixApplier } from './fixer/applier.js';
import { GitHubReporter } from './reporter/github.js';

async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const ollamaApiUrl = core.getInput('ollama-api-url', { required: true });
    const ollamaApiKey = core.getInput('ollama-api-key', { required: true });
    const configPath = core.getInput('config-path') || '.github/code-review-config.yml';

    // Set environment variables for config loader
    process.env.OLLAMA_API_URL = ollamaApiUrl;
    process.env.OLLAMA_API_KEY = ollamaApiKey;

    // Load configuration
    core.info('Loading configuration...');
    const config = await loadConfigWithEnv(configPath);

    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      core.setFailed(`Configuration errors:\n${configErrors.join('\n')}`);
      return;
    }

    core.info(`Configuration loaded successfully`);
    core.info(`Scope: ${config.scope}`);
    core.info(`Model: ${config.ollama.model}`);

    // Get PR context
    const context = getPullRequestContext();
    if (!context) {
      core.setFailed('Could not determine pull request context');
      return;
    }

    core.info(`Reviewing PR #${context.number} in ${context.owner}/${context.repo}`);

    // Get changed files
    core.info('Analyzing changed files...');
    const changedFiles = await getChangedFiles(context.baseSha, context.headSha);
    core.info(`Found ${changedFiles.length} changed files`);

    // Initialize review engine
    const engine = new ReviewEngine(config);

    // Check Ollama health
    const isHealthy = await engine.getClient().healthCheck();
    if (!isHealthy) {
      core.setFailed('Ollama API is not available');
      return;
    }

    core.info('Ollama API is healthy');

    // Perform review
    core.info('Starting code review...');
    const allIssues = await engine.reviewPullRequest(changedFiles);
    core.info(`Found ${allIssues.length} total issues`);

    // Filter issues based on severity rules
    const reportableIssues = engine.filterBySeverityRules(allIssues);
    core.info(`Reporting ${reportableIssues.length} issues after filtering`);

    // Generate statistics
    const stats = engine.generateStats(reportableIssues);

    // Auto-fix if enabled
    let fixesApplied = 0;
    if (config.auto_fix.enabled && reportableIssues.length > 0) {
      core.info('Generating auto-fixes...');

      const fixGenerator = new FixGenerator(
        engine.getClient(),
        config.auto_fix
      );

      const fixes = await fixGenerator.generateFixes(reportableIssues);
      core.info(`Generated ${fixes.length} fixes`);

      if (fixes.length > 0) {
        const fixApplier = new FixApplier();

        // Validate fixes before applying
        const validation = await fixApplier.validateBeforeApply(fixes);

        if (!validation.valid) {
          core.warning(`Fix validation failed:\n${validation.errors.join('\n')}`);
        } else {
          // Apply fixes
          const result = await fixApplier.applyFixes(fixes);
          core.info(`Applied ${result.applied} fixes`);

          // Commit fixes
          if (result.applied > 0) {
            const commitSha = await fixApplier.commitFixes(
              result.files,
              result.applied
            );
            core.info(`Committed fixes: ${commitSha}`);
            fixesApplied = result.applied;
          }
        }
      }
    }

    // Report to GitHub
    core.info('Reporting results to GitHub...');
    const reporter = new GitHubReporter(githubToken, context);
    await reporter.reportReview(reportableIssues, stats, fixesApplied);

    // Set outputs
    core.setOutput('issues-found', stats.total.toString());
    core.setOutput('fixes-applied', fixesApplied.toString());

    // Determine review status
    const shouldBlock = engine.shouldBlockMerge(reportableIssues);
    const status = shouldBlock ? 'failure' : stats.total > 0 ? 'warning' : 'success';
    core.setOutput('review-status', status);

    // Set action status
    if (shouldBlock) {
      core.setFailed(`Review found ${stats.critical + stats.high} critical/high issues that block merge`);
    } else {
      core.info('Code review completed successfully');
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    core.setFailed(`Action failed: ${message}`);
    if (stack) {
      core.debug(stack);
    }
  }
}

/**
 * Get pull request context from GitHub event
 */
function getPullRequestContext(): PullRequestContext | null {
  const { context } = github;

  // Check if this is a pull request event
  if (context.payload.pull_request) {
    return {
      owner: context.repo.owner,
      repo: context.repo.repo,
      number: context.payload.pull_request.number,
      baseSha: context.payload.pull_request.base.sha,
      headSha: context.payload.pull_request.head.sha,
      headRef: context.payload.pull_request.head.ref,
    };
  }

  // Check if this is an issue comment on a PR
  if (context.payload.issue?.pull_request) {
    const prNumber = context.payload.issue.number;
    // We'll need to fetch PR details
    // For now, return null - this will be handled by fetching PR data
    return null;
  }

  return null;
}

// Run the action
run().catch((error) => {
  core.setFailed(error.message);
});
