"use client";

import { useCallback, useEffect, useState } from "react";
import { findDemoStock } from "@/lib/mock/demo-whitelist";
import type { Stock } from "@/lib/mock/types";

const STORAGE_KEY = "before-buy:recent-stocks";
const MAX_RECENT = 5;

/** 최근 본 종목으로 저장하는 최소 정보. 화면이 그리는 데 필요한 만큼만 담는다. */
export type RecentStock = Pick<Stock, "ticker" | "name" | "sector">;

/**
 * 저장 형식이 `string[]`(티커만)에서 `RecentStock[]`으로 바뀌었다 (#92).
 *
 * 예전에는 티커만 두고 `findStock`으로 이름을 되찾을 수 있었지만, 검색 대상이 상장 종목
 * 전체가 되면서 이름은 서버(종목 마스터)에만 있다. 최근 본 종목 5개를 그리자고 서버를
 * 왕복할 이유가 없으므로 이름을 함께 저장한다.
 *
 * 옛 형식이 남아 있는 브라우저를 위해 `string[]`도 읽어들인다. 이 변경 전에는 검색 대상이
 * 데모 화이트리스트 27종뿐이었으므로 **옛 형식으로 저장된 티커는 반드시 화이트리스트 안에
 * 있다** — 거기서 이름을 되찾을 수 있다. 혹시 못 찾으면 그 항목은 버린다: 이름 자리에
 * 티커를 넣으면 "005380 005380" 같은 줄이 화면에 남는다.
 */
function parseStored(raw: string): RecentStock[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): RecentStock[] => {
    if (typeof entry === "string") {
      const demo = findDemoStock(entry);
      return demo ? [{ ticker: demo.ticker, name: demo.name, sector: demo.sector }] : [];
    }
    if (entry && typeof entry === "object") {
      const { ticker, name, sector } = entry as Partial<RecentStock>;
      if (typeof ticker === "string" && typeof name === "string") {
        return [{ ticker, name, sector: typeof sector === "string" ? sector : undefined }];
      }
    }
    return [];
  });
}

/** S1.5 "최근 본 종목" — 검색에서 선택한 종목을 최신순으로 최대 5개 저장. */
export function useRecentStocks() {
  const [stocks, setStocks] = useState<RecentStock[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStocks(parseStored(raw));
      }
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등)이거나 저장된 값이 깨짐 — 빈 목록으로 둔다.
    }
  }, []);

  const addRecent = useCallback((stock: RecentStock) => {
    setStocks((prev) => {
      const next = [stock, ...prev.filter((s) => s.ticker !== stock.ticker)].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 세션 내 상태는 유지된다.
      }
      return next;
    });
  }, []);

  return { stocks, addRecent };
}
