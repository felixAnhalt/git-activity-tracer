# GitHub Activity CLI

Fetch commits, PRs, and reviews for a given authenticated user from GitHub.

## Features

- Fetches commits, pull requests, and code reviews
- Supports multiple output formats: console (default), JSON, CSV
- Automatic pagination for repositories with more than 100 commits
- Configurable base branches for tracking push events
- Cross-platform configuration file support

## Setup

1. Create a `.env` file in the project root with your GitHub token:

   ```bash
   GH_TOKEN=your_github_token_here
   ```

2. Get a GitHub personal access token from https://github.com/settings/tokens

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
