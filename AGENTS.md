## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label strings equal to their names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Tests

`bun run test` (vitest, node 환경 — 지켜보며 돌리려면 `bun run test:watch`). 순수 함수만 대상이며 테스트는 대상 파일 옆에
`*.test.ts`로 둔다. 범위와 이유는 `docs/adr/0006-vitest-for-pure-function-tests.md`.

### LLM experiments

Paid API calls that compare conditions — models, prompts, parameters, output modes — bill per call and multiply fast. Read `docs/agents/llm-experiments.md` before running any of them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
