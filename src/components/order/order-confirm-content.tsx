"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { badgeState, getCategory, initialWatchlist, quoteFor } from "@/lib/mock";

const priceFormat = new Intl.NumberFormat("ko-KR");

function formatPrice(price: number): string {
  return `${priceFormat.format(price)}원`;
}

/**
 * S4 본문 — Drawer(소프트 내비게이션)와 전체 페이지(하드 내비게이션 폴백)
 * 양쪽에서 공유한다. 근거 있음/없음 두 분기와 조건부 "생각이 바뀌셨나요?"
 * 링크를 여기서 처리하고, 취소/구매는 시각적 전환만 하고 실제 기록은 남기지 않는다
 * (Notes: "실제 기록 없음").
 */
export function OrderConfirmContent({ ticker, stockName }: { ticker: string; stockName: string }) {
  const router = useRouter();
  const { isFuture, hydrated } = useDemoScenario();
  const [qty, setQty] = useState(1);

  const item = useMemo(
    () => initialWatchlist(isFuture).find((i) => i.ticker === ticker),
    [ticker, isFuture],
  );
  const quote = quoteFor({ ticker, isSeed: item?.isSeed ?? false }, isFuture);
  const hasThesis = hydrated && !!item?.thesis;
  const changed = hydrated && !!item && badgeState(item) === "changed";

  function handleCancel() {
    router.back();
  }

  function handleBuy() {
    router.push(`/?highlight=${ticker}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {hasThesis && item?.thesis ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">3주 전에 이렇게 생각하셨어요</p>
            <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <p className="text-sm font-medium">{getCategory(item.thesis.category).label}</p>
              <p className="text-xs text-muted-foreground">
                {item.thesis.freeText ?? "몇 가지 질문에 답하며 담았어요."}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">전제 상태</span>
              <Badge variant={changed ? "destructive" : "secondary"}>
                {changed ? "달라짐" : "유지"}
              </Badge>
            </div>
            {changed ? (
              <Link href={`/thesis/${ticker}`} className="text-sm text-primary underline">
                생각이 바뀌셨나요?
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{stockName}</span>
            <span className="text-sm text-muted-foreground">{formatPrice(quote.price)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">수량</span>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 text-right"
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>합계</span>
            <span>{formatPrice(quote.price * qty)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" className="flex-1" onClick={handleCancel}>
          취소
        </Button>
        <Button className="flex-1" onClick={handleBuy}>
          구매
        </Button>
      </div>
    </div>
  );
}
