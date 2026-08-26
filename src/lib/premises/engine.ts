// 전제 판정 (기술스펙 6장). check_type별 분기:
//   price / valuation — 시세 기반 자동 판정. 이 파일이 유일하게 다루는 대상.
//   fundamental / qualitative — "직접 확인" 대상(화면명세 6장). 자동 판정하지 않고
//     저장된 status(시드 프로비저닝 또는 사용자의 직접 확인)를 그대로 통과시킨다.
//
// **저장하지 않는다** (ADR-0004). 자동 판정은 시세와 기준값만 있으면 결정되는 순수
// 계산이므로 DB에 쓰지 않고 조회할 때마다 계산한다. 따라서 "판정 트리거"라는 개념이
// 없다 — 목록·상세·주문 시트 어디서 조회하든 그 시점 시세로 상태가 나온다.
//
// 이 파일은 서버 전용이 아니다. 순수 함수라서 S1은 화면에 그리는 시세로 클라이언트에서
// 직접 계산하고(배지와 가격이 같은 숫자에서 나오도록), S4/S5는 서버에서 계산한다.

import type { Premise, PremiseCheckConfig, QuoteSnapshot } from "../mock/types";

const AUTO_CHECK_TYPES = new Set<Premise["checkType"]>(["price", "valuation"]);

/**
 * 전제 목록의 status/observedValue를 지금 시세 기준으로 확정한다. 자동 전제는 계산으로
 * 덮고, 직접 확인 전제는 손대지 않는다. 시세가 없으면(조회 실패) 자동 전제는 `pending` —
 * 낡은 판정을 참인 것처럼 보여주느니 판정 불가를 드러낸다.
 */
export function resolvePremises(premises: Premise[], quote: QuoteSnapshot | null): Premise[] {
  return premises.map((premise) => {
    if (!AUTO_CHECK_TYPES.has(premise.checkType)) return premise;

    const result = evaluateCheck(premise.checkType, premise.checkConfig, quote);
    if (!result) return { ...premise, status: "pending", observedValue: undefined };

    return { ...premise, status: result.status, observedValue: result.observedValue };
  });
}

interface CheckResult {
  status: "intact" | "broken";
  observedValue: string;
}

function evaluateCheck(
  checkType: Premise["checkType"],
  config: PremiseCheckConfig | undefined,
  quote: QuoteSnapshot | null
): CheckResult | null {
  if (!quote || config?.operator == null || config.value == null) return null;

  if (checkType === "price") {
    return applyOperator(quote.price, config.operator, config.value, formatWon);
  }

  if (checkType === "valuation") {
    if (!config.metric) return null;
    const observed = quote[config.metric];
    if (observed == null) return null;
    return applyOperator(observed, config.operator, config.value, formatMultiple);
  }

  return null;
}

function applyOperator(
  observed: number,
  operator: "lte" | "gte",
  value: number,
  format: (n: number) => string
): CheckResult {
  const holds = operator === "lte" ? observed <= value : observed >= value;
  return { status: holds ? "intact" : "broken", observedValue: format(observed) };
}

/** DB의 `check_config` jsonb는 어떤 모양이든 올 수 있어 도메인 타입으로 좁혀 읽는다. */
export function parseCheckConfig(raw: unknown): PremiseCheckConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const config: PremiseCheckConfig = {
    metric: c.metric === "per" || c.metric === "pbr" ? c.metric : undefined,
    operator: c.operator === "lte" || c.operator === "gte" ? c.operator : undefined,
    value: typeof c.value === "number" ? c.value : undefined,
  };
  return config.operator == null && config.value == null && config.metric == null
    ? undefined
    : config;
}

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatMultiple(n: number): string {
  return `${n.toFixed(1)}배`;
}
