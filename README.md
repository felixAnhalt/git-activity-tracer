# Git Activity Tracer

Track your development activity across GitHub and GitLab. Fetch commits, pull/merge requests, and code reviews from your authenticated accounts.

## Quick Start

```bash
# Try it now with npx
npx @tmegit/git-activity-tracer  # Fetch current week
```

**First time setup:**

1. Get a token: [GitHub](https://github.com/settings/tokens) or [GitLab](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html)
2. Set environment variable: `export GH_TOKEN=your_token_here` (or `GITLAB_TOKEN`)
3. Run: `npx @tmegit/git-activity-tracer`

**Install globally** (optional):

```bash
npm install -g @tmegit/git-activity-tracer
git-activity-tracer  # Fetch current week
git-activity-tracer 2025-01-01 2025-01-31  # Specific range
```

## Common Commands

```bash
# Current week activity
git-activity-tracer

# Specific date range
git-activity-tracer 2025-01-01 2025-01-31

# Export formats
git-activity-tracer --format json
git-activity-tracer --format csv

# All commits from all branches
git-activity-tracer all-commits

# Include URLs in output
git-activity-tracer --with-links
```

## Environment Variables

| Variable       | Required  | Description                           | Default              |
| -------------- | --------- | ------------------------------------- | -------------------- |
| `GH_TOKEN`     | One of \* | GitHub personal access token          | -                    |
| `GITLAB_TOKEN` | One of \* | GitLab personal access token          | -                    |
| `GITLAB_HOST`  | No        | GitLab instance URL (for self-hosted) | `https://gitlab.com` |

\*At least one token (GitHub or GitLab) is required. Both can be used simultaneously.

## Command Options

| Option              | Description                                    | Default                |
| ------------------- | ---------------------------------------------- | ---------------------- |
| `<fromdate>`        | Start date (YYYY-MM-DD)                        | Monday of current week |
| `<todate>`          | End date (YYYY-MM-DD)                          | Today                  |
| `--with-links`      | Include URLs in console output                 | false                  |
| `--format <format>` | Output format: `console`, `json`, or `csv`     | `console`              |
| `config`            | Display configuration file location            | -                      |
| `project-id`        | Manage repository project ID mappings          | -                      |
| `all-commits`       | Show all commits from all branches (see below) | -                      |

### All Commits Command

Show all commits from all branches (including feature branches):

```bash
git-activity-tracer all-commits                        # Current week
git-activity-tracer all-commits 2025-12-01 2025-12-31  # Date range
git-activity-tracer all-commits --format csv           # Export
```

**Difference from default:**

- **Default**: Commits from base branches (main/master/develop) + PRs + reviews
- **all-commits**: ALL commits from ALL branches (including feature branches)

## Project ID Mapping

Map repositories to project IDs for billing and time tracking:

```bash
git-activity-tracer project-id add owner/repository PROJECT-123
git-activity-tracer project-id list
git-activity-tracer project-id remove owner/repository
```

Project IDs automatically appear in all output formats (console, JSON, CSV).

## Configuration

Configuration file: `~/.git-activity-tracer/config.json` (auto-created on first run)

```bash
# View configuration location
git-activity-tracer config
```

### Custom Base Branches

**Note:** Base branch configuration applies **only to GitLab**. GitHub automatically uses the default branch via the GraphQL API and does not require configuration.

Default branches tracked (GitLab only): `main`, `master`, `develop`, `development`

To add more branches for GitLab, edit the configuration file:

```json
{
  "baseBranches": ["main", "master", "develop", "development", "trunk", "staging"],
  "repositoryProjectIds": {
    "owner/repository": "PROJECT-123"
  }
}
```

**Platform differences:**

- **GitHub**: Uses GraphQL `contributionsCollection` API which automatically provides commits from the default branch. The `baseBranches` configuration is not used.
- **GitLab**: Filters push events by the configured `baseBranches` to determine which commits to include in reports.
- **Both platforms**: `all-commits` command ignores base branch configuration and returns commits from all branches.

### Self-Hosted GitLab

```bash
export GITLAB_HOST=https://gitlab.your-company.com
export GITLAB_TOKEN=your_token_here
```

## Development

```bash
pnpm install        # Install dependencies
pnpm start          # Run in development
pnpm test           # Run tests
pnpm run lint       # Lint code
pnpm run format     # Format code
pnpm build          # Build for distribution
```

## Contributing

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning:

- `feat:` - New feature (minor bump: 1.0.0 → 1.1.0)
- `fix:` - Bug fix (patch bump: 1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` - Breaking change (major bump: 1.0.0 → 2.0.0)
- `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` - No version bump

Commits to `main` trigger automated releases via semantic-release.

## API Limitations

- **GitHub**: Up to 50 repositories, 100 commits per repository
- **GitLab**: Up to 1000 events and 1000 merge requests per query

## License

Apache-2.0 License © Felix Anhalt
