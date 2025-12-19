/**
 * GitLab-specific types for API responses and data structures.
 */

export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangeTimestamps {
  fromTimestamp: number;
  toTimestamp: number;
}

// User API response types
export interface GitLabUser {
  id?: number;
  username?: string;
  name?: string;
  email?: string;
}

// Event API response types
export interface GitLabPushData {
  commit_count?: number;
  ref?: string;
  ref_type?: string;
  action?: string;
  commit_to?: string;
  commit_title?: string;
}

export interface GitLabEventProject {
  id?: number;
  name?: string;
  path_with_namespace?: string;
}

export interface GitLabEvent {
  id?: number;
  action_name?: string;
  created_at?: string;
  target_type?: string;
  target_title?: string;
  target_id?: number;
  author_id?: number;
  author_username?: string;
  push_data?: GitLabPushData;
  project_id?: number;
  target_iid?: number;
  note?: {
    id?: number;
    body?: string;
    noteable_type?: string;
  };
}

// Commit API response types
export interface GitLabCommit {
  id?: string;
  short_id?: string;
  title?: string;
  message?: string;
  created_at?: string;
  committed_date?: string;
  author_name?: string;
  author_email?: string;
  web_url?: string;
}

// Merge Request API response types
export interface GitLabMergeRequest {
  id?: number;
  iid?: number;
  title?: string;
  description?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  merged_at?: string;
  closed_at?: string;
  target_branch?: string;
  source_branch?: string;
  web_url?: string;
  author?: {
    id?: number;
    username?: string;
    name?: string;
  };
  project_id?: number;
}

// Project API response types
export interface GitLabProject {
  id?: number;
  name?: string;
  path?: string;
  path_with_namespace?: string;
  web_url?: string;
  default_branch?: string;
}

// Generic API response wrapper
export interface GitLabApiResponse<T = unknown> {
  data?: T;
  headers?: Record<string, string>;
  status?: number;
}
