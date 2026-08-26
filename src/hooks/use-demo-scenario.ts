"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "before-buy:demo-scenario";

/**
 * "3개월 후 보기" 토글 상태. `sessions.demo_offset_days`를 흉내내는 클라이언트
 * 전용 값 — localStorage에 지속하되(기술스펙 7장), 서버 상태와는 무관하다.
 */
export function useDemoScenario() {
  const [isFuture, setIsFuture] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // 서버 렌더와 첫 클라이언트 렌더를 맞추기 위해 localStorage 값은 마운트 후에만 반영한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFuture(window.localStorage.getItem(STORAGE_KEY) === "future");
    } catch {
      // localStorage 접근 불가 (프라이빗 모드 등) — 기본값(현재)으로 둔다.
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setIsFuture((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "future" : "current");
      } catch {
        // 저장 실패해도 세션 내 상태는 유지된다.
      }
      return next;
    });
  }, []);

  return { isFuture, toggle, hydrated };
}
