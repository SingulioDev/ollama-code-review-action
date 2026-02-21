/**
 * Configuration types for code review action
 */

export type ScopeMode = 'changed-only' | 'changed-imports' | 'full-codebase';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type SeverityAction = 'block' | 'warn' | 'ignore';

export enum ReviewCategory {
  Security = 'security',
  Quality = 'quality',
  Performance = 'performance',
  Tests = 'tests',
  Documentation = 'documentation',
  Style = 'style',
}

export interface OllamaConfig {
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface CategoryConfig {
  [ReviewCategory.Security]: boolean;
  [ReviewCategory.Quality]: boolean;
  [ReviewCategory.Performance]: boolean;
  [ReviewCategory.Tests]: boolean;
  [ReviewCategory.Documentation]: boolean;
  [ReviewCategory.Style]: boolean;
}

export interface SeverityRules {
  critical: SeverityAction;
  high: SeverityAction;
  medium: SeverityAction;
  low: SeverityAction;
  info: SeverityAction;
}

export interface BatchConfig {
  max_files_per_batch: number;
  max_tokens_per_file: number;
}

export interface AutoFixConfig {
  enabled: boolean;
  categories: ReviewCategory[];
}

export interface ReviewConfig {
  scope: ScopeMode;
  ollama: OllamaConfig;
  categories: CategoryConfig;
  severity_rules: SeverityRules;
  exclude: string[];
  batch: BatchConfig;
  auto_fix: AutoFixConfig;
}

export const DEFAULT_CONFIG: ReviewConfig = {
  scope: 'changed-imports',
  ollama: {
    model: 'kimi-2.5',
    temperature: 0.7,
    max_tokens: 4096,
  },
  categories: {
    [ReviewCategory.Security]: true,
    [ReviewCategory.Quality]: true,
    [ReviewCategory.Performance]: true,
    [ReviewCategory.Tests]: true,
    [ReviewCategory.Documentation]: false,
    [ReviewCategory.Style]: false,
  },
  severity_rules: {
    critical: 'block',
    high: 'block',
    medium: 'warn',
    low: 'ignore',
    info: 'ignore',
  },
  exclude: [
    '**/*.generated.*',
    '**/node_modules/**',
    '**/dist/**',
    '**/*.min.js',
    '**/*.min.css',
  ],
  batch: {
    max_files_per_batch: 5,
    max_tokens_per_file: 2000,
  },
  auto_fix: {
    enabled: true,
    categories: [ReviewCategory.Style, ReviewCategory.Documentation],
  },
};
