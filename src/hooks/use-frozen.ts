"use client";

import { useState } from "react";

/**
 * `settled`가 참이 된 뒤 처음 들어온 non-null 값을 래치하고, 이후 갱신을 무시한다.
 * 래치 전에는 들어온 값을 그대로 통과시킨다 — 화면이 비지 않게 하기 위해서다.
 *
 * ADR-0005: S4 주문 전 확인은 목록이 아니라 결정 지점이라, 사용자가 읽은 숫자와 누른
 * 버튼이 가리키는 숫자가 같아야 한다. 그래서 시세를 한 번 재확인한 뒤 그 값에 고정한다.
 * `settled`가 필요한 이유가 여기 있다 — 그냥 첫 non-null을 잡으면 재확인 이전의 캐시
 * 값(S1을 열어둔 시간만큼 오래됐을 수 있다)에 고정되어 버린다.
 *
 * 고정은 데이터 합성과 직교하는 "시간에 대한 정책"이므로 `useWatchlistItemView`의
 * 옵션으로 달지 않는다 — 옵션 하나가 훅의 의미를 바꾸는 플래그가 되기 때문.
 */
export function useFrozen<T>(value: T | null | undefined, settled: boolean): T | null {
  // 렌더 중 자기 상태를 조정하는 React의 표준 패턴. effect로 옮기면 고정되지 않은 값이
  // 한 프레임 먼저 그려졌다가 바뀌는데, 그게 정확히 이 훅이 막으려는 일이다.
  const [frozen, setFrozen] = useState<T | null>(null);
  if (frozen === null && settled && value != null) {
    setFrozen(value);
  }
  return frozen ?? value ?? null;
}
