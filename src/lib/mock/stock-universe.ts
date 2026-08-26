import type { Stock } from "./types";

/**
 * 검색(S1.5) 대상 종목 전체. issue #10 리서치(docs 브랜치 `research/demo-whitelist`,
 * 아직 미병합)의 26종 후보를 그대로 옮김 — 실 API 연동 전이라 시세는 fixture 값.
 */
export const STOCK_UNIVERSE: Stock[] = [
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

/** S1.5 "인기 종목" 5개 — 화이트리스트에서 고정 선정. */
export const POPULAR_TICKERS = ["005930", "000660", "035420", "005380", "373220"];

export function findStock(ticker: string): Stock | undefined {
  return STOCK_UNIVERSE.find((s) => s.ticker === ticker);
}

export function searchStocks(query: string): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return STOCK_UNIVERSE.filter(
    (s) => s.name.toLowerCase().includes(q) || s.ticker.includes(q),
  );
}

/** 검색 결과에 시세를 붙일 때 쓰는 정적 fixture 가격 (실 API 연동 전). */
export const STATIC_QUOTES: Record<string, { price: number; changePercent: number }> = {
  "005930": { price: 84200, changePercent: 0.6 },
  "000660": { price: 212500, changePercent: -1.2 },
  "005380": { price: 241000, changePercent: 0.3 },
  "012330": { price: 268500, changePercent: -0.4 },
  "105560": { price: 92300, changePercent: 1.1 },
  "000810": { price: 385000, changePercent: 0.2 },
  "006800": { price: 12850, changePercent: -0.8 },
  "004170": { price: 178000, changePercent: 0.1 },
  "017670": { price: 42000, changePercent: -0.5 },
  "035420": { price: 218500, changePercent: 1.4 },
  "207940": { price: 1042000, changePercent: 0.7 },
  "005490": { price: 412000, changePercent: 2.1 },
  "010950": { price: 68900, changePercent: -0.3 },
  "352820": { price: 231000, changePercent: 1.8 },
  "004370": { price: 412500, changePercent: 0.2 },
  "028260": { price: 118000, changePercent: -0.6 },
  "011200": { price: 19850, changePercent: 3.2 },
  "373220": { price: 385000, changePercent: -1.1 },
  "012450": { price: 812000, changePercent: 2.6 },
  "051910": { price: 298000, changePercent: -0.9 },
  "003490": { price: 24950, changePercent: 0.4 },
  "090430": { price: 210000, changePercent: -1.5 },
  "329180": { price: 512000, changePercent: 1.9 },
  "066570": { price: 98500, changePercent: 0.5 },
  "293490": { price: 21400, changePercent: -2.3 },
  "383220": { price: 42800, changePercent: 0.8 },
  "377300": { price: 46300, changePercent: 0.4 },
};
