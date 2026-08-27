"use client";

import { useEffect, useRef } from "react";
import { useToastManager } from "@/components/ui/toast";

/**
 * **변동 요약**(CONTEXT.md)을 띄운다. `달라짐` 종목 수가 **0에서 N으로 올라가는 순간**에만
 * 발화한다 — 토글 On도, 담기 직후 복귀도, 최초 로딩 완료도 이 규칙 하나로 덮인다(#103).
 *
 * 0→N으로 좁힌 이유는 시세가 늦게 도착해 개수가 2→3처럼 올라가는 재발화를 막기 위해서다.
 * 로딩 중에는 개수가 0이므로 로딩 완료가 곧 0→N이고, 토글을 껐다 켜면 0을 거쳐 다시 뜬다.
 */
export function useChangeSummaryToast(numChanged: number) {
  const toastManager = useToastManager();
  const previousRef = useRef(0);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = numChanged;
    if (previous === 0 && numChanged > 0) {
      toastManager.add({ title: `${numChanged}개 종목에서 달라진 점이 있어요` });
    }
  }, [numChanged, toastManager]);
}
