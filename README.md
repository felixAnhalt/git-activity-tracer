# Git Activity Tracer

Fetch commits, PRs/MRs, and reviews for a given authenticated user from GitHub or GitLab.

## Features

- Multi-platform support: GitHub and GitLab (GitLab coming soon)
- Fetches commits, pull/merge requests, and code reviews
- Supports multiple output formats: console (default), JSON, CSV
- Automatic pagination for repositories with more than 100 commits
- Configurable base branches for tracking push events
- Cross-platform configuration file support

## Setup

The tool automatically detects which platforms to fetch from based on available tokens. You can use one or multiple platforms simultaneously!

### GitHub

1. Create a `.env` file in the project root with your GitHub token:

   ```bash
   GH_TOKEN=your_github_token_here
   ```

2. Get a GitHub personal access token from https://github.com/settings/tokens

### GitLab (Coming Soon)

1. Add your GitLab token to the `.env` file:

   ```bash
   GITLAB_TOKEN=your_gitlab_token_here
   ```

2. Get a GitLab personal access token from https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html

### Multi-Platform Usage

Use both platforms at once by providing both tokens:

```bash
GH_TOKEN=your_github_token_here
GITLAB_TOKEN=your_gitlab_token_here
```

The tool will automatically fetch from all platforms with available tokens and merge the results!

## Usage

### Basic Usage

```bash
# Fetch today's activity
pnpm start

# Fetch activity for a date range
pnpm start -- --from 2025-01-01 --to 2025-01-31

# Build and run
pnpm build
node dist/src/index.js --from 2025-01-01 --to 2025-01-31
```

### Command Line Options

- `--from <date>` - Start date (YYYY-MM-DD). Defaults to Monday of current week
- `--to <date>` - End date (YYYY-MM-DD). Defaults to today
- `--with-links` - Include URLs in output
- `--output <format>` - Output format: `console` (default), `json`, or `csv`
- `--show-config` - Show configuration file location and exit

### Output Formats

**Console** (default):

```bash
pnpm start -- --from 2025-11-11 --to 2025-11-12
```

**JSON**:

```bash
pnpm start -- --from 2025-11-11 --to 2025-11-12 --output json
```

**CSV**:

```bash
pnpm start -- --from 2025-11-11 --to 2025-11-12 --output csv
```

## Configuration

The CLI uses a configuration file stored at `~/.git-activity-tracer/config.json` to customize behavior.

### View Configuration Location

```bash
pnpm start -- --show-config
```

### Automatic Platform Detection

The tool automatically detects which platforms to use based on available environment variables:

- If `GH_TOKEN` is set → Fetches from GitHub
- If `GITLAB_TOKEN` is set → Fetches from GitLab; If `GITLAB_HOST` is set, uses that as the GitLab instance URL
- If both are set → Fetches from both platforms and merges results

No manual configuration needed!

### Customize Base Branches

By default, the tool tracks push events to these branches: `main`, `master`, `develop`, `development`.

To customize, edit `~/.git-activity-tracer/config.json`:

```json
{
  "baseBranches": ["main", "master", "develop", "development", "trunk", "staging"]
}
```

The config file is automatically created with defaults on first run if it doesn't exist.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Lint code
pnpm run lint

# Format code
pnpm run format
```
