## [1.0.1](https://github.com/felixAnhalt/git-activity-tracer/compare/v1.0.0...v1.0.1) (2025-12-21)


### Bug Fixes

* **tests:** add trailing space to URL log output for consistency ([#6](https://github.com/felixAnhalt/git-activity-tracer/issues/6)) ([96738a7](https://github.com/felixAnhalt/git-activity-tracer/commit/96738a7049cba14d6ccdc851102fd33b31c64823))

# 1.0.0 (2025-12-21)


### Bug Fixes

* **docs:** update README to correct command syntax and improve clarity ([3283043](https://github.com/felixAnhalt/git-activity-tracer/commit/3283043dd3535a6591d77d3396a7bd644e057647))


### Features

* **cli:** refactor cli ([9bc2881](https://github.com/felixAnhalt/git-activity-tracer/commit/9bc2881ee0ebfca816238229f9391d6292ee6648))
* **tests:** add integration tests for CLI and formatter functionality ([f284307](https://github.com/felixAnhalt/git-activity-tracer/commit/f2843071ed0482f0e7f282b4cc1d64f917568d54))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-12-21

### Added

- Initial beta release of Git Activity Tracer
- Multi-platform support for GitHub and GitLab
- Fetch commits, pull/merge requests, and code reviews
- Multiple output formats: Console, JSON, and CSV
- Project ID mapping for billing and time tracking
- Configurable base branches
- Smart pagination for fetching contributions
- Environment variable configuration for platform tokens
- CLI interface with date range filtering
- Support for self-hosted GitLab instances
- Automatic platform detection based on available tokens
- Cross-platform contribution deduplication
- Configuration file at `~/.git-activity-tracer/config.json`
- Comprehensive test suite with 94 tests
- Support for running via npm, npx, or local installation

### Features

- `--from` and `--to` flags for date range filtering (defaults to current week)
- `--output` flag for format selection (console, json, csv)
- `--with-links` flag to include URLs in console output
- `config` command to display configuration file location
- `project-id` command for managing repository project ID mappings
- Automatic weekly date range calculation (Monday to today)
- Node.js 18+ support

[0.0.1]: https://github.com/felixAnhalt/git-activity-tracer/releases/tag/v0.0.1
