"use client";

import { useCallback } from "react";
import { useToastManager } from "@/components/ui/toast";

/**
 * 매수·매도 **주문 실행**은 이 프로토타입의 범위가 아니다 — `trade-client.ts`에 주문
 * 메서드 자체가 없다. 거짓말이 일어나는 지점은 "실제로 주문이 나가는 순간" 딱 한 곳이므로,
 * 그 자리에서만 정직하게 말한다(#105).
 *
 * 버튼을 `disabled`로 두지 않는 이유는 그것이 **다른 말을 하기 때문**이다 — 데모에서
 * "이 제품은 매도를 안 한다"로 읽혀 ADR-0009의 논지(양방향을 동등하게 열어둔다)를 화면이
 * 스스로 부정한다. 무반응(no-op)은 그냥 고장으로 보인다.
 *
 * 문구를 방향별로 가르는 이유: `판매`를 눌렀는데 묻지도 않은 구매까지 함께 말하면
 * 무엇이 막힌 것인지 흐려진다.
 */
export function useUnsupportedTradeToast() {
  const toastManager = useToastManager();

  return useCallback(
    (side: "buy" | "sell") => {
      toastManager.add({
        // 같은 id로 add하면 Base UI가 새로 쌓지 않고 그 자리에서 갱신한다 —
        // 빠르게 여러 번 눌러도 토스트가 늘어서지 않는다(#103 후속과 같은 규율).
        id: "unsupported-trade",
        title: `프로토타입에서는 ${side === "buy" ? "구매" : "판매"}를 지원하지 않아요`,
        data: { tone: "info" },
      });
    },
    [toastManager]
  );
}
