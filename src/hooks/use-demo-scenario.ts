"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoScenario } from "@/lib/mock/types";

const STORAGE_KEY = "before-buy:demo-scenario";

/**
 * "3개월 후 보기" 토글이 고르는 **데모 시점**(CONTEXT.md). localStorage에 지속하되
 * 서버 상태와는 무관하다 — 서버는 조회 인자로 받을 뿐 기억하지 않는다(기술스펙 7장).
 *
 * 불리언이 아니라 이름 있는 값인 이유는 이 값이 화면 필터가 아니라 전제 판정의
 * 입력이기 때문이다(ADR-0004).
 */
export function useDemoScenario() {
  const [scenario, setScenario] = useState<DemoScenario>("current");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // 서버 렌더와 첫 클라이언트 렌더를 맞추기 위해 localStorage 값은 마운트 후에만 반영한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScenario(window.localStorage.getItem(STORAGE_KEY) === "future" ? "future" : "current");
    } catch {
      // localStorage 접근 불가 (프라이빗 모드 등) — 기본값(현재)으로 둔다.
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setScenario((prev) => {
      const next: DemoScenario = prev === "future" ? "current" : "future";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 저장 실패해도 세션 내 상태는 유지된다.
      }
      return next;
    });
  }, []);

  return { scenario, toggle, hydrated };
}
