"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader } from "@/components/layout/screen-header";
import { useDebounced } from "@/hooks/use-debounced";
import { useRecentStocks, type RecentStock } from "@/hooks/use-recent-stocks";
import { searchStocksAction } from "@/app/actions";
import { popularStocks } from "@/lib/mock";

/**
 * 한글 IME는 한 글자를 완성하기까지 조합 중간 상태를 계속 내보낸다("ㅅ" → "사" → "삼").
 * 그 전부를 서버로 보내지 않기 위한 최소치 (#92).
 */
const SEARCH_DEBOUNCE_MS = 200;

function StockRow({
  stock,
  onSelect,
}: {
  stock: RecentStock;
  onSelect: (stock: RecentStock) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(stock)}
      className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{stock.name}</span>
        <span className="text-xs text-muted-foreground">{stock.ticker}</span>
      </div>
      {/* 업종은 데모 화이트리스트 27종에만 있다. 없으면 그 자리를 비운다 — 모르는 업종을
          "기타" 따위로 메우면 화면이 아는 척을 한다 (CONTEXT.md "상장 종목"). */}
      {stock.sector ? (
        <span className="text-xs text-muted-foreground">{stock.sector}</span>
      ) : null}
    </button>
  );
}

function StockList({
  stocks,
  onSelect,
}: {
  stocks: RecentStock[];
  onSelect: (stock: RecentStock) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {stocks.map((stock) => (
        <StockRow key={stock.ticker} stock={stock} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { stocks: recentStocks, addRecent } = useRecentStocks();

  const popular = useMemo(() => popularStocks(), []);

  const trimmed = query.trim();
  const debouncedQuery = useDebounced(trimmed, SEARCH_DEBOUNCE_MS);
  const isSearching = trimmed.length > 0;

  /**
   * 검색은 상장 종목 전체를 대상으로 하므로 서버(종목 마스터)를 탄다 (ADR-0008).
   * `staleTime`을 길게 두는 이유: 마스터는 하루 한 번 갱신되고, 같은 질의를 다시 치는
   * 일(지우고 다시 입력)이 흔하다.
   */
  const { data: results, isPending } = useQuery({
    queryKey: ["stock-search", debouncedQuery],
    queryFn: () => searchStocksAction(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 디바운스가 아직 안 끝났거나 요청이 도는 중 — 아직 "결과 없음"이라고 말하면 안 된다.
  const isResolving = isSearching && (debouncedQuery !== trimmed || isPending);

  function handleSelect(stock: RecentStock) {
    addRecent(stock);
    router.push(`/thesis/${stock.ticker}`);
  }

  return (
    <>
      <ScreenHeader title="종목 검색" />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목 이름이나 코드"
            className="pl-9"
          />
        </div>

        {isSearching ? (
          <section className="flex flex-col gap-2">
            {isResolving ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-2xl" />
                ))}
              </div>
            ) : results && results.length > 0 ? (
              <StockList stocks={results} onSelect={handleSelect} />
            ) : (
              <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                검색 결과가 없어요.
              </p>
            )}
          </section>
        ) : (
          <>
            {recentStocks.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">최근 본 종목</h2>
                <StockList stocks={recentStocks} onSelect={handleSelect} />
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">인기 종목</h2>
              <StockList stocks={popular} onSelect={handleSelect} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
