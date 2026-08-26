"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "before-buy:recent-stocks";
const MAX_RECENT = 5;

/** S1.5 "최근 본 종목" — 검색에서 선택한 종목 티커를 최신순으로 최대 5개 저장. */
export function useRecentStocks() {
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTickers(JSON.parse(raw));
      }
    } catch {
      // localStorage 접근 불가 (프라이빗 모드 등) — 빈 목록으로 둔다.
    }
  }, []);

  const addRecent = useCallback((ticker: string) => {
    setTickers((prev) => {
      const next = [ticker, ...prev.filter((t) => t !== ticker)].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 세션 내 상태는 유지된다.
      }
      return next;
    });
  }, []);

  return { tickers, addRecent };
}
