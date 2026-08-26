"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/layout/screen-header";
import {
  addUserWatchlistItem,
  generateCritique,
  generatePremises,
  getThesisDraft,
  initialWatchlist,
  quoteFor,
  type CheckType,
  type Thesis,
} from "@/lib/mock";

function isAutoCheck(checkType: CheckType): boolean {
  return checkType === "price" || checkType === "valuation";
}

export function ThesisResultView({ ticker, stockName }: { ticker: string; stockName: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [isNewDraft, setIsNewDraft] = useState(false);

  useEffect(() => {
    // 이 draft/시드 조회는 브라우저 전용 인메모리 스토어를 읽는다 — 서버 렌더 시점엔
    // 항상 비어 있으므로, 하이드레이션 불일치를 피하려고 마운트 후에만 반영한다.
    const draft = getThesisDraft(ticker);
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThesis({
        category: draft.category,
        followup: draft.followup,
        freeText: draft.freeText,
        createdAt: draft.createdAt,
        critique: generateCritique(draft.category, draft.followup),
        premises: generatePremises(ticker, draft.category, draft.followup),
      });
      setIsNewDraft(true);
    } else {
      const seedItem = initialWatchlist(false).find((i) => i.ticker === ticker && i.isSeed);
      setThesis(seedItem?.thesis ?? null);
      setIsNewDraft(false);
    }
    setReady(true);
  }, [ticker]);

  if (!ready) return null;

  if (!thesis) {
    return (
      <>
        <ScreenHeader title={stockName} />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          작성한 근거를 찾을 수 없어요. 다시 담아주세요.
        </div>
      </>
    );
  }

  const { critique } = thesis;

  function handleRewrite() {
    router.push(`/thesis/${ticker}`);
  }

  function handleCommit() {
    if (isNewDraft && thesis) {
      const quote = quoteFor({ ticker, isSeed: false }, false);
      addUserWatchlistItem({
        id: `user-${ticker}-${crypto.randomUUID()}`,
        ticker,
        status: "watching",
        isSeed: false,
        addedPrice: quote.price,
        addedAt: new Date().toISOString(),
        thesis,
      });
    }
    router.push(`/?highlight=${ticker}`);
  }

  return (
    <>
      <ScreenHeader title={stockName} onBack={handleRewrite} />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {critique.isChallengeable
              ? "이런 점은 어떻게 보세요?"
              : "생각이 구체적이네요. 대신 이건 지켜볼 만합니다."}
          </h2>

          {critique.isChallengeable ? (
            <div className="flex flex-col gap-2">
              {critique.counterpoints.map((cp, i) => (
                <div key={i} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <p className="text-sm font-medium">{cp.point}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{cp.basis}</p>
                </div>
              ))}
            </div>
          ) : null}

          {critique.openQuestions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-muted-foreground">확인해볼 질문</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {critique.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">앞으로 이걸 지켜보면 됩니다</h2>
          {thesis.premises.length > 0 ? (
            <div className="flex flex-col gap-2">
              {thesis.premises.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{p.statement}</span>
                    {p.manualNote ? (
                      <span className="text-xs text-muted-foreground">{p.manualNote}</span>
                    ) : null}
                  </div>
                  <Badge variant={isAutoCheck(p.checkType) ? "secondary" : "outline"}>
                    {isAutoCheck(p.checkType) ? "자동 확인" : "직접 확인 필요"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              지켜볼 구체적인 조건이 아직 없어요. 대신 작은 금액으로 시작하는 걸 권해요.
            </p>
          )}
        </section>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" className="flex-1" onClick={handleRewrite}>
          다시 쓰기
        </Button>
        <Button className="flex-1" onClick={handleCommit}>
          이대로 담기
        </Button>
      </div>
    </>
  );
}
