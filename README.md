# GitHub Activity CLI

Fetch commits, PRs, and reviews for a given authenticated user.

## Usage

```bash
GH_TOKEN=xxx npx ts-node src/index.ts --from 2025-01-01 --to 2025-01-02
```

## Flags

- `--from` (default: today)
- `--to` (default: today)
- `--with-links` (include URLs)
```
