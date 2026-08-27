// 전제 판정 (기술스펙 6장). check_type별 분기:
//   price / valuation — 시세 기반 자동 판정. 이 파일이 유일하게 다루는 대상.
//   fundamental / qualitative — "직접 확인" 대상(화면명세 6장). 자동 판정하지 않고
//     저장된 status(시드 프로비저닝 또는 사용자의 직접 확인)를 그대로 통과시킨다.
//
// **저장하지 않는다** (ADR-0004). 자동 판정은 시세와 기준값만 있으면 결정되는 순수
// 계산이므로 DB에 쓰지 않고 조회할 때마다 계산한다. 따라서 "판정 트리거"라는 개념이
// 없다 — 목록·상세·주문 시트 어디서 조회하든 그 시점 시세로 상태가 나온다.
//
// **비교 방향은 `kind`가 결정한다** (ADR-0007). `lte`/`gte`는 이 파일 안에만 산다 —
// 기록하는 쪽(LLM·시드)은 종류만 말하고 방향은 고르지 않는다.
//
// 이 파일은 서버 전용이 아니다. 순수 함수라서 S1은 화면에 그리는 시세로 클라이언트에서
// 직접 계산하고(배지와 가격이 같은 숫자에서 나오도록), S4/S5는 서버에서 계산한다.

import type {
  Premise,
  PremiseCheckConfig,
  PremiseKind,
  PremiseStatus,
  QuoteSnapshot,
} from "../mock/types";

const AUTO_CHECK_TYPES = new Set<Premise["checkType"]>(["price", "valuation"]);

const PREMISE_KINDS: readonly PremiseKind[] = ["stop-loss", "value-ceiling", "target-price"];

/** 시스템이 시세로 대신 봐주는 전제인가. 배지 라벨과 판정 대상이 여기서 갈린다. */
export function isAutoCheck(checkType: Premise["checkType"]): boolean {
  return AUTO_CHECK_TYPES.has(checkType);
}

/**
 * 배지에 투표할 자격이 있는 전제인가 — 즉 **유지 조건**인가. 도달 목표는 자격이 없다:
 * 목표가에 아직 닿지 않은 것은 생각이 틀어진 게 아니라 진행 중인 것이다(#85).
 */
export function isMaintainCondition(kind: PremiseKind): boolean {
  return kind !== "target-price";
}

/**
 * 전제 목록의 status/observedValue를 지금 시세 기준으로 확정한다. 자동 전제는 계산으로
 * 덮고, 직접 확인 전제는 손대지 않는다. 시세가 없으면(조회 실패) 자동 전제는 `pending` —
 * 낡은 판정을 참인 것처럼 보여주느니 판정 불가를 드러낸다.
 */
export function resolvePremises(premises: Premise[], quote: QuoteSnapshot | null): Premise[] {
  return premises.map((premise) => {
    if (!AUTO_CHECK_TYPES.has(premise.checkType)) return premise;

    const result = evaluateCheck(premise.checkType, premise.checkConfig, quote);
    return { ...premise, status: result.status, observedValue: result.observedValue };
  });
}

/**
 * 이 근거의 판정이 시세에 달려 있는가. 시세가 아직 오지 않은 동안 배지/전제 상태를
 * 가려야 할지 화면이 판단하는 데 쓴다 — 직접 확인 전제만 있는 종목은 시세와 무관하게
 * 이미 확정된 상태라 가릴 이유가 없다.
 */
export function hasAutoPremise(premises: Premise[]): boolean {
  return premises.some((p) => AUTO_CHECK_TYPES.has(p.checkType));
}

interface CheckResult {
  status: PremiseStatus;
  observedValue?: string;
}

/** 시세를 더 기다리면 풀릴 자리. 관측값은 아직 없다. */
const WAITING: CheckResult = { status: "pending" };

/** 기다려서는 풀리지 않는 자리 (#88). */
const UNREADABLE: CheckResult = { status: "unreadable" };

