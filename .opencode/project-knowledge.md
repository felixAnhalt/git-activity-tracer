# Git Activity Tracer - Project Knowledge

**Last Updated**: 2025-12-19

## Project Purpose

A CLI tool that fetches and displays GitHub activity (commits, pull requests, code reviews) for an authenticated user within a specified date range. It helps developers track and report their contributions across repositories.

## Current Features

### Core Functionality

- **Multi-source Data Collection**: Fetches from both GitHub GraphQL API (commits, PRs, reviews) and Events API (direct pushes)
- **Flexible Date Ranges**: Defaults to current week (Monday to today), accepts custom ranges via `--from` and `--to`
- **Multiple Output Formats**: Console (default, human-readable), JSON, CSV
- **Smart Pagination**: Automatically handles repositories with >100 commits
- **Deduplication**: Removes duplicate contributions across API sources
- **Configurable Base Branches**: Track pushes to specific branches (main, master, develop, etc.)

### Technical Capabilities

- **Cross-platform Configuration**: Stores config at `~/.git-activity-tracer/config.json`
- **Contribution Types**: Tracks commits, pull requests (PRs), and code reviews
- **Rich Metadata**: Includes timestamps, repository names, branch targets, URLs, commit messages
- **Error Handling**: Graceful degradation when API calls fail
- **Date Range Validation**: Handles invalid dates and reversed ranges

## Tech Stack

### Runtime & Language

- **Node.js** ≥18 (ESM modules)
- **TypeScript** 5.9.3 with strict mode enabled

### Dependencies

- **@octokit/rest** (22.0.1): GitHub REST/GraphQL API client
- **yargs** (18.0.0): CLI argument parsing
- **dayjs** (1.11.19): Date manipulation and formatting
- **dotenv** (17.2.3): Environment variable management

### Development Tools

- **Vitest** (4.0.16): Unit and integration testing
- **ESLint** + **Prettier**: Code quality and formatting
- **tsx**: Development runtime

## Target Users

1. **Individual Developers**: Track personal activity for stand-ups, performance reviews, timesheets
2. **Freelancers/Contractors**: Generate activity reports for clients/billing
3. **Team Leads**: Review team member contributions (when running with their tokens)
4. **Open Source Contributors**: Track contributions across multiple projects

## Architecture

### Entry Point

- `src/index.ts`: CLI entry with error handling
- `src/cli/index.ts`: Argument parsing, orchestration, output handling

### Core Components

1. **Connector** (`src/connectors/github.ts`):
   - GitHubConnector class with Octokit integration
   - GraphQL queries for commits, PRs, reviews
   - Events API fallback for direct pushes
   - Automatic pagination for large repositories
   - Deduplication logic

2. **Formatters** (`src/formatters/`):
   - Console: Grouped by date with timestamps
   - JSON: Structured data export
   - CSV: Spreadsheet-compatible format
   - Pluggable formatter interface

3. **Configuration** (`src/configuration.ts`):
   - JSON-based user configuration
   - Default base branches: main, master, develop, development
   - Auto-creation of config file on first run

4. **Utilities** (`src/utils.ts`):
   - Date range parsing
   - Current week calculation (Monday to today)

### Data Flow

1. Parse CLI arguments → Load configuration
2. Authenticate with GitHub → Get user login
3. Fetch GraphQL contributions (commits, PRs, reviews)
4. Fetch Events API data (push events)
5. Extract, filter, deduplicate contributions
6. Format output (console/JSON/CSV)
7. Display or write to file

## Testing Strategy

- **Unit Tests**: Formatters, date parsing, connector logic with mocks
- **Integration Tests**: End-to-end CLI execution
- **Test Coverage**: Core logic, error handling, edge cases

## Current Limitations

- Single user only (authenticated user)
- GitHub-only (no GitLab, Bitbucket, etc.)
- GraphQL API limits: 100 items per page, 50 repositories max
- Events API: Last 90 days, 300 events max
- No filtering by repository or contribution type
- No aggregation/statistics (just raw list)
- No caching (re-fetches on every run)
- Console output is plain text (no colors, icons)

## Extension Points

1. **New Connectors**: GitLab, Bitbucket connectors following same interface
2. **New Formatters**: HTML, Markdown, custom templates
3. **New Filters**: Repository whitelist/blacklist, contribution type filtering
4. **Configuration**: More customization options (timezone, output templates)
5. **Analytics**: Statistics, charts, trends
