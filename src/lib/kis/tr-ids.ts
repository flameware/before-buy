/**
 * TR_ID constants for the Korea Investment & Securities (KIS) Open API.
 * 실전투자(REAL)와 모의투자(DEMO)는 매매/계좌 계열(T/J/C 접두)만 앞글자가
 * V로 바뀌고, 시세/재무 계열(F 접두)은 실전·모의 구분 없이 동일하다.
 *
 * 개발자센터(apiportal.koreainvestment.com) 문서로 확인 완료
 * (docs/research/kis-portal-verification.md, 2026-08-25).
 */

export const KIS_TR_ID_REAL = {
  inquirePrice: "FHKST01010100",
  financialRatio: "FHKST66430300",
  inquireBalance: "TTTC8434R",
  orderCashBuy: "TTTC0012U",
  orderCashSell: "TTTC0011U",
} as const;

/**
 * financialRatio(재무비율)는 TR_ID는 실전과 동일하지만 모의투자 계좌로는
 * 실제로 데이터가 제공되지 않는다 — 값을 넣어도 호출이 의미 없으므로
 * 이 객체에서 제외한다. 재무비율이 필요하면 KIS_TR_ID_REAL.financialRatio를
 * 실전 계좌 키로 호출해야 한다 (issue #9 참고).
 */
export const KIS_TR_ID_DEMO = {
  inquirePrice: "FHKST01010100",
  inquireBalance: "VTTC8434R",
  orderCashBuy: "VTTC0012U",
  orderCashSell: "VTTC0011U",
} as const;

/**
 * 접근토큰(POST /oauth2/tokenP) 정책 — 개발자센터 문서 확인:
 * - 유효기간 24시간
 * - 갱신발급주기 6시간 (그 안에는 캐시된 토큰 재사용, 재발급 자체에 대한
 *   별도 호출 제한 명시는 없음)
 * - 그 외 모의투자 REST 호출에 대한 일반 rate limit 명시 없음
 */
export const KIS_TOKEN_VALIDITY_HOURS = 24;
export const KIS_TOKEN_REISSUE_INTERVAL_HOURS = 6;
