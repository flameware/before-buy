# 0006. 테스트는 vitest로, 우선 순수 함수만 잠근다

## Status

Accepted.

## Context

저장소에 테스트가 하나도 없었다. 그 비용이 같은 자리에서 두 번 드러났다.

- **#79** — 시세 **조회 중**에 자동 전제가 전부 `pending`이 되면서, "달라짐"이어야 할
  배지가 1~2초간 "유지 중"으로 보였다.
- **#81** — 시세 **조회 실패** 시 같은 증상이, 이번에는 S1 헤더·S4·S5까지 네 화면에서.

둘 다 (배지 상태 × 시세 상태) 조합 하나를 빠뜨려 생긴 결함이고, 둘 다 순수 함수의
입력 조합 문제이며, 둘 다 **사람 눈으로** 발견됐다. 조합 테이블을 표로 적어두면 잡히는
종류다.

반면 이 프로토타입의 나머지는 테스트를 붙일 근거가 약하다. 화면은 아직 자주 흔들리고,
DB·KIS·LLM 경계는 실제 자격증명 없이는 의미 있는 검증이 어렵다.

## Decision

- **vitest**를 도입한다. Vite 위에서 도는 표준 선택이고, 설정 파일 하나(`vitest.config.mts`)와
  경로 별칭만으로 이 저장소에서 돌아간다. `bun run test`가 진입점이다.
- **환경은 node 기본값**을 쓴다. jsdom도 React Testing Library도 들이지 않는다.
- **첫 대상은 순수 함수뿐이다** — 시세·전제·배지가 만나는 계산:
  `resolvePremises` / `hasAutoPremise` / `parseCheckConfig`(`lib/premises/engine.ts`),
  `composeView`(`lib/watchlist/compose-view.ts`),
  `settledQuote` / `snapshotOf`(`lib/quote/quote-state.ts`),
  `badgeState` / `badgeLabel` / `changedCount` / `splitByStatus`(`lib/mock/index.ts`).
- 테스트는 **대상 파일 옆에** `*.test.ts`로 둔다.
- CI(GitHub Actions)에서 `lint` / `typecheck` / `test`를 돌린다. `next build`는 넣지
  않는다 — 자격증명이 필요하고, 이 워크플로가 잡으려는 결함을 빌드가 잡아주지 않는다.

## Consequences

- `composeView`가 `hooks/use-watchlist-view.ts`에서 `lib/watchlist/compose-view.ts`로
  옮겨졌다. 그 훅은 Server Action을 임포트해 서버 전용 모듈을 끌고 오므로 node 환경에서
  임포트할 수 없었다. **테스트 대상 순수 함수는 서버 전용 모듈과 분리된 자리에 산다** —
  이 도입이 강제하는 유일한 구조적 제약이다.
- 컴포넌트·훅 테스트는 **아직 없다.** 필요해지는 시점에 jsdom + RTL을 추가한다.
  화면 문구("시세 조회 실패" 같은)는 여전히 잠기지 않는다.
- `badgeState`는 시세 상태를 보지 않으므로 `pending` 전제만 있어도 "유지 중"을 돌려준다.
  화면이 시세 상태를 함께 봐야 한다는 뜻이고, 그 판단을 `badgeDisplay` 한 함수로 모으는
  일은 #81이 맡는다. **#81이 끝나면 그 조합 테이블(배지 3상태 × 시세 3상태)을 여기에
  이어 붙인다** — 이미 두 번 난 버그의 회귀는 그때 잠긴다. 그때 `badgeState`가
  `lib/mock/`에서 `lib/premises/`로 옮겨가므로 테스트 파일도 함께 따라간다. 현재
  `index.test.ts`의 "[#81이 뒤집을 현 동작]" 테스트는 그 시점에 의도대로 빨개진다 —
  지우고 조합 테이블로 갈아끼우는 것이 정답이다.
