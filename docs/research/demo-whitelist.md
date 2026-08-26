# Demo Whitelist: KOSPI/KOSDAQ Candidate Stocks (Issue #10)

## Purpose

`before-buy` (투자아이디어 검증기) needs a curated demo whitelist of Korean-listed
stocks that the app can query for price quotes and PER/PBR financial ratios via
the 한국투자증권(KIS) 모의투자(paper trading) API. This document proposes a
candidate list of 26 large-cap, liquid, sector-diverse names with their 6-digit
KRX ticker codes (종목코드).

## Important limitation — read before using this list

**This is candidate research only, not a live-API-verified list.** The KIS
paper-trading adapter is not built yet (blocked on issue #7), so none of these
tickers have been confirmed to return valid quote/ratio data from the KIS
모의투자 API. Before this whitelist is wired into the app, someone must:

1. Confirm each ticker resolves correctly in the KIS API (모의투자 and/or 실전투자
   symbol master).
2. Confirm PER/PBR fields are populated and non-null for each name (some KIS
   endpoints omit ratios for certain issuers/periods).
3. Re-check the "red flags" section below against current news at
   implementation time — a company's status can change between this research
   date (2026-08-25) and when the feature ships.

Ticker codes below were cross-checked via web search against multiple
independent Korean/international financial data sources (see the `source`
column). A first general web search that asked for an AI-summarized "top
market cap" ranking returned an internally inconsistent, clearly unreliable
list (e.g. mismatched codes/companies) and was discarded — codes here instead
come from per-ticker verification queries against named sources (FnGuide,
Daum 금융, TradingView, Investing.com, Bloomberg/Yahoo Finance, Wikipedia),
plus author's prior knowledge of these very widely-cited large-cap codes,
sanity-checked against the same per-ticker searches.

## Selection criteria

- One (or occasionally two, for economically dominant sectors like
  semiconductors) representative per sector/industry — no sector is
  represented by more than 2 names.
- Large-cap, high-liquidity names a Korean retail-investor demo audience would
  recognize on sight (brand-name companies).
- Mix of KOSPI and KOSDAQ.
- Excludes anything flagged as recently delisted, under active investigation,
  in trading-halt/관리종목 status, or penny-stock/small-cap volatility profile.

## Candidate list (26 names, 24 sectors)

| 종목코드 | 종목명 | 업종 | source |
|---|---|---|---|
| 005930 | 삼성전자 (Samsung Electronics) | 반도체/전자 (Semiconductors) | Well-established code; cross-checked via search (Naver/Daum/TradingView listings) |
| 000660 | SK하이닉스 (SK Hynix) | 반도체 (Memory Semiconductors) | Well-established code; cross-checked via search |
| 005380 | 현대자동차 (Hyundai Motor) | 자동차 (Automobiles) | Well-established code; cross-checked via search |
| 012330 | 현대모비스 (Hyundai Mobis) | 자동차부품 (Auto Parts) | Well-established code; widely cited |
| 105560 | KB금융 (KB Financial Group) | 은행/금융지주 (Banking) | Well-established code; widely cited |
| 000810 | 삼성화재 (Samsung Fire & Marine Insurance) | 손해보험 (Non-life Insurance) | Well-established code; widely cited |
| 006800 | 미래에셋증권 (Mirae Asset Securities) | 증권 (Brokerage/Securities) | Well-established code; widely cited |
| 004170 | 신세계 (Shinsegae) | 백화점/유통 (Department Store Retail) | Well-established code; widely cited |
| 017670 | SK텔레콤 (SK Telecom) | 통신 (Telecom) | Well-established code; widely cited |
| 035420 | NAVER | 인터넷/플랫폼 (Internet Platform) | Well-established code; widely cited |
| 207940 | 삼성바이오로직스 (Samsung Biologics) | 바이오/제약 CDMO (Biopharma CDMO) | [FnGuide](https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?gicode=A207940), [Daum 금융](https://m.finance.daum.net/quotes/A207940) — verified via WebSearch |
| 005490 | POSCO홀딩스 (POSCO Holdings) | 철강 (Steel) | Well-established code; widely cited |
| 010950 | 에쓰오일 (S-Oil) | 정유/에너지 (Oil Refining) | Well-established code; widely cited |
| 352820 | 하이브 (HYBE) | 엔터테인먼트 (Entertainment) | [TradingView](https://kr.tradingview.com/ideas/352820), [FnGuide](https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?gicode=A352820) — verified via WebSearch |
| 004370 | 농심 (Nongshim) | 식음료 (Food & Beverage) | Well-established code; widely cited |
| 028260 | 삼성물산 (Samsung C&T) | 건설 (Construction) | Well-established code; widely cited |
| 011200 | HMM | 해운 (Shipping) | Well-established code; widely cited |
| 373220 | LG에너지솔루션 (LG Energy Solution) | 이차전지/배터리 (Secondary Cell/Battery) | [FnGuide](https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?gicode=A373220), [Wikipedia](https://en.wikipedia.org/wiki/LG_Energy_Solution) — verified via WebSearch |
| 012450 | 한화에어로스페이스 (Hanwha Aerospace) | 방위산업 (Defense) | [FnGuide](https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?gicode=A012450), [Daum 금융](https://m.finance.daum.net/quotes/A012450/home) — verified via WebSearch |
| 051910 | LG화학 (LG Chem) | 화학 (Chemicals) | Well-established code; widely cited |
| 003490 | 대한항공 (Korean Air) | 항공 (Airlines) | Well-established code; widely cited |
| 090430 | 아모레퍼시픽 (Amorepacific) | 화장품 (Cosmetics) | Well-established code; widely cited |
| 329180 | HD현대중공업 (HD Hyundai Heavy Industries) | 조선 (Shipbuilding) | [FnGuide](https://wcomp.fnguide.com/CompanyInfo/Snapshot?cmp_cd=329180), [Wikipedia](https://en.wikipedia.org/wiki/HD_Hyundai_Heavy_Industries) — verified via WebSearch |
| 066570 | LG전자 (LG Electronics) | 가전 (Home Appliances/Electronics) | Well-established code; widely cited |
| 293490 | 카카오게임즈 (Kakao Games) | 게임 (Gaming, KOSDAQ) | [FnGuide](https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?gicode=A293490), [TradingView](https://kr.tradingview.com/symbols/KRX-293490/) — verified via WebSearch |
| 383220 | F&F | 패션/의류 (Apparel, KOSPI) | [Bloomberg](https://www.bloomberg.com/quote/383220:KS), [Yahoo Finance](https://finance.yahoo.com/quote/383220.KS/), [FnGuide](https://wcomp.fnguide.com/CompanyInfo/Invest?cmp_cd=383220) — verified via WebSearch |

Note on exchange listing: the vast majority of the above are KOSPI-listed;
카카오게임즈 (293490) is the one KOSDAQ representative included, providing
cross-exchange coverage as requested. If the demo specifically wants more
KOSDAQ balance, good additional KOSDAQ large-cap candidates to consider in a
follow-up pass include 에코프로비엠 (battery materials), 알테오젠/HLB (biotech),
and 스튜디오드래곤 (content) — not included here to avoid sector duplication
with names already on the list (battery, biotech, entertainment).

## Candidates considered and excluded (red flags for a demo)

- **카카오 (Kakao, 035720)** — considered for "internet/platform" alongside
  NAVER, but excluded to avoid sector duplication (NAVER already covers this
  sector) and because Kakao has been subject to ongoing
  regulatory/prosecutorial scrutiny in recent years (SM Entertainment
  stock-manipulation probe involving its founder), which makes it a less
  "clean" demo pick even though it remains a large, liquid, actively-traded
  stock.
- **HMM** — included, but flagged for awareness: HMM has an unusual
  ownership/governance situation (state-affiliated creditors hold a large
  stake, and a sale process has been discussed on and off). Retained because
  it is still a liquid, well-known large-cap and a good "shipping" sector
  representative; the KIS-adapter builder should just be aware it's a
  somewhat special-situation name if the demo ever narrates ownership
  structure.
- **Penny-stock / small-cap names** — none included; every candidate above is
  a large-cap constituent of its sector, chosen specifically for the
  reliability of quote/ratio data this implies.
- **Recently delisted or 관리종목(administrative issue) names** — none found
  among the above during this research pass; this should be re-verified at
  implementation time since status can change.

## Next steps (for the KIS-adapter ticket, issue #7, and integration)

1. Once the KIS 모의투자 adapter exists, smoke-test each of the 26 codes above
   against the quote and financial-ratio (PER/PBR) endpoints.
2. Drop any ticker that returns null/missing PER or PBR consistently — flag
   for replacement with the sector's next-largest liquid alternative.
3. If demo scope should shrink to exactly 20, the safest names to cut first
   (least essential to sector coverage / hardest to guarantee clean ratio
   data) are: F&F (apparel — niche), Kakao Games (gaming — smaller cap than
   most others here), and one of the two semiconductor names (SK Hynix) if
   Samsung Electronics alone is judged sufficient to represent the sector.

---
*Research date: 2026-08-25. Author: flameware@gmail.com (via Claude Code
subagent). Scope: candidate list only — no live KIS API calls were made or
were possible, since the KIS paper-trading adapter (issue #7) does not yet
exist.*
