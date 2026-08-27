# 0011. 시세 쿼리는 재시도하지 않는다 — 배경 탭에서 React Query의 재시도는 무한정 멈춘다

## Status

Accepted (#83). #82가 넣은 방어의 근거를 확정하고, 그 이슈에 적어둔 **원인 가설을
반증한다.**

## Context

#82의 증상은 이랬다. `loadWatchlistQuotes`가 던지게 만들면 S1의 시세 쿼리가 영원히
`pending`에 머물고, 화면은 아무 피드백 없이 skeleton만 그린다. 재시도도 `error` 전이도
없다.

거기서 세운 가설은 **"Server Action이 실패해도 클라이언트 promise가 reject되지 않는다"**
였다. 서버는 500을 돌려주고 예외도 기록하는데 클라이언트에는 리젝션이 도착하지 않는
것처럼 보였고, 재시도가 로드당 1건뿐이라는 관측이 그 해석을 뒷받침했다. 용의자는
Next의 Server Action 처리 또는 React의 Flight 클라이언트로 좁혀졌고, React Query는
"리젝션을 받지 못했다"는 이유로 용의선상에서 빠졌다.

**그 가설은 틀렸다.** 최소 재현으로 반증된다.

- React Query를 거치지 않고 버튼 하나에서 던지는 액션을 그냥 `await`하면
  **32~45ms 만에 정상적으로 reject된다** — `Error` / 메시지 / `digest`까지 온다.
- 같은 방식으로 **`loadWatchlistQuotes` 자기 자신**을 부른 경우에도 32ms에 reject된다.
  액션이나 그 모듈에 특별한 것은 없다.

Flight 계층은 멀쩡하다. 다른 것은 **호출 맥락**이었다.

실제 원인은 React Query의 retryer에 있다.

```ts
// @tanstack/query-core/src/retryer.ts
const canContinue = () =>
  focusManager.isFocused() &&
  (config.networkMode === 'always' || onlineManager.isOnline()) &&
  config.canRun()
...
sleep(delay)
  // Pause if the document is not visible or when the device is offline
  .then(() => (canContinue() ? undefined : pause()))
```

`focusManager.isFocused()`는 `document.visibilityState !== 'hidden'`이다. 즉 **문서가
숨겨져 있으면 재시도는 지연 후 그 자리에서 멈추고, 탭이 다시 보일 때까지 재개되지
않는다.** 쿼리는 `pending`에 남고, 재시도가 없으니 요청도 더 나가지 않는다 — #82가
관측한 "로드당 정확히 1건"이 바로 이것이다. 리젝션을 못 받은 게 아니라, **받고 나서
멈춰 선 것**이다.

실측으로 확인했다. #82 이전 코드를 그대로 되돌리고 던지게 한 뒤 배경 탭에서 40초를
기다리면 skeleton 10개가 그대로다. 그 상태에서 문서를 `visible`로 바꿔 주면 그 즉시
풀린다 — 요청 2건 → 6건, skeleton 10개 → 0개, "시세 조회 실패" 4건.

관측이 전부 배경 탭에서 이뤄졌다는 것이 #82와 #83이 함께 빗나간 지점이다.

## Decision

- **시세 쿼리는 `retry: false`다.** 재시도가 없으면 멈출 것도 없다. 이것이 배경 탭에서도
  쿼리가 결판나게 하는 유일한 조건이다 — 타임아웃만으로는 넘지 못한다. 타임아웃이 만든
  리젝션 역시 재시도 대상이 되어 같은 자리에서 멈추기 때문이다.
- **10초 타임아웃은 유지한다** (`withTimeout`, `lib/query/with-timeout.ts`). 재시도를 껐어도
  **응답이 아예 오지 않는** 경우 — 인프라 크래시, 직렬화 실패 — 는 여전히 리젝션을
  만들지 못한다. 타임아웃은 그쪽을 맡는다.
- **`loadWatchlistQuotes`는 던지지 않는다.** 잡을 수 있는 실패를 종목별 `null`로 접어
  값으로 돌려준다. 리젝션을 애초에 만들지 않는 것이 가장 싼 방어다.
- **Next에도 React에도 업스트림 이슈를 내지 않는다.** 버그가 아니고, 재시도를 멈추는
  쪽도 의도된 동작이다(위 소스 주석이 그렇게 말한다).

## Consequences

- **#82의 실사용 영향은 원래 평가보다 낮다.** 사용자가 탭을 보고 있으면 재시도는
  정상적으로 돌고 쿼리는 몇 초 안에 `failed`로 결판난다. "무한 skeleton"은 탭이 배경에
  있을 때의 이야기이며, 그때조차 돌아오는 순간 풀린다. 그래도 방어는 유지한다 — 돌아온
  사용자가 이미 결판난 화면을 보는 편이 낫고, 응답이 오지 않는 경우는 여전히 남는다.
- **"영원히 pending"을 다시 보면 retryer의 pause를 먼저 의심한다.** 그 다음이 네트워크,
  마지막이 프레임워크다. 배경 탭에서 관측하고 있는지부터 확인한다 — 자동화로 재현할 때
  특히 그렇다. `document.visibilityState`는 관측 도구가 아니라 **관측 조건**이다.
- **다른 쿼리에는 이 규칙을 자동으로 확장하지 않는다.** `searchStocksAction`은 사용자가
  보고 있는 동안에만 도는 쿼리라 pause가 실질적 문제를 만들지 않는다. 그쪽은 액션이
  던지지 않는 것으로 충분하며, 해당 주석에 그 사정을 적어뒀다.
- ADR-0002(목록 60초 / 시세 20초)의 `staleTime`은 그대로다. 재시도를 껐어도 다음
  자연스러운 재검증이 곧 다시 시도한다.
