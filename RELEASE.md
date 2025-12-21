# Release Guide

This project uses **semantic-release** for fully automated versioning, changelog generation, and npm publishing.

## How It Works

When you push commits to `main`, the GitHub Action automatically:

1. ✅ Analyzes commit messages (using Conventional Commits)
2. ✅ Determines the next version number
3. ✅ Updates `package.json` version
4. ✅ Generates/updates `CHANGELOG.md`
5. ✅ Creates a Git tag
6. ✅ Creates a GitHub release with notes
7. ✅ Publishes to npm

**No manual versioning needed!** Just write proper commit messages.

---

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types & Version Bumps

| Type               | Description             | Version Bump              | Example                         |
| ------------------ | ----------------------- | ------------------------- | ------------------------------- |
| `fix:`             | Bug fix                 | **Patch** (1.0.0 → 1.0.1) | `fix: resolve timezone issue`   |
| `feat:`            | New feature             | **Minor** (1.0.0 → 1.1.0) | `feat: add Bitbucket support`   |
| `BREAKING CHANGE:` | Breaking change         | **Major** (1.0.0 → 2.0.0) | See below                       |
| `docs:`            | Documentation           | No release                | `docs: update README`           |
| `style:`           | Code style/formatting   | No release                | `style: fix linting errors`     |
| `refactor:`        | Code refactoring        | No release                | `refactor: simplify date logic` |
| `perf:`            | Performance improvement | **Patch** (1.0.0 → 1.0.1) | `perf: optimize API calls`      |
| `test:`            | Tests                   | No release                | `test: add timezone tests`      |
| `chore:`           | Maintenance             | No release                | `chore: update dependencies`    |
| `ci:`              | CI/CD changes           | No release                | `ci: add test coverage`         |

### Breaking Changes (Major Version Bump)

Add `!` after type **or** include `BREAKING CHANGE:` in footer:

```bash
# Method 1: Add ! after type
git commit -m "feat!: change API response format"

# Method 2: Add BREAKING CHANGE in footer
git commit -m "feat: change API response format

BREAKING CHANGE: Output format changed from array to object.
Update your code to access data.results instead of data[0]."
```

---

## Commit Examples

### Patch Release (1.0.0 → 1.0.1)

```bash
git commit -m "fix: correct date parsing for leap years"

git commit -m "fix: handle empty repository list

- Add null check for repository response
- Return empty array instead of throwing
- Add test coverage"
```

### Minor Release (1.0.0 → 1.1.0)

```bash
git commit -m "feat: add support for GitLab self-hosted instances"

git commit -m "feat: add CSV export format

- Implement CSV formatter
- Add --output csv flag
- Include tests and documentation"
```

### Major Release (1.0.0 → 2.0.0)

```bash
git commit -m "feat!: change configuration file format

BREAKING CHANGE: Configuration file moved from .env to config.json.
Migrate your settings using: git-activity-tracer migrate-config"
```

### No Release

```bash
git commit -m "docs: update installation instructions"
git commit -m "test: add integration tests for GitHub connector"
git commit -m "chore: update dependencies"
git commit -m "style: fix eslint warnings"
```

---

## Release Workflow

### 1. Make Your Changes

```bash
git checkout -b feature/my-awesome-feature
# Make code changes
pnpm test
pnpm run lint
```

### 2. Commit With Proper Message

```bash
# Choose the appropriate type
git commit -m "feat: add my awesome feature"
```

### 3. Push to Main (or merge PR)

```bash
git checkout main
git merge feature/my-awesome-feature
git push origin main
```

### 4. Automation Happens! 🎉

The GitHub Action (`.github/workflows/release.yml`) will:

- Run tests ✅
- Analyze commits 📝
- Bump version automatically 📈
- Update CHANGELOG.md 📋
- Create GitHub release 🏷️
- Publish to npm 📦

### 5. Check the Results

- **GitHub Releases**: https://github.com/felixAnhalt/git-activity-tracer/releases
- **npm Package**: https://www.npmjs.com/package/@tmegit/git-activity-tracer
- **Changelog**: See `CHANGELOG.md` in repository

---

## First Release Setup

### One-Time Configuration

1. **Create npm account**: https://www.npmjs.com/signup

2. **Generate npm token** (Automation type):
   - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → "Automation"
   - Copy the token

3. **Add npm token to GitHub**:
   - Go to: https://github.com/felixAnhalt/git-activity-tracer/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

4. **Make your first release**:

   ```bash
   git commit -m "feat: initial release

   - Multi-platform support (GitHub, GitLab)
   - Multiple output formats (console, JSON, CSV)
   - Project ID mapping for time tracking"

   git push origin main
   ```

5. **Watch the magic happen**:
   - Go to: https://github.com/felixAnhalt/git-activity-tracer/actions
   - Watch the "Release" workflow run
   - Check the new release and npm publish

---

## Troubleshooting

### No Release Created

**Cause**: No commits with `feat:` or `fix:` since last release.

**Solution**: Make sure at least one commit uses a release-triggering type.

### npm Publish Failed

**Cause**: `NPM_TOKEN` not configured or invalid.

**Solution**:

1. Generate a new Automation token from npm
2. Update the GitHub secret

### Build Failed

**Cause**: Tests or linting errors.

**Solution**: Fix the errors before pushing:

```bash
pnpm test
pnpm run lint
pnpm run build
```

---

## Manual Release (Emergency)

If automated release fails, you can release manually:

```bash
npm login
pnpm run lint && pnpm test && pnpm run build
npm version patch  # or minor, or major
git push && git push --tags
npm publish --access public
```

---

## Tips

✅ **DO**: Write clear, descriptive commit messages  
✅ **DO**: Use proper conventional commit types  
✅ **DO**: Test locally before pushing  
✅ **DO**: Squash related commits in PRs

❌ **DON'T**: Use `git commit -m "update"` or vague messages  
❌ **DON'T**: Push breaking changes without `BREAKING CHANGE:` footer  
❌ **DON'T**: Manually edit package.json version (automation handles it)  
❌ **DON'T**: Create manual Git tags (automation handles it)

---

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
