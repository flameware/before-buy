"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ScreenHeader } from "@/components/layout/screen-header";
import { useRecentStocks } from "@/hooks/use-recent-stocks";
import { findStock, POPULAR_TICKERS, searchStocks, type Stock } from "@/lib/mock";

function StockRow({ stock, onSelect }: { stock: Stock; onSelect: (ticker: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(stock.ticker)}
      className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{stock.name}</span>
        <span className="text-xs text-muted-foreground">{stock.ticker}</span>
      </div>
      <span className="text-xs text-muted-foreground">{stock.sector}</span>
    </button>
  );
}

function StockList({ stocks, onSelect }: { stocks: Stock[]; onSelect: (ticker: string) => void }) {
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
  const { tickers: recentTickers, addRecent } = useRecentStocks();

  const recentStocks = useMemo(
    () => recentTickers.map(findStock).filter((s): s is Stock => s !== undefined),
    [recentTickers],
  );
  const popularStocks = useMemo(
    () => POPULAR_TICKERS.map(findStock).filter((s): s is Stock => s !== undefined),
    [],
  );
  const results = useMemo(() => searchStocks(query), [query]);
  const isSearching = query.trim().length > 0;

  function handleSelect(ticker: string) {
    addRecent(ticker);
    router.push(`/thesis/${ticker}`);
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
            {results.length > 0 ? (
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
              <StockList stocks={popularStocks} onSelect={handleSelect} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
