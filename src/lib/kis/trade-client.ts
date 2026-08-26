// KIS trade client — 모의 도메인, 주문/잔고(write).
//
// 이 파일은 KIS_MOCK_APPKEY/KIS_MOCK_APPSECRET/KIS_BASE_URL(모의 도메인)만 참조한다 —
// 실전 조회 전용 자격증명(KIS_REAL_APPKEY_READONLY 등)은 quote-client.ts에만 있고
// 이 파일에서는 import조차 하지 않는다. 실계좌에 실수로 주문이 나가는 사고를
// 구조적으로 막기 위한 분리다(spec 5-1, issue #13).
//
// 잔고 조회(inquire-balance)·현금 주문(order-cash) 메서드는 아직 이식되지 않았다
// (issue #5 조사 시점에 investmentdiary에는 대응 코드가 없었음) — Day 2~4 빌드
// 범위에서 추가된다. 지금은 도메인·자격증명 분리 골격만 갖춘다.

import "server-only";
import { KISAuthService } from "./auth";

const KIS_DEMO_BASE_URL = "https://openapivts.koreainvestment.com:29443";

export const tradeAuth = new KISAuthService({
  baseUrl: process.env.KIS_BASE_URL || KIS_DEMO_BASE_URL,
  appKey: process.env.KIS_MOCK_APPKEY || "",
  appSecret: process.env.KIS_MOCK_APPSECRET || "",
  tokenKey: "trade",
  label: "trade-client (모의 주문/잔고)",
});
