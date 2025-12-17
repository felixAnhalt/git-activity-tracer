AGENTS.md — Repo agent guidance

Build / run / install:

- `pnpm install`; `pnpm start` → `ts-node src/index.ts`; `pnpm build` → `tsc` (outputs `dist/`)

Tests / single-test:

- `vitest` configured: all `pnpm test`; single: `pnpm test -- -t "pattern"` or `pnpm exec vitest run test/parseRange.spec.ts`; watch: `pnpm run test:watch`

Lint / format:

- `pnpm run lint` → `eslint 'src/**/*.ts'`; `pnpm run format` → `prettier --write 'src/**/*.ts'`

Code style (for agents):

- Use ESM imports; prefer named exports; avoid default except CLI entry
- `tsconfig.json` `strict: true`; prefer explicit types; avoid `any`
- Naming: `camelCase` for vars/funcs, `PascalCase` for types/classes, `UPPER_SNAKE` for constants
- Error handling: handle async errors with `try/catch`; avoid silent catches
- Imports order: external → internal → relative; run `pnpm run format` before commits
- No abbreviations: write full words (for example: `item` not `it`, `configuration` not `config`, `repository` not `repo`)

Agents & rules:

- Start any task with the architect `@architect`. End each task with the Code Reviewer: `@code-reviewer` and then the QA subagent: `@quality-assurance`.
