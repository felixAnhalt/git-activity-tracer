export type ContributionType = 'commit' | 'pr' | 'review';

export type Contribution = {
  type: ContributionType;
  timestamp: string;
  text?: string;
  url?: string;
};

export type GraphQLCommitNode = { occurredAt?: string; url?: string };
export type GraphQLCommitRepo = {
  repository?: { nameWithOwner?: string };
  contributions?: { nodes?: GraphQLCommitNode[] };
};

export type GraphQLPRNode = { occurredAt?: string; pullRequest?: { title?: string; url?: string } };

export type GraphQLReviewNode = { occurredAt?: string; pullRequestReview?: { url?: string } };

export type GraphQLResponse = {
  user?: {
    contributionsCollection?: {
      commitContributionsByRepository?: GraphQLCommitRepo[];
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
