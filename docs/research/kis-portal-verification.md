## TR_ID 확인 결과

yes

## 접근토큰 정책

- 유효기간: 24시간
- 재발급 제한: 갱신발급주기 6시간. 제한정보는 특별히 없음
- 기타 호출 제한: none


## 추가 확인 (사용자 제공, 2026-08-25)

재무비율(financial-ratio) API는 TR_ID(FHKST66430300)는 실전/모의 공통이지만,
**모의투자 계좌로는 실제 데이터가 제공되지 않는다** — 실전투자 계좌에서만 조회 가능.
`src/lib/kis/tr-ids.ts`의 `KIS_TR_ID_DEMO`에서 `financialRatio`를 제외함. 대체 방안은
issue #9에서 결정.
