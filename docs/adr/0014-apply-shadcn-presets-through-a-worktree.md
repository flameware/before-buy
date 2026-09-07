# 0014. shadcn 프리셋은 워크트리에서 돌리고 `globals.css`만 가져온다

## Status

Accepted. ADR-0001의 "Any future preset change goes through this same review:
run `init`, diff, confirm, commit" 절차를 대체한다.

## Context

ADR-0001은 프리셋을 바꿀 때 본 트리에서 `shadcn init --preset <id>`를 돌리고
diff를 검토하는 절차를 정했다. 그때는 안전했다 — `ui/*`가 갓 생성된 상태라
덮어써도 잃을 것이 없었다.

그 사이 `ui/*`에 손으로 쓴 것이 쌓였다: `button.tsx`의 `buy`/`sell` variant와
48px `lg` 사이즈, `toast.tsx`(주석 25줄), `skeleton.tsx`의 `--muted` 우회,
`alert-dialog.tsx`의 곡률 처리. 전부 이유가 주석으로 남아 있는 결정들이다.

팔레트를 라임으로 바꾸며 `--preset b7Br8OViy`를 실행해 확인했다 — `init`은
**`ui/*` 13개 파일 전부와 `src/lib/utils.ts`, `package.json`, `components.json`을
덮어썼다.** 색 32개를 받으려고 실행한 명령이 그 열 배의 것을 가져온다.
"diff를 보고 확인한다"는 절차는 이 규모에서 지켜지지 않는다: 되돌려야 할 것이
많을수록, 되돌리는 것을 잊은 하나가 조용히 통과한다.

## Decision

- 프리셋은 **격리된 `git worktree`에서 실행한다.** 본 트리에서 `init`을 돌리지
  않는다.
- 워크트리 결과에서 **`globals.css`의 `:root`/`.dark` 블록과 `components.json`만**
  본 트리로 가져온다. `ui/*`, `lib/utils.ts`, `package.json`은 가져오지 않는다.
- 프리셋이 색 외에 들고 오는 것(`--radius`, `--font-heading`, 의존성 교체)은
  **자동으로 받지 않는다.** 색과 다른 축의 결정이므로 각각 따로 판단하고,
  받기로 했다면 색과 분리된 커밋으로 넣는다.

## Consequences

- 프리셋이 개선한 `ui/*` 코드는 자동으로 못 받는다. 필요하면 워크트리 diff를
  읽고 손으로 옮긴다 — 이쪽이 옳은 방향의 비용이다. 잃는 것이 "받지 못한 개선"이지
  "덮어써진 결정"이 아니다.
- 워크트리에는 `node_modules` 심볼릭 링크가 필요하다. `init`이 의존성 설치를
  시도하기 때문이다.
- 검토가 끝나면 워크트리를 지운다(`git worktree remove`).
