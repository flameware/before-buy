import type { Stock } from "./types";

/**
 * **데모 화이트리스트** — 손으로 고른 27종 (CONTEXT.md). issue #10 리서치
 * (`docs/research/demo-whitelist.md`)의 26종 후보에서 출발했다.
 *
 * **검색 범위가 아니다.** 검색(S1.5)은 KIS 종목 마스터가 주는 상장 종목 전체를 본다
 * (`lib/kis/stock-master.ts`, ADR-0008). 여기 남는 것은 손으로 고른 값이 필요한 셋뿐이다:
 * 시드 종목, S1.5 "인기 종목", 그리고 큐레이션된 업종 라벨.
 *
 * 이 파일이 `stock-universe.ts`에서 갈라져 나온 이유(#92): 하나의 상수가 "앱이 아는 종목"과
 * "데모용으로 고른 종목" 두 역할을 겸하고 있었다. 그 상태로는 인기 종목 5개를 뽑는 데
 * 상장 종목 2,600종을 훑는 코드가 아무 저항 없이 통과한다.
 */
export const DEMO_WHITELIST: Stock[] = [
  { ticker: "005930", name: "삼성전자", sector: "반도체/전자", exchange: "KOSPI" },
  { ticker: "000660", name: "SK하이닉스", sector: "반도체", exchange: "KOSPI" },
  { ticker: "005380", name: "현대자동차", sector: "자동차", exchange: "KOSPI" },
  { ticker: "012330", name: "현대모비스", sector: "자동차부품", exchange: "KOSPI" },
  { ticker: "105560", name: "KB금융", sector: "은행/금융지주", exchange: "KOSPI" },
  { ticker: "000810", name: "삼성화재", sector: "손해보험", exchange: "KOSPI" },
  { ticker: "006800", name: "미래에셋증권", sector: "증권", exchange: "KOSPI" },
  { ticker: "004170", name: "신세계", sector: "백화점/유통", exchange: "KOSPI" },
  { ticker: "017670", name: "SK텔레콤", sector: "통신", exchange: "KOSPI" },
  { ticker: "035420", name: "NAVER", sector: "인터넷/플랫폼", exchange: "KOSPI" },
  { ticker: "207940", name: "삼성바이오로직스", sector: "바이오/제약 CDMO", exchange: "KOSPI" },
  { ticker: "005490", name: "POSCO홀딩스", sector: "철강", exchange: "KOSPI" },
  { ticker: "010950", name: "에쓰오일", sector: "정유/에너지", exchange: "KOSPI" },
  { ticker: "352820", name: "하이브", sector: "엔터테인먼트", exchange: "KOSPI" },
  { ticker: "004370", name: "농심", sector: "식음료", exchange: "KOSPI" },
  { ticker: "028260", name: "삼성물산", sector: "건설", exchange: "KOSPI" },
  { ticker: "011200", name: "HMM", sector: "해운", exchange: "KOSPI" },
  { ticker: "373220", name: "LG에너지솔루션", sector: "이차전지/배터리", exchange: "KOSPI" },
  { ticker: "012450", name: "한화에어로스페이스", sector: "방위산업", exchange: "KOSPI" },
  { ticker: "051910", name: "LG화학", sector: "화학", exchange: "KOSPI" },
  { ticker: "003490", name: "대한항공", sector: "항공", exchange: "KOSPI" },
  { ticker: "090430", name: "아모레퍼시픽", sector: "화장품", exchange: "KOSPI" },
  { ticker: "329180", name: "HD현대중공업", sector: "조선", exchange: "KOSPI" },
  { ticker: "066570", name: "LG전자", sector: "가전", exchange: "KOSPI" },
  { ticker: "293490", name: "카카오게임즈", sector: "게임", exchange: "KOSDAQ" },
  { ticker: "383220", name: "F&F", sector: "패션/의류", exchange: "KOSPI" },
  { ticker: "377300", name: "카카오페이", sector: "핀테크/결제", exchange: "KOSPI" },
];

/** S1.5 "인기 종목" 5개 — 데모 화이트리스트에서 고정 선정. */
export const POPULAR_TICKERS = ["005930", "000660", "035420", "005380", "373220"];

/**
 * 데모 화이트리스트에서 1건을 찾는다. **여기 없다고 해서 상장되지 않은 종목이 아니다** —
 * 화이트리스트 밖 종목의 이름은 `findListedStock`(종목 마스터)이 안다.
 *
 * 시드 프로비저닝처럼 "손으로 고른 27종만 다루는" 자리에서만 쓴다.
 */
export function findDemoStock(ticker: string): Stock | undefined {
  return DEMO_WHITELIST.find((s) => s.ticker === ticker);
}

/** S1.5 "인기 종목" 목록. 화이트리스트에서 뽑으므로 큐레이션된 업종 라벨이 붙어 있다. */
export function popularStocks(): Stock[] {
  return POPULAR_TICKERS.map(findDemoStock).filter((s): s is Stock => s !== undefined);
}
