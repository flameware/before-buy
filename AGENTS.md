## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label strings equal to their names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### 제품 명세

`docs/prd/` — `화면명세.md`(화면별 구성·문구·상태), `기술스펙.md`(아키텍처·데이터 모델·외부 연동),
`프롬프트 명세.md`(LLM 프롬프트). 코드 주석은 이 셋을 파일명이나 장 번호로만 가리킨다("기술스펙 7장",
"화면명세 S5").

**화면을 고치면서 명세도 고쳤다면 같은 커밋에 담는다** — 문서와 코드가 다른 속도로 흐르면, 명세를 읽어
작업하는 다음 에이전트가 그 간극을 그대로 잘못된 작업으로 옮긴다(#99). 세 문서 모두 추적 대상이다.

명세와 `CONTEXT.md`·`docs/adr/`가 어긋나면 **ADR이 이긴다** — 명세는 만들기 전에 쓴 것이고 ADR은
만들면서 뒤집은 결정이다(예: ADR-0009가 `화면명세.md` S5의 "매도 검토 버튼은 뺐습니다"를 대체한다).

### Tests

`bun run test` (vitest, node 환경 — 지켜보며 돌리려면 `bun run test:watch`). 순수 함수만 대상이며 테스트는 대상 파일 옆에
`*.test.ts`로 둔다. 범위와 이유는 `docs/adr/0006-vitest-for-pure-function-tests.md`.

### 페이지 모듈과 DB

페이지 모듈(`page.tsx`)은 `src/lib/db/`에 닿는 모듈을 **최상단에서 임포트하지 않는다.** Next가 빌드 때
라우트 설정을 모으며 페이지 모듈을 평가하는데, 그 순간 `db/index.ts`의
`neon(process.env.DATABASE_URL!)`이 함께 실행되어 `DATABASE_URL`이 없는 Vercel 프리뷰 빌드가
`Failed to collect configuration for ...`로 죽는다 (#96). 서버에서 DB를 읽어야 하면 동적
임포트(`await import(...)`)로 평가를 요청 시점까지 미루거나, S5(`stocks/[id]`)처럼 조회를 Server
Action에 맡긴다 — 라우트가 `ƒ`(dynamic)이면 어느 쪽이든 판정은 매 요청 서버에서 이뤄진다.

**로컬 빌드는 통과한다.** `.env.local`에 `DATABASE_URL`이 있어서 이 실패는 프리뷰에서만 드러난다.
페이지에서 서버 데이터를 읽었다면 머지 전에 확인한다:

```
mv .env.local .env.local.bak && bun run build; mv .env.local.bak .env.local
```

### LLM experiments

Paid API calls that compare conditions — models, prompts, parameters, output modes — bill per call and multiply fast. Read `docs/agents/llm-experiments.md` before running any of them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
