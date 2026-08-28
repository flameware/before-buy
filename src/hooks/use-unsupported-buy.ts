"use client";

import { useCallback } from "react";
import { recordOrderEventAction } from "@/app/actions";
import { useUnsupportedTradeToast } from "./use-unsupported-trade-toast";

/**
 * S4를 열지 않고 `구매`를 그 자리에서 사양하는 경로 (#143). 두 곳에서 쓴다.
 *
 * - **근거 없는 종목의 S1 카드** — 되비출 근거가 없으니 시트가 빈 채로 뜬다.
 * - **S5 상세** — 전제 목록이 이미 펼쳐져 있어 시트가 보여줄 것이 전부 중복이고,
 *   `판매`만 토스트인 비대칭은 제품이 매수 쪽으로 기울었다는 신호가 된다(ADR-0009).
 *
 * **화면을 건너뛰는 것과 사건을 안 남기는 것은 별개다.** "근거 없이 구매를 눌렀다"는
 * 이 제품이 가장 알고 싶어 하는 대조군이라, 시트가 없어도 `proceed`는 그대로 남는다 —
 * `thesisShown`이 그 자리에서 근거를 봤는지 아닌지를 그대로 말한다.
 *
 * 수량은 S4를 떠났고 컬럼만 남아 있어 두 값은 늘 1이다(#143).
 */
export function useUnsupportedBuy() {
  const notifyUnsupportedTrade = useUnsupportedTradeToast();

  return useCallback(
    (watchlistItemId: string, thesisShown: boolean) => {
      void recordOrderEventAction({
        watchlistItemId,
        thesisShown,
        initialQty: 1,
        finalQty: 1,
        action: "proceed",
      });
      notifyUnsupportedTrade("buy");
    },
    [notifyUnsupportedTrade]
  );
}
