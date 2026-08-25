# before-buy

투자 아이디어 검증기 프로토타입 (4일 제약 MVP).

## 스택

- Next.js (App Router) + TypeScript + Tailwind CSS
- shadcn/ui (Base UI)
- Bun (패키지 매니저 / 런타임)
- Neon (Postgres) + Drizzle ORM
- 한국투자증권 **모의투자** REST API (실계좌 미사용)

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
