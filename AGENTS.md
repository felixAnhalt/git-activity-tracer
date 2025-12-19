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
- Prefer arrow functions; use `const` over `let` where possible
- Async/await: always use `async`/`await` over `.then()`;
- Use classes when encapsulating state/behavior or implementing interfaces; use pure functions for stateless logic
- Error handling: handle async errors with `try/catch`; avoid silent catches
- Imports order: external → internal → relative; run `pnpm run format` before commits
- No abbreviations: write full words (for example: `item` not `it`, `configuration` not `config`, `repository` not `repo`)

Agents & rules:

- **For bug reports**, invoke `@bug-hunter` to investigate and fix bugs by finding root causes, not just symptoms. The bug hunter will trace the issue, identify the underlying problem, and implement a proper fix.
- **Start each feature** by invoking `@architect` to plan the implementation: identify files to change, steps to take, and potential issues.
- **After making major code changes**, automatically invoke `@code-reviewer` to review modified changes for quality, correctness, security, and best practices.
- **After code review passes**, automatically invoke `@quality-assurance` to run tests (`pnpm test`), lint (`pnpm run lint`), and build (`pnpm build`) — all must pass before the task is complete.
- **Never skip QA** — always run quality-assurance after code changes, even for small changes.
- If you need to search the codebase for patterns or understand architecture, use `@explore` for fast file/code searches.
- **Never document something if not explicitly asked** — only provide documentation when requested.
