/**
 * Platform-agnostic contribution types and data structures.
 * These types are shared across all connector implementations (GitHub, GitLab, etc.)
 */

export type ContributionType = 'commit' | 'pr' | 'review';

export type Contribution = {
  type: ContributionType;
  timestamp: string;
  text?: string;
  url?: string;
  repository?: string;
  target?: string;
  projectId?: string;
};

export type OutputFormat = 'console' | 'json' | 'csv';

export interface FormatterOptions {
  withLinks: boolean;
}

export interface FormatterResult {
  content: string;
  filename?: string;
}
