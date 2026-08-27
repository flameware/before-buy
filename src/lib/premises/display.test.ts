import { describe, expect, it } from "vitest";
import { premiseDisplay } from "./display";
import type { Premise, PremiseStatus } from "../mock/types";

function premise(over: Partial<Premise> = {}): Premise {
  return {
    id: "p1",
    statement: "360,900원 아래로 내려가면 정리한다",
    checkType: "price",
    checkConfig: { kind: "stop-loss", value: 360_900 },
    status: "intact",
    ...over,
  };
}

describe("premiseDisplay — 배지", () => {
  it("자동 전제는 자동 확인이다", () => {
    expect(premiseDisplay(premise(), false).badge).toBe("auto");
  });

  it.each(["fundamental", "qualitative"] as const)("%s 전제는 직접 확인 필요다", (checkType) => {
    expect(premiseDisplay(premise({ checkType, status: "manual" }), false).badge).toBe("manual");
  });

  // #88 회귀 잠금: 판정할 수 없는 전제가 "자동 확인"이라고 말하면, 시스템이 대신 봐주고
  // 있다는 거짓말이 된다.
  it("설정을 읽지 못하는 자동 전제는 자동 확인을 주장하지 않는다", () => {
    expect(premiseDisplay(premise({ status: "unreadable" }), false).badge).toBe("manual");
  });

  it("시세를 기다리는 동안에도 자동 확인은 그대로다 — 배지가 깜박이지 않는다", () => {
    expect(premiseDisplay(premise({ status: "pending" }), true).badge).toBe("auto");
  });
});

describe("premiseDisplay — 본문", () => {
  it("깨진 유지 조건만 눈에 띈다", () => {
    const { body } = premiseDisplay(premise({ status: "broken", observedValue: "350,000원" }), false);
    expect(body).toEqual({
      kind: "alert",
      text: "담으실 때 보신 것과 달라진 게 있어요 — 360,900원 아래로 내려가면 정리한다, 지금은 350,000원",
    });
  });

  it("시세를 기다리는 자동 전제는 문구 대신 자리를 비운다", () => {
    expect(premiseDisplay(premise({ status: "pending" }), true).body).toEqual({ kind: "waiting" });
  });

  // 조회가 끝났는데도 판정이 없으면 시세를 못 불러온 것이다. 사용자 몫이 아닌 일을
  // 사용자에게 떠넘기지 않는다 (#88).
  it("시세 조회에 실패하면 직접 확인을 요구하지 않고 그 사정을 말한다", () => {
    expect(premiseDisplay(premise({ status: "pending" }), false).body).toEqual({
      kind: "note",
      text: "시세를 불러오지 못해 확인할 수 없어요.",
    });
  });

  it("직접 확인 전제는 시세를 기다리는 중에도 저장된 안내를 그대로 보여준다", () => {
    const { body } = premiseDisplay(
      premise({ checkType: "qualitative", status: "manual", manualNote: "3개월 뒤 알려드릴게요" }),
      true
    );
    expect(body).toEqual({ kind: "note", text: "3개월 뒤 알려드릴게요" });
  });

  it("설정을 읽지 못하면 이유를 밝히고 고칠 방법을 알려준다", () => {
    expect(premiseDisplay(premise({ status: "unreadable" }), false).body).toEqual({
      kind: "note",
      text: "이 조건을 시스템이 읽지 못해요 — 근거를 다시 써주세요.",
    });
  });

  // 읽지 못한다는 사실은 시세와 무관하게 확정이다. 스켈레톤 뒤에 숨기면 배지는 이미
  // "직접 확인 필요"인데 문구만 로딩 중인 한 박자가 생긴다.
  it("설정을 읽지 못하면 시세를 기다리는 중에도 그 사실을 바로 말한다", () => {
    expect(premiseDisplay(premise({ status: "unreadable" }), true).body).toEqual({
      kind: "note",
      text: "이 조건을 시스템이 읽지 못해요 — 근거를 다시 써주세요.",
    });
  });

  // 도달 목표는 조용히 둔다 (#85) — 미도달은 생각이 틀어진 게 아니라 진행 중인 것이다.
  it.each([
    ["awaiting", "아직 도달하지 않았어요 — 지금은 195,000원"],
    ["reached", "생각하신 가격에 닿았어요 — 지금은 195,000원"],
  ] as const)("도달 목표(%s)는 alert가 아니라 note다", (status, text) => {
    const { body } = premiseDisplay(premise({ status, observedValue: "195,000원" }), false);
    expect(body).toEqual({ kind: "note", text });
  });

  it("유지 중이면 관측값만 조용히 보여준다", () => {
    expect(premiseDisplay(premise({ status: "intact", observedValue: "401,000원" }), false).body).toEqual({
      kind: "note",
      text: "현재 401,000원",
    });
  });

  it("보여줄 것이 없으면 아무것도 그리지 않는다", () => {
    expect(premiseDisplay(premise({ status: "intact" }), false).body).toEqual({ kind: "none" });
  });
});

// 이 저장소에서 #88이 난 방식 그 자체 — 배지와 문구가 서로 다른 출처에서 나와 한 줄 안에서
// 반대되는 말을 했다. 두 값이 한 함수에서 나오는 이상 아래 조합은 만들어질 수 없어야 한다.
describe("premiseDisplay — 배지와 문구는 서로 어긋나지 않는다", () => {
  const ALL: PremiseStatus[] = [
    "intact",
    "broken",
    "pending",
    "unreadable",
    "manual",
    "awaiting",
    "reached",
  ];

  it.each(ALL.flatMap((s) => [true, false].map((q) => [s, q] as const)))(
    "%s / 조회 중=%s — 자동 확인 배지 아래에 직접 확인 안내가 오지 않는다",
    (status, quotePending) => {
      const { badge, body } = premiseDisplay(premise({ status }), quotePending);
      if (badge === "auto" && body.kind === "note") {
        expect(body.text).not.toContain("직접 확인");
        expect(body.text).not.toContain("읽지 못해요");
      }
    }
  );
});
