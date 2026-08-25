# before-buy

투자 아이디어 검증기 프로토타입 (4일 제약 MVP).

## 스택

- Next.js (App Router) + TypeScript + Tailwind CSS
- shadcn/ui (Base UI)
- Bun (패키지 매니저 / 런타임)
- Neon (Postgres) + Drizzle ORM
- 한국투자증권 REST API — 주문/잔고는 **모의투자**, 시세/재무비율 조회는 **실전 조회 전용 키**(주문 절대 불가)

## 시작하기

```bash
bun install
bun dev
```

`.env.example`을 `.env.local`로 복사하고 값을 채운다.

## 한투(KIS) 어댑터

한국투자증권 API 어댑터는 [`investmentdiary`](../investmentdiary) 프로젝트의
`src/lib/kis`에서 이식한다. 원본은 **실전투자** 기준으로 작성되어 있으며,
base URL과 TR_ID를 모의투자용으로 치환해야 한다. 토큰 인증과 시세 조회만
이식 대상이고, 재무비율/잔고/주문 관련 로직은 신규 작성이 필요하다.

모의투자 도메인은 재무비율(PER/PBR)을 제공하지 않으므로, 재무비율·시세
조회는 별도의 **실전 조회 전용** 앱키/시크릿(`KIS_REAL_APPKEY_READONLY` /
`KIS_REAL_APPSECRET_READONLY`, investmentdiary와 공유)으로 실전 도메인에
보낸다. 이 키는 조회 전용 클라이언트(`lib/kis/quote-client.ts`)에서만
참조되며, 주문·잔고를 다루는 거래 클라이언트(`lib/kis/trade-client.ts`)는
모의투자 자격증명(`KIS_MOCK_*`)만 참조해 실계좌에 주문이 나갈 경로를
구조적으로 차단한다.
