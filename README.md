# Git Activity Tracer

**Track your development activity across GitHub and GitLab.** Fetch commits, pull/merge requests, and code reviews from your authenticated accounts.

## Quick Start

### Required Environment Variables

Create a `.env` file in the project root with your platform tokens:

```bash
# GitHub (optional)
GH_TOKEN=your_github_token_here

# GitLab (optional)
GITLAB_TOKEN=your_gitlab_token_here
GITLAB_HOST=https://gitlab.com  # Optional: defaults to gitlab.com
```

At least one token (GitHub or GitLab) is required. Both can be used simultaneously to fetch from multiple platforms.

**Get your tokens:**

- GitHub: https://github.com/settings/tokens
- GitLab: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html

### Basic Usage

```bash
# Install dependencies
pnpm install

# Fetch today's activity
pnpm start

# Fetch activity for a specific date range
pnpm start -- --from 2025-01-01 --to 2025-01-31

# Export as JSON or CSV
pnpm start -- --output json
pnpm start -- --output csv
```

## Features

- **Multi-platform support**: GitHub and GitLab with automatic detection
- **Comprehensive tracking**: Commits, pull/merge requests, and code reviews
- **Multiple output formats**: Console (default), JSON, CSV
- **Project ID mapping**: Map repositories to project IDs for billing and time tracking
- **Flexible configuration**: Configurable base branches and date ranges
- **Smart pagination**: Automatically fetches all contributions within limits
- **Cross-platform**: Works on macOS, Linux, and Windows

## Environment Variables

| Variable       | Required                        | Description                           | Default              |
| -------------- | ------------------------------- | ------------------------------------- | -------------------- |
| `GH_TOKEN`     | One of GH_TOKEN or GITLAB_TOKEN | GitHub personal access token          | -                    |
| `GITLAB_TOKEN` | One of GH_TOKEN or GITLAB_TOKEN | GitLab personal access token          | -                    |
| `GITLAB_HOST`  | No                              | GitLab instance URL (for self-hosted) | `https://gitlab.com` |

The tool automatically detects available tokens and fetches from all configured platforms.

## Command Line Options

| Option              | Description                                  | Default                |
| ------------------- | -------------------------------------------- | ---------------------- |
| `--from <date>`     | Start date in YYYY-MM-DD format              | Monday of current week |
| `--to <date>`       | End date in YYYY-MM-DD format                | Today                  |
| `--with-links`      | Include URLs in console output               | false                  |
| `--output <format>` | Output format: `console`, `json`, or `csv`   | `console`              |
| `--show-config`     | Display configuration file location and exit | -                      |
| `--project-id`      | Manage repository project ID mappings        | -                      |

## Usage Examples

### Date Ranges

```bash
# Current week (Monday to today)
pnpm start

# Specific date range
pnpm start -- --from 2025-01-01 --to 2025-01-31

# Single day
pnpm start -- --from 2025-12-19 --to 2025-12-19
```

### Output Formats

**Console** (human-readable, grouped by date):

```bash
pnpm start -- --from 2025-11-11 --to 2025-11-12
```

**JSON** (for programmatic processing):

```bash
pnpm start -- --from 2025-11-11 --to 2025-11-12 --output json
```

**CSV** (for spreadsheets):

```bash
pnpm start -- --from 2025-11-11 --to 2025-11-12 --output csv
```

### Include URLs

```bash
# Show contribution URLs in console output
pnpm start -- --with-links
```

## Project ID Mapping

Map repositories to project IDs for billing and time tracking. Project IDs automatically appear in all output formats.

### Manage Mappings

```bash
# List all project ID mappings
pnpm start --project-id list

# Add a mapping
pnpm start --project-id add owner/repository PROJECT-123

# Remove a mapping
pnpm start --project-id remove owner/repository
```

### Example Workflow

```bash
# Configure your billable projects
pnpm start --project-id add acme-corp/website 1727783287A
pnpm start --project-id add globex/mobile-app 2849372837B

# List configured mappings
pnpm start --project-id list

# Generate report - project IDs automatically included
pnpm start -- --from 2025-12-01 --to 2025-12-19 --output csv
```

### Output Format

Project IDs appear in all output formats:

**Console:**

```
commit: 10:30:00: [acme-corp/website]: {1727783287A}: (main): Fix bug
```

**CSV:**

```csv
type,timestamp,date,repository,target,projectId,text
commit,2025-12-01T10:30:00Z,2025-12-01,acme-corp/website,main,1727783287A,Fix bug
```

**JSON:**

```json
{
  "type": "commit",
  "timestamp": "2025-12-01T10:30:00Z",
  "date": "2025-12-01",
  "repository": "acme-corp/website",
  "target": "main",
  "projectId": "1727783287A",
  "text": "Fix bug"
}
```

Contributions without a configured project ID mapping will omit the `projectId` field.

## Configuration

The tool uses a configuration file at `~/.git-activity-tracer/config.json` for customization. The file is automatically created with defaults on first run.

### View Configuration

```bash
pnpm start -- --show-config
```

### Platform Detection

The tool automatically detects platforms based on available environment variables:

- **GitHub**: Enabled when `GH_TOKEN` is set
- **GitLab**: Enabled when `GITLAB_TOKEN` is set
- **Multiple platforms**: Set both tokens to fetch from both platforms simultaneously

Results from all enabled platforms are automatically merged and deduplicated.

### Custom Base Branches

By default, commits are tracked for these branches: `main`, `master`, `develop`, `development`.

To track additional branches, edit `~/.git-activity-tracer/config.json`:

```json
{
  "baseBranches": ["main", "master", "develop", "development", "trunk", "staging"],
  "repositoryProjectIds": {
    "owner/repository": "PROJECT-123"
  }
}
```

### Self-Hosted GitLab

For self-hosted GitLab instances, set the `GITLAB_HOST` environment variable:

```bash
GITLAB_HOST=https://gitlab.your-company.com
GITLAB_TOKEN=your_token_here
```

## Build and Distribution

```bash
# Build the project
pnpm build

# Run the compiled version
node dist/src/index.js --from 2025-01-01 --to 2025-01-31
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm start

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Lint code
pnpm run lint

# Format code
pnpm run format
```

## API Limitations

- **GitHub**: Fetches up to 50 repositories, 100 commits per repository
- **GitLab**: Fetches up to 1000 events and 1000 merge requests per query

For most users, these limits are sufficient. Very active users with thousands of contributions in a single date range may experience incomplete results.

## License

MIT
