"use client";

import { useEffect } from "react";
import { useToastManager } from "@/components/ui/toast";
import type { DemoScenario } from "@/lib/mock/types";
import { nextChangeSummary, type ChangeSummaryMark } from "@/lib/watchlist/change-summary";

/**
 * 변동 요약 토스트는 **하나뿐이다.** 같은 id로 add하면 Base UI가 새로 쌓지 않고 그 자리에서
 * 갱신하며 자동 소멸 타이머만 다시 센다 — 토글을 빠르게 여러 번 눌러도 토스트가 나란히
 * 늘어서지 않는다(#103 후속). 개수가 바뀌면 같은 자리의 문구가 바뀐다.
 */
const CHANGE_SUMMARY_TOAST_ID = "change-summary";

/**
 * 이 세션에서 이미 말한 개수. **모듈 스코프인 것이 이 값의 핵심이다** — S1이 언마운트되어도
 * 남아야 화면을 떠났다 오는 왕복이 조용하다(#134). 새로고침에는 사라지고, 그때는 다시
 * 말하는 것이 맞다: 사용자가 처음 보는 화면이다.
 */
let mark: ChangeSummaryMark | null = null;

/**
 * **변동 요약**(CONTEXT.md)을 띄운다. 발화 조건은 `nextChangeSummary`가 순수 함수로 갖는다 —
 * 여기서는 로딩 프레임을 걸러 넘기고, 결과를 토스트로 옮기는 일만 한다.
 *
 * `ready`가 거짓인 프레임을 넘기지 않는 이유: 하이드레이션 전에는 `scenario`가 아직
 * `current`인데 두 쿼리의 `enabled: false`는 페치만 막지 캐시 읽기는 막지 않아, 그 프레임의
 * 개수는 사용자가 보고 있지 않은 시점의 것이다.
 */
export function useChangeSummaryToast(
  scenario: DemoScenario,
  numChanged: number,
  ready: boolean
) {
  const toastManager = useToastManager();

  useEffect(() => {
    if (!ready) return;
    const next = nextChangeSummary(mark, scenario, numChanged);
    mark = next.mark;
    if (next.announce) {
      toastManager.add({
        id: CHANGE_SUMMARY_TOAST_ID,
        title: `${numChanged}개 종목에서 달라진 점이 있어요`,
      });
    }
  }, [scenario, numChanged, ready, toastManager]);
}
