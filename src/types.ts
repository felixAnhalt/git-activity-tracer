export type ContributionType = 'commit' | 'pr' | 'review';

export type Contribution = {
  type: ContributionType;
  timestamp: string;
  text?: string;
  url?: string;
  repository?: string;
  target?: string;
};

export type GraphQLCommitAuthor = {
  name?: string;
  email?: string;
  user?: {
    login?: string;
  };
};

export type GraphQLCommitHistoryNode = {
  oid?: string;
  committedDate?: string;
  messageHeadline?: string;
  message?: string;
  url?: string;
  author?: GraphQLCommitAuthor;
};

export type GraphQLPageInfo = {
  hasNextPage?: boolean;
  endCursor?: string;
};

export type GraphQLCommitHistory = {
  nodes?: GraphQLCommitHistoryNode[];
  pageInfo?: GraphQLPageInfo;
};

export type GraphQLRepositoryWithHistory = {
  nameWithOwner?: string;
  defaultBranchRef?: {
    name?: string;
    target?: {
      history?: GraphQLCommitHistory;
    };
  };
};

export type GraphQLCommitRepoWithHistory = {
  repository?: GraphQLRepositoryWithHistory;
};

export type GraphQLPRNode = {
  occurredAt?: string;
  pullRequest?: {
    title?: string;
    url?: string;
    baseRefName?: string;
  };
};

export type GraphQLReviewNode = {
  occurredAt?: string;
  pullRequestReview?: {
    url?: string;
    pullRequest?: {
      baseRefName?: string;
    };
  };
};

export type GraphQLResponse = {
  user?: {
    contributionsCollection?: {
      commitContributionsByRepository?: GraphQLCommitRepoWithHistory[];
      pullRequestContributions?: { nodes?: GraphQLPRNode[] };
      pullRequestReviewContributions?: { nodes?: GraphQLReviewNode[] };
    };
  };
};

export type GraphQLErrorResponse = {
  errors?: Array<{ message: string; type?: string; path?: string[] }>;
};

export interface GitHubEventCommit {
  sha?: string;
  message?: string;
  url?: string;
}

export interface GitHubEventPayload {
  ref?: string;
  commits?: GitHubEventCommit[];
}

export interface GitHubEventRepository {
  name?: string;
}

export interface GitHubEvent {
  type?: string;
  created_at?: string;
  repo?: GitHubEventRepository;
  payload?: GitHubEventPayload;
}

export interface GraphQLApiResponse {
  data?: unknown;
}

export interface EventsApiResponse {
  data?: unknown;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangeTimestamps {
  fromTimestamp: number;
  toTimestamp: number;
}

export type OutputFormat = 'console' | 'json' | 'csv';

export interface FormatterOptions {
  withLinks: boolean;
}

export interface FormatterResult {
  content: string;
  filename?: string;
}
