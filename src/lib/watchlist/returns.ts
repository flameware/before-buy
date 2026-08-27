// S5 `가격 흐름`이 점선 아래에 그리는 두 수익률 — **기준이 다른 두 값**이 사는 곳.
//
// 이 파일이 생긴 이유(#86): "담은 날 대비" 자리에 `QuoteSnapshot.changePercent`
// (KIS `prdy_ctrt` — **전일 대비**)가 그대로 배선되어 있었다. 관심종목에서는 `담은 날 →
// 현재` 옆에 붙어 담은 날 대비로 읽혔고, 보유중에서는 아예 `근거 대비`라는 이름표를 달고
// 나갔다. 두 가격이 같은데 `-1.7%`가 붙는 화면이 그렇게 나온다.
//
// 화면명세 S5가 두 기준을 이미 정해두었다. **근거가 아직 유효한지는 담은 날 가격 기준,
// 실제 손익은 매수가 기준**이다. 담은 시점과 산 시점이 다를 수 있으므로 하나만 보여주면
// 둘 중 하나를 오해한다. 전일 대비는 S1 목록 카드의 등락률로 제 자리에 남는다 — 이 모듈은
// 전일 대비를 다루지 않는다.
//
// 컴포넌트 안의 인라인 산술이 아니라 모듈로 나온 이유: 그 자리에 있으면 ADR-0006 아래에서
// 잠글 수가 없다. 위 버그가 테스트 없이 살아남은 것도 계산이 JSX 옆에 있었기 때문이다.

/**
 * 기준 가격 대비 변화율(%). **기준이 없으면 `null`** — 호출부가 "0%"와 구별해야 한다.
 *
 * `addedPrice`는 DB 컬럼이 비어 있을 때 조회 계층에서 `0`으로 강제된다. 그대로 나누면
 * `Infinity`가 되어 화면에 `+Infinity%`가 뜬다. 그렇다고 `0`을 돌려주면 "기준이 없다"가
 * "안 변했다"로 둔갑한다 — 지어낸 0은 이 모듈이 고치러 온 거짓말과 같은 종류다.
 */
function percentAgainst(currentPrice: number, basePrice: number | null | undefined): number | null {
  if (basePrice == null || !Number.isFinite(basePrice) || basePrice <= 0) return null;
  if (!Number.isFinite(currentPrice)) return null;
  return ((currentPrice - basePrice) / basePrice) * 100;
}

/** **담은 날 대비** — 근거가 아직 유효한지를 보는 기준이다. 화면 문구도 같은 이름을 쓴다(#127). */
export function returnSinceAdded(currentPrice: number, addedPrice: number | null | undefined): number | null {
  return percentAgainst(currentPrice, addedPrice);
}

/** 매수가 대비. 화면 문구로는 **손익** — 실제로 번 돈과 잃은 돈이다. */
export function returnSinceBuy(currentPrice: number, avgBuyPrice: number | null | undefined): number | null {
  return percentAgainst(currentPrice, avgBuyPrice);
}
