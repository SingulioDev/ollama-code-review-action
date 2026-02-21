/**
 * Load and validate configuration
 */

import { promises as fs } from 'node:fs';
import * as yaml from 'js-yaml';
import type { ReviewConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';

/**
 * Load configuration from file or use defaults
 */
export async function loadConfig(
  configPath?: string
): Promise<ReviewConfig> {
  if (!configPath) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = yaml.load(content) as Partial<ReviewConfig>;

    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch (error) {
    console.warn(
      `Failed to load config from ${configPath}, using defaults:`,
      error
    );
    return DEFAULT_CONFIG;
  }
}

/**
 * Merge user config with defaults
 */
function mergeConfig(
  defaults: ReviewConfig,
  user: Partial<ReviewConfig>
): ReviewConfig {
  return {
    scope: user.scope || defaults.scope,

    ollama: {
      ...defaults.ollama,
      ...user.ollama,
    },

    categories: {
      ...defaults.categories,
      ...user.categories,
    },

    severity_rules: {
      ...defaults.severity_rules,
      ...user.severity_rules,
    },

    exclude: user.exclude || defaults.exclude,

    batch: {
      ...defaults.batch,
      ...user.batch,
    },

    auto_fix: {
      ...defaults.auto_fix,
      ...user.auto_fix,
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: ReviewConfig): string[] {
  const errors: string[] = [];

  // Validate Ollama config
  if (!config.ollama.api_url) {
    errors.push('ollama.api_url is required');
  }

  if (!config.ollama.api_key) {
    errors.push('ollama.api_key is required');
  }

  if (!config.ollama.model) {
    errors.push('ollama.model is required');
  }

  // Validate temperature
  if (
    config.ollama.temperature < 0 ||
    config.ollama.temperature > 2
  ) {
    errors.push('ollama.temperature must be between 0 and 2');
  }

  // Validate max_tokens
  if (config.ollama.max_tokens < 100) {
    errors.push('ollama.max_tokens must be at least 100');
  }

  // Validate batch config
  if (config.batch.files_per_request < 1) {
    errors.push('batch.files_per_request must be at least 1');
  }

  if (config.batch.max_tokens_per_file < 100) {
    errors.push('batch.max_tokens_per_file must be at least 100');
  }

  // Validate at least one category is enabled
  const hasEnabledCategory = Object.values(config.categories).some(
    (enabled) => enabled
  );

  if (!hasEnabledCategory) {
    errors.push('At least one review category must be enabled');
  }

  return errors;
}

/**
 * Get config from environment variables
 */
export function getConfigFromEnv(): Partial<ReviewConfig> {
  const config: Partial<ReviewConfig> = {};

  // Ollama config from env
  if (process.env.OLLAMA_API_URL) {
    config.ollama = {
      ...(config.ollama || {}),
      api_url: process.env.OLLAMA_API_URL,
    } as any;
  }

  if (process.env.OLLAMA_API_KEY) {
    config.ollama = {
      ...(config.ollama || {}),
      api_key: process.env.OLLAMA_API_KEY,
    } as any;
  }

  if (process.env.OLLAMA_MODEL) {
    config.ollama = {
      ...(config.ollama || {}),
      model: process.env.OLLAMA_MODEL,
    } as any;
  }

  // Scope from env
  if (process.env.REVIEW_SCOPE) {
    config.scope = process.env.REVIEW_SCOPE as any;
  }

  return config;
}

/**
 * Load config with environment overrides
 */
export async function loadConfigWithEnv(
  configPath?: string
): Promise<ReviewConfig> {
  const fileConfig = await loadConfig(configPath);
  const envConfig = getConfigFromEnv();

  return mergeConfig(fileConfig, envConfig);
}

/**
 * Generate example config file
 */
export function generateExampleConfig(): string {
  return `# Ollama Code Review Configuration

# Review scope
scope: changed-imports  # changed-only | changed-imports | full-codebase

# Ollama configuration
ollama:
  model: kimi-2.5
  temperature: 0.7
  max_tokens: 4096

# Review categories
categories:
  security: true
  quality: true
  performance: true
  tests: true
  documentation: false
  style: false

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
`;
}