/**
 * 판정이 안 나올 때 그 이유를 갈라 돌려준다. **기다리면 풀리는가**가 유일한 기준이다 —
 * 풀리면 `pending`, 안 풀리면 `unreadable`. 한 값으로 뭉개면 화면이 영구 판정 불가에도
 * "잠시 기다리는 중"처럼 안내하게 된다.
 *
 * **가르는 것은 원인이 아니라 회복 가능성이다** (#92). 시세를 아직 못 받은 것은 `pending`
 * (다음 조회에서 풀린다). 시세는 왔는데 PER·PBR이 비어 있는 것은 `unreadable`이다 —
 * 적자기업·신규상장처럼 KIS가 그 값을 끝내 주지 않는 종목이 있고, 기다려도 오지 않는다.
 *
 * 이 구분은 검색이 상장 종목 전체로 넓어지면서 실질이 생겼다: 데모 화이트리스트 27종은
 * 전부 대형주라 PER·PBR이 항상 나왔고, 그래서 "PER 없음 = 아직 안 왔음"이 우연히 참이었다.
 */
/**
 * 전제의 **설정**만으로 판정 준비가 끝났는가. 시세는 보지 않는다.
 *
 * `unreadable`은 한 상태지만 사용자가 할 수 있는 일은 둘로 갈린다 — 설정을 못 읽는 것은
 * 근거를 다시 쓰면 풀리고, 시세에 지표가 없는 것은 그래도 안 풀린다. 화면이 그 둘에
 * 다른 안내를 하려면 이 술어가 필요하다(`display.ts`). 상태를 하나 더 만드는 대신
 * 술어를 내보내는 이유: 배지 판정은 두 경우가 완전히 같기 때문이다 (#92).
 */
export function isConfigReadable(
  checkType: Premise["checkType"],
  config: PremiseCheckConfig | undefined
): boolean {
  if (config?.kind == null || config.value == null) return false;
  if (checkType === "valuation") return Boolean(config.metric);
  return true;
}

function evaluateCheck(
  checkType: Premise["checkType"],
  config: PremiseCheckConfig | undefined,
  quote: QuoteSnapshot | null
): CheckResult {
  if (!isConfigReadable(checkType, config)) return UNREADABLE;
  // 위에서 이미 확인했다. 여기는 타입을 좁히기 위한 재확인일 뿐이다 —
  // 판정 기준은 `isConfigReadable` 한 곳에만 산다.
  const kind = config?.kind;
  const value = config?.value;
  if (kind == null || value == null) return UNREADABLE;

  if (!quote) return WAITING;

  if (checkType === "price") {
    return judge(quote.price, kind, value, formatWon);
  }

  if (checkType === "valuation") {
    if (!config?.metric) return UNREADABLE;
    const observed = quote[config.metric];
    // 시세는 왔는데 이 지표만 비었다 — 기다려서 풀릴 자리가 아니다 (#92).
    if (observed == null) return UNREADABLE;
    return judge(observed, kind, value, formatMultiple);
  }

  return UNREADABLE;
}

/**
 * 관측값이 기준을 지키고 있는가. 경계값은 언제나 지킨 것으로 본다 — 손절선을 "여기까지는
 * 버틴다"로 답한 사용자를 그 값에 닿았다는 이유로 깨뜨리지 않는다.
 */
function holdsFor(observed: number, kind: PremiseKind, value: number): boolean {
  return kind === "value-ceiling" ? observed <= value : observed >= value;
}

function judge(
  observed: number,
  kind: PremiseKind,
  value: number,
  format: (n: number) => string
): CheckResult {
  const holds = holdsFor(observed, kind, value);
  const status: PremiseStatus = isMaintainCondition(kind)
    ? holds
      ? "intact"
      : "broken"
    : holds
      ? "reached"
      : "awaiting";

  return { status, observedValue: format(observed) };
}

/** DB의 `check_config` jsonb는 어떤 모양이든 올 수 있어 도메인 타입으로 좁혀 읽는다. */
export function parseCheckConfig(raw: unknown): PremiseCheckConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const config: PremiseCheckConfig = {
    kind: PREMISE_KINDS.find((k) => k === c.kind),
    metric: c.metric === "per" || c.metric === "pbr" ? c.metric : undefined,
    value: typeof c.value === "number" ? c.value : undefined,
  };
  return config.kind == null && config.value == null && config.metric == null
    ? undefined
    : config;
}

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatMultiple(n: number): string {
  return `${n.toFixed(1)}배`;
}
