/**
 * 종목 마스터의 **순수 계산** — 파싱·검색 랭킹·티커 형식 검증 (#92, ADR-0008).
 *
 * 다운로드와 캐시는 `stock-master.ts`(server-only)에 있고 여기에는 없다. 이 분리는
 * 취향이 아니라 테스트 제약이다 — 서버 전용 모듈을 끌고 들어오는 파일은 node 환경에서
 * 임포트할 수 없다(vitest.config.mts, ADR-0006). #88에서 시드 판정 설정을 서버 전용
 * 모듈 밖으로 옮긴 것과 같은 이유다.
 *
 * 마스터 파일은 EUC-KR 고정폭 텍스트다. 한 줄에서 우리가 쓰는 건 셋뿐이다:
 *   [0:9]                         단축코드 (주권은 6자리, ELW·펀드는 8~9자리라 길이로 걸러낸다)
 *   [9:21]                        표준코드 (미사용)
 *   [21:len-trailer]              한글 종목명
 *   [len-trailer+1:len-trailer+3] 그룹코드 (ST=주권, EF=ETF, RT=리츠, EN=ETN …)
 */

import type { Stock } from "@/lib/mock/types";

/**
 * **트레일러 길이는 파일마다 다르다** — KOSPI는 228, KOSDAQ은 222다. 하나로 뭉뚱그리면
 * KOSDAQ 종목명이 앞뒤로 잘려 나가 검색에 아예 안 걸린다(자매 프로젝트에서 에코프로비엠이
 * 통째로 사라졌던 회귀). 아래 테스트가 두 값을 모두 잠근다.
 */
export const MASTER_SOURCES = [
  {
    url: "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
    trailerLength: 228,
    exchange: "KOSPI",
  },
  {
    url: "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
    trailerLength: 222,
    exchange: "KOSDAQ",
  },
] as const satisfies ReadonlyArray<{
  url: string;
  trailerLength: number;
  exchange: Stock["exchange"];
}>;

/**
 * **주권(ST)만 남긴다.** 자매 프로젝트는 ETF·리츠·펀드까지 받지만("내가 산 것을 기록"하는
 * 앱이라 맞다), 이 제품은 LLM이 개별 기업 근거를 반문하는 앱이다 — "KODEX 200을 왜
 * 담으셨나요"에 기업 단위 반론(`counterpoints`)을 만들어내면 그건 헛소리다 (#92).
 *
 * 우선주는 `ST`라 그대로 들어온다. 목록에서 빼지 않는 이유는 마스터 그룹코드가 본주와
 * 우선주를 가르지 않아 이름 문자열 휴리스틱이 유일한 수단인데, "대한제강우"와
 * "한국우주항공"을 오분류할 위험을 감수할 만큼 얻는 게 없기 때문이다. 대신
 * `searchStockMaster`의 랭킹이 본주를 위로 올린다.
 */
const TRADABLE_GROUPS = new Set(["ST"]);

export function parseMaster(
  text: string,
  trailerLength: number,
  exchange: Stock["exchange"],
): Stock[] {
  const stocks: Stock[] = [];

  for (const line of text.split("\n")) {
    if (line.length <= trailerLength + 21) continue;

    const ticker = line.slice(0, 9).trim();
    if (ticker.length !== 6) continue;

    const nameEnd = line.length - trailerLength;
    const group = line.slice(nameEnd + 1, nameEnd + 3);
    if (!TRADABLE_GROUPS.has(group)) continue;

    const name = line.slice(21, nameEnd).trim();
    if (!name) continue;

    // sector는 넣지 않는다 — 마스터는 업종을 주지 않으며, 상장 종목의 업종이 비는 것은
    // 정상이다 (CONTEXT.md "상장 종목").
    stocks.push({ ticker, name, exchange });
  }

  return stocks;
}

/**
 * S1.5 검색 결과 상한. 상장 종목 전체가 대상이 되면 "삼성"만 쳐도 후보가 쉽게 10을 넘고,
 * 원하는 종목이 잘려나가면 사용자는 검색이 고장난 줄 안다 (#92).
 *
 * `actions.ts`가 아니라 여기 사는 이유: `"use server"` 모듈은 async 함수 외의 export를
 * 허용하지 않는다.
 */
export const SEARCH_RESULT_LIMIT = 20;

/**
 * 종목명 또는 종목코드로 상장 종목을 검색한다.
 *
 * 정렬은 "사람이 기대하는 순서"에 맞춘다: 정확히 일치 → 앞에서부터 일치 → 중간 포함 순이고,
 * 같은 등급 안에서는 이름이 짧은 쪽이 먼저다. "삼성전자"를 치면 삼성전자우보다 삼성전자가
 * 위에 온다 — 우선주를 목록에서 빼지 않고도 노이즈가 정리되는 이유다.
 */
export function searchStockMaster(stocks: Stock[], query: string, limit: number): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  const needle = normalize(q);

  const scored: Array<{ stock: Stock; rank: number }> = [];

  for (const stock of stocks) {
    const name = normalize(stock.name);
    let rank: number;

    if (stock.ticker === q) rank = 0;
    else if (name === needle) rank = 1;
    else if (stock.ticker.startsWith(q)) rank = 2;
    else if (name.startsWith(needle)) rank = 3;
    else if (name.includes(needle)) rank = 4;
    else continue;

    scored.push({ stock, rank });
  }

  scored.sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : a.stock.name.length - b.stock.name.length,
  );

  return scored.slice(0, limit).map((entry) => entry.stock);
}

/**
 * 라우트의 존재 가드. 마스터가 아니라 **형식**만 본다.
 *
 * 마스터를 종목 존재의 심판자로 앉히면, 다운로드가 한 번 실패해 목록이 비는 순간 모든
 * 종목이 404가 된다 — 네트워크 실패가 "그런 종목 없음"으로 둔갑하는 것이다(#79·#81과
 * 같은 계보). 실제 존재 확인은 S3의 KIS 시세 조회(`quote-unavailable`)가 맡는다.
 *
 * **6자리 숫자가 아니다.** 실 마스터 2,720종 중 79종이 영문자를 포함한다 — 신형 우선주
 * 코드(`00088K` 한화3우B, `02826K` 삼성물산우B)와 신규 상장(`0126Z0` 삼성에피스홀딩스,
 * `0001A0` 덕양에너젠)이다. `/^\d{6}$/`로 막으면 그 79종이 전부 404가 된다 (#92).
 * 길이는 언제나 6이다(실측: 2,720종 전부).
 */
export function isTickerShaped(ticker: string): boolean {
  return /^[0-9A-Za-z]{6}$/.test(ticker);
}
