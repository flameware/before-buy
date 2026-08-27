// 전제 한 줄이 화면에 어떻게 보이는가 — 배지 라벨과 그 아래 문구를 **한 자리에서 함께**
// 결정한다.
//
// 둘을 갈라 두었던 것이 #88의 결함이었다. 배지는 `checkType`만 보는 정적 판단이었고 문구는
// 계산된 `status`를 봤다. 두 출처가 어긋나자 한 줄 안에서 "자동 확인"과 "아직 직접 확인이
// 필요해요"가 동시에 나왔다. 여기서 함께 내보내면 그런 조합을 만들 수 없고, 순수 함수라
// 테스트로 잠글 수 있다 (ADR-0006).

import type { Premise } from "../mock/types";
import { isAutoCheck } from "./engine";

/** "자동 확인" / "직접 확인 필요" 두 배지 (CONTEXT.md). */
export type PremiseBadge = "auto" | "manual";

export type PremiseBody =
  /** 시세를 기다리는 중 — 문구 대신 자리를 비워둔다. */
  | { kind: "waiting" }
  /** 유지 조건이 깨졌다. 화면에서 눈에 띄어야 하는 유일한 경우. */
  | { kind: "alert"; text: string }
  | { kind: "note"; text: string }
  | { kind: "none" };

export interface PremiseDisplay {
  badge: PremiseBadge;
  body: PremiseBody;
}

/**
 * **판정이 시스템 손을 떠난 전제는 자동 확인을 주장하지 않는다.** 설정을 읽지 못하는데
 * "자동 확인"이라고 말하면 시스템이 대신 봐주고 있다는 거짓말이 된다 — 사용자가 직접
 * 봐야 하는 상태이므로 배지도 그렇게 말한다. `manual`도 같다: 자동 판정 대상 타입이라도
 * 상태가 직접 확인이면 배지가 그걸 뒤집지 않는다.
 *
 * 시세를 못 불러온 `pending`은 다르다. 판정은 여전히 시스템 몫이고 시세만 없는 것이라
 * 배지는 그대로 두고 문구가 그 사정을 말한다.
 */
function badgeFor(premise: Premise): PremiseBadge {
  if (!isAutoCheck(premise.checkType)) return "manual";
  return premise.status === "unreadable" || premise.status === "manual" ? "manual" : "auto";
}

function bodyFor(premise: Premise, quotePending: boolean): PremiseBody {
  // 시세보다 먼저 본다. `unreadable`은 시세와 무관하게 확정이라 기다릴 이유가 없고,
  // 이걸 스켈레톤 뒤에 숨기면 배지는 "직접 확인 필요"인데 문구는 로딩 중인 한 박자가 생긴다.
  if (premise.status === "unreadable") {
    return { kind: "note", text: "이 조건을 시스템이 읽지 못해요 — 근거를 다시 써주세요." };
  }

  if (isAutoCheck(premise.checkType) && premise.status === "pending") {
    // 조회 중에는 가격도 전제 판정도 확정되지 않았다 — 문구 대신 자리를 비워 기다린다.
    // 시도가 끝났는데도 `pending`이면 시세를 못 불러온 것이다. 이때 "직접 확인이
    // 필요해요"라고 하면 사용자 몫이 아닌 일을 사용자에게 떠넘기는 말이 된다 (#88).
    return quotePending
      ? { kind: "waiting" }
      : { kind: "note", text: "시세를 불러오지 못해 확인할 수 없어요." };
  }

  switch (premise.status) {
    case "broken":
      return {
        kind: "alert",
        text: `담으실 때 보신 것과 달라진 게 있어요 — ${premise.statement}, 지금은 ${premise.observedValue}`,
      };
    case "manual":
    case "pending":
      return { kind: "note", text: premise.manualNote ?? "아직 직접 확인이 필요해요." };
    // 도달 목표는 조용히 둔다 — 미도달은 생각이 틀어진 게 아니라 진행 중인 것이라
    // `broken`처럼 눈에 띄어서는 안 된다 (#85).
    case "awaiting":
      return { kind: "note", text: `아직 도달하지 않았어요 — 지금은 ${premise.observedValue}` };
    case "reached":
      return { kind: "note", text: `생각하신 가격에 닿았어요 — 지금은 ${premise.observedValue}` };
    default:
      return premise.observedValue
        ? { kind: "note", text: `현재 ${premise.observedValue}` }
        : { kind: "none" };
  }
}

export function premiseDisplay(premise: Premise, quotePending: boolean): PremiseDisplay {
  return { badge: badgeFor(premise), body: bodyFor(premise, quotePending) };
}
