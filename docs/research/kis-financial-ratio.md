# KIS 재무비율 API 실전 검증 — PER/PBR 필드명 확인 (issue #13)

실전 조회 전용 키(`KIS_REAL_APPKEY_READONLY`)로 삼성전자(005930)를 대상으로
`quote-client.ts`의 `getKoreanStockPrice()`/`getFinancialRatio()`를 실제 호출해
확인. 2026-08-25.

## 결론: PER/PBR은 재무비율 API가 아니라 현재가 API에 있다

기술스펙 v3(5-1장)과 issue #13 티켓은 재무비율(`FHKST66430300`) 응답에서
PER/PBR 필드명을 확인하는 것을 완료 조건으로 뒀지만, 실 호출 결과 **재무비율
응답에는 PER/PBR이 없다.** 두 값 모두 현재가(`FHKST01010100`, `inquire-price`)
응답에 이미 `per`/`pbr` 필드로 실려 온다.

- `KoreanPriceOutputSchema`(`schemas.ts`)에 `per`/`pbr` 옵셔널 필드 추가,
  `getKoreanStockPrice()`가 반환하는 `ProcessedStockPrice`에도 `per`/`pbr` 노출.
- 재무비율 API를 호출할 필요가 사라진 것은 아니다 — `eps`/`bps`/`roe_val`(자기자본
  이익률) 등은 현재가 응답에 없고 재무비율 응답에만 있다. 다만 **밸류에이션 전제
  판정(PER/PBR 기준)만 필요하다면 현재가 호출 한 번으로 충분**하다.

## 확인된 응답 필드

### 현재가 (`FHKST01010100`, `/uapi/domestic-stock/v1/quotations/inquire-price`)

관련 필드만 발췌 (전체는 `KoreanPriceOutputSchema`가 `looseObject`라
`metadata.originalData`에 원본 그대로 보존됨):

| 필드 | 값 (005930, 2026-08-25) | 의미 |
|---|---|---|
| `per` | `"39.15"` | PER |
| `pbr` | `"4.02"` | PBR |
| `eps` | `"6564.00"` | 주당순이익 |
| `bps` | `"63997.00"` | 주당순자산 |
| `stck_prpr` | `"257000"` | 현재가 |

### 재무비율 (`FHKST66430300`, `/uapi/domestic-stock/v1/finance/financial-ratio`)

파라미터: `FID_DIV_CLS_CODE=0`(년), `fid_cond_mrkt_div_code=J`, `fid_input_iscd=005930`.
`output`은 배열(기간별) — 가장 최근 기간이 0번 인덱스.

| 필드 | 값 (최근 분기) | 의미 |
|---|---|---|
| `stac_yymm` | `"202606"` | 결산년월 |
| `grs` | `"98.6700"` | 매출액증가율 |
| `bsop_prfi_inrt` | `"1191.4400"` | 영업이익증가율 |
| `ntin_inrt` | `"790.9700"` | 순이익증가율 |
| `roe_val` | `"31.39"` | ROE |
| `eps` | `"17687.00"` | 주당순이익 (분기 기준, 현재가 응답의 eps와 다른 기간) |
| `sps` | `"72276"` | 주당매출액 |
| `bps` | `"86052.00"` | 주당순자산 |
| `rsrv_rate` | `"57213.7600"` | 유보율 |
| `lblt_rate` | `"31.1000"` | 부채비율 |

**PER/PBR 필드 없음.**

## 확인 방법

`scripts/verify-financial-ratio.ts`(일회성, 커밋 대상 아님)로 두 엔드포인트를
호출해 `metadata.originalData`를 그대로 출력, 육안 확인. 재현하려면:

```
bun --env-file=.env.local --conditions=react-server run scripts/verify-financial-ratio.ts [ticker]
```

KIS 접근토큰 발급은 분당 1회 제한 — 연속 실행 시 `EGW00133` 403이 난다.
