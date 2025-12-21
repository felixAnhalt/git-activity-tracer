# Git Activity Tracer

**Track your development activity across GitHub and GitLab.** Fetch commits, pull/merge requests, and code reviews from your authenticated accounts.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @tmegit/git-activity-tracer
```

### Using npx (No installation required)

### Example: Fetch activity for January 2025

```bash
npx @tmegit/git-activity-tracer 2025-01-01 2025-01-31
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/felixAnhalt/git-activity-tracer.git
cd git-activity-tracer

# Install dependencies
pnpm install

# Run locally
pnpm start
```

## Quick Start

### Required Environment Variables

Create a `.env` file (for local development) or set environment variables with your platform tokens:

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
# Fetch activity for the current week (Monday to today)
git-activity-tracer

# Fetch activity for a specific date range
git-activity-tracer 2025-01-01 2025-01-31

# Export as JSON or CSV
git-activity-tracer --format json
git-activity-tracer --format csv

# Using npx (no installation)
npx @tmegit/git-activity-tracer 2025-01-01 2025-01-31
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

| Option              | Description                                     | Default                |
| ------------------- | ----------------------------------------------- | ---------------------- |
| `<fromdate>`        | Start date in YYYY-MM-DD format                 | Monday of current week |
| `<todate>`          | End date in YYYY-MM-DD format                   | Today                  |
| `--with-links`      | Include URLs in console output                  | false                  |
| `--format <format>` | Output format: `console`, `json`, or `csv`      | `console`              |
| `config`            | Display configuration file location             | -                      |
| `project-id`        | Manage repository project ID mappings           | -                      |
| `commits`           | Show commits-only report (see 'Usage Examples') | -                      |


## Usage Examples

### Date Ranges

```bash
# Current week (Monday to today)
git-activity-tracer

# Specific date range
git-activity-tracer 2025-01-01 2025-01-31

# Single day
git-activity-tracer 2025-12-19 2025-12-19

# Using npx
npx @tmegit/git-activity-tracer 2025-01-01 2025-01-31
```

### Output Formats

**Console** (human-readable, grouped by date):

```bash
git-activity-tracer 2025-11-11 2025-11-12
```

**JSON** (for programmatic processing):

```bash
git-activity-tracer 2025-11-11 2025-11-12 --format json
```

**CSV** (for spreadsheets):

```bash
git-activity-tracer 2025-11-11 2025-11-12 --format csv
```

### Include URLs

```bash
# Show contribution URLs in console output
git-activity-tracer --with-links
```

## Project ID Mapping

Map repositories to project IDs for billing and time tracking. Project IDs automatically appear in all output formats.

### Manage Mappings

```bash
# List all project ID mappings
git-activity-tracer project-id list

# Add a mapping
git-activity-tracer project-id add owner/repository PROJECT-123

# Remove a mapping
git-activity-tracer project-id remove owner/repository
```

### Example Workflow

```bash
# Configure your billable projects
git-activity-tracer project-id add acme-corp/website 1727783287A
git-activity-tracer project-id add globex/mobile-app 2849372837B

# List configured mappings
git-activity-tracer project-id list

# Generate report - project IDs automatically included
git-activity-tracer 2025-12-01 2025-12-19 --format csv
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
git-activity-tracer config
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
node dist/index.js 2025-01-01 2025-01-31
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

## Contributing

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and releases.

### Commit Message Format

Use the following prefixes for your commits:

- `feat:` - A new feature (triggers minor version bump: 1.0.0 → 1.1.0)
- `fix:` - A bug fix (triggers patch version bump: 1.0.0 → 1.0.1)
- `docs:` - Documentation changes only
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring without changing functionality
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependency updates, etc.

**Breaking changes** (triggers major version bump: 1.0.0 → 2.0.0):

- Add `BREAKING CHANGE:` in commit body, or
- Add `!` after type: `feat!:` or `fix!:`

### Examples

```bash
# Feature (minor bump)
git commit -m "feat: add support for Bitbucket integration"

# Bug fix (patch bump)
git commit -m "fix: resolve date parsing issue for leap years"

# Breaking change (major bump)
git commit -m "feat!: change API response format

BREAKING CHANGE: The output format has changed from array to object"

# Multiple lines
git commit -m "fix: correct timezone handling

- Fix UTC conversion bug
- Add timezone tests
- Update documentation"
```

### Automated Releases

When you push commits to `main`:

1. **semantic-release** analyzes commit messages
2. Determines the next version based on commit types
3. Updates `package.json` and `CHANGELOG.md`
4. Creates a GitHub release with release notes
5. Publishes to npm automatically

No manual versioning needed - just write good commit messages!

## API Limitations

- **GitHub**: Fetches up to 50 repositories, 100 commits per repository
- **GitLab**: Fetches up to 1000 events and 1000 merge requests per query

For most users, these limits are sufficient. Very active users with thousands of contributions in a single date range may experience incomplete results.

## License

Apache-2.0 License © Felix Anhalt
