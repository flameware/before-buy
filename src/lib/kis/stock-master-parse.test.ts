import { describe, expect, it } from "vitest";
import type { Stock } from "@/lib/mock/types";
import { isTickerShaped, parseMaster, searchStockMaster } from "./stock-master-parse";

/**
 * KIS 마스터 한 줄을 만든다: 단축코드(9) + 표준코드(12) + 한글명(가변) + 트레일러.
 * 트레일러 두 번째 칸부터가 그룹코드다.
 */
function masterLine(ticker: string, name: string, group: string, trailerLength: number): string {
  const trailer = " " + group + "X".repeat(trailerLength - 3);
  return ticker.padEnd(9) + "KR7000000001" + name.padEnd(40) + trailer;
}

describe("parseMaster", () => {
  // KOSPI는 트레일러 228, KOSDAQ은 222다. 하나로 뭉뚱그리면 KOSDAQ 종목명이 잘려
  // 검색에 안 걸린다 — 자매 프로젝트에서 에코프로비엠이 통째로 사라졌던 회귀다.
  it.each([
    ["KOSPI", 228],
    ["KOSDAQ", 222],
  ] as const)("%s 트레일러(%i)에서 코드와 종목명을 온전히 뽑는다", (exchange, trailer) => {
    const text = [
      masterLine("005930", "삼성전자", "ST", trailer),
      masterLine("247540", "에코프로비엠", "ST", trailer),
    ].join("\n");

    expect(parseMaster(text, trailer, exchange)).toEqual([
      { ticker: "005930", name: "삼성전자", exchange },
      { ticker: "247540", name: "에코프로비엠", exchange },
    ]);
  });

  it("6자리가 아닌 단축코드(ELW·펀드)는 버린다", () => {
    const text = masterLine("F70100030", "한투한미핵심성장포커스1", "BC", 228);
    expect(parseMaster(text, 228, "KOSPI")).toEqual([]);
  });

  // 이 제품은 LLM이 개별 기업 근거를 반문하는 앱이라 ETF·리츠·ETN은 입력이 될 수 없다 (#92).
  it("주권(ST)이 아닌 그룹코드는 전부 버린다", () => {
    const text = [
      masterLine("005930", "삼성전자", "ST", 228),
      masterLine("069500", "KODEX 200", "EF", 228),
      masterLine("330590", "리츠종목", "RT", 228),
      masterLine("580011", "ETN상품", "EN", 228),
    ].join("\n");

    expect(parseMaster(text, 228, "KOSPI")).toEqual([
      { ticker: "005930", name: "삼성전자", exchange: "KOSPI" },
    ]);
  });

  // 마스터는 업종을 주지 않는다. 상장 종목의 sector가 비는 것은 정상이며, 여기서
  // 빈 문자열이나 "기타" 같은 걸 지어내면 화면과 LLM 프롬프트가 모르는 걸 아는 척한다.
  it("업종을 지어내지 않는다 — sector는 비어 있다", () => {
    const [stock] = parseMaster(masterLine("005930", "삼성전자", "ST", 228), 228, "KOSPI");
    expect(stock).toBeDefined();
    expect(stock?.sector).toBeUndefined();
  });

  it("트레일러보다 짧은 줄(파일 끝 개행 등)은 건너뛴다", () => {
    expect(parseMaster("\n   \n", 228, "KOSPI")).toEqual([]);
  });
});

const STOCKS: Stock[] = [
  { ticker: "005930", name: "삼성전자", exchange: "KOSPI" },
  { ticker: "005935", name: "삼성전자우", exchange: "KOSPI" },
  { ticker: "000660", name: "SK하이닉스", exchange: "KOSPI" },
  { ticker: "035720", name: "카카오", exchange: "KOSPI" },
  { ticker: "323410", name: "카카오뱅크", exchange: "KOSPI" },
  { ticker: "247540", name: "에코프로비엠", exchange: "KOSDAQ" },
];

const names = (stocks: Stock[]) => stocks.map((s) => s.name);

describe("searchStockMaster", () => {
  it("종목명 앞부분이 일치하면 찾는다", () => {
    expect(names(searchStockMaster(STOCKS, "카카오", 20))).toEqual(["카카오", "카카오뱅크"]);
  });

  // 우선주를 목록에서 빼지 않고도 노이즈가 정리되는 지점. 이 순서가 깨지면
  // "삼성전자"를 친 사용자가 삼성전자우를 먼저 보게 된다 (#92).
  it("정확히 일치하는 이름이 우선주보다 먼저 온다", () => {
    expect(names(searchStockMaster(STOCKS, "삼성전자", 20))).toEqual(["삼성전자", "삼성전자우"]);
  });

  it("종목코드로도 찾는다 — 코드 직접 입력 경로가 살아 있다", () => {
    expect(names(searchStockMaster(STOCKS, "005930", 20))).toEqual(["삼성전자"]);
  });

  it("코드 앞자리만 쳐도 후보가 나온다", () => {
    expect(names(searchStockMaster(STOCKS, "0059", 20))).toEqual(["삼성전자", "삼성전자우"]);
  });

  it("중간 포함도 잡되 앞부분 일치보다 뒤에 둔다", () => {
    expect(names(searchStockMaster(STOCKS, "뱅크", 20))).toEqual(["카카오뱅크"]);
    expect(names(searchStockMaster(STOCKS, "에코", 20))).toEqual(["에코프로비엠"]);
  });

  it("공백과 대소문자를 무시한다", () => {
    expect(names(searchStockMaster(STOCKS, "sk 하이닉스", 20))).toEqual(["SK하이닉스"]);
  });

  it("limit을 넘지 않는다", () => {
    expect(searchStockMaster(STOCKS, "삼성", 1)).toHaveLength(1);
  });

  it("빈 질의는 아무것도 돌려주지 않는다", () => {
    expect(searchStockMaster(STOCKS, "   ", 20)).toEqual([]);
  });
});

describe("isTickerShaped", () => {
  // 마스터가 아니라 형식만 본다 — 마스터를 존재의 심판자로 앉히면 다운로드 실패
  // 한 번에 모든 종목이 404가 된다 (ADR-0008).
  it("평범한 6자리 숫자 코드를 통과시킨다", () => {
    expect(isTickerShaped("005930")).toBe(true);
    expect(isTickerShaped("247540")).toBe(true);
  });

  // 실 마스터 2,720종 중 79종이 영문자를 포함한다. `/^\d{6}$/`로 막았다면 신형 우선주와
  // 신규 상장이 통째로 404가 됐을 것이다 (#92) — 실데이터로 잡은 회귀다.
  it.each([
    ["00088K", "한화3우B"],
    ["02826K", "삼성물산우B"],
    ["0126Z0", "삼성에피스홀딩스"],
    ["0001A0", "덕양에너젠"],
  ])("영문자가 섞인 실제 티커도 통과시킨다: %s (%s)", (ticker) => {
    expect(isTickerShaped(ticker)).toBe(true);
  });

  it("마스터에 없는 코드도 통과시킨다 — 존재 확인은 시세 조회의 몫이다", () => {
    expect(isTickerShaped("999999")).toBe(true);
  });

  it.each(["00593", "0059300", "00-593", "", "삼성전자", "00593 "])(
    "길이 6의 영숫자가 아니면 막는다: %s",
    (input) => {
      expect(isTickerShaped(input)).toBe(false);
    },
  );
});
