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
