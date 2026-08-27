/**
 * 국내 종목 마스터의 **다운로드와 캐시** — 검색(S1.5)이 닿는 상장 종목 전체의 출처
 * (#92, ADR-0008). 파싱·랭킹 등 순수 계산은 `stock-master-parse.ts`에 있다.
 *
 * KIS OpenAPI에는 **종목명으로 종목을 찾는 엔드포인트가 없다.** `CTPF1002R`(주식기본조회)는
 * 종목코드를 받아 이름을 돌려주는 단방향이라, "삼성전자"라고 쳐서 005930을 얻는 경로가 없다.
 * 대신 KIS가 배포하는 종목 마스터 파일을 그대로 쓴다 — 매일 갱신되고, 인증도 필요 없다.
 *
 * zip 해제는 의존성을 늘리지 않으려고 직접 한다. 파일은 항상 엔트리 하나짜리 deflate zip이라
 * 로컬 헤더만 읽고 `inflateRaw`로 풀면 된다.
 */

import "server-only";
import { inflateRawSync } from "node:zlib";
import type { Stock } from "@/lib/mock/types";
import { MASTER_SOURCES, parseMaster } from "./stock-master-parse";

/**
 * 마스터는 하루 한 번 갱신된다. 서버리스 인스턴스가 살아 있는 동안만 캐시하면 충분하다.
 *
 * #59(KIS 토큰 캐시가 인메모리라 배포 환경에서 간헐 실패)를 겪은 레포가 왜 또 인메모리
 * 캐시를 고르는지는 ADR-0008에 적었다 — 요약하면 **실패의 성격이 다르다**. 토큰은 캐시가
 * 비면 인증 자체가 깨졌지만, 마스터는 콜드스타트에서 220KB를 다시 받는 비용일 뿐이고
 * 다운로드가 실패해도 빈 배열로 접힌다.
 */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let cache: { stocks: Stock[]; fetchedAt: number } | null = null;
let inFlight: Promise<Stock[]> | null = null;

/**
 * 엔트리 하나짜리 zip에서 첫 파일의 내용을 꺼낸다.
 * 로컬 파일 헤더: [0:4] 시그니처, [8:10] 압축방식, [18:22] 압축크기,
 * [26:28] 파일명 길이, [28:30] extra 길이.
 */
function unzipSingleEntry(buffer: Buffer): Buffer {
  if (buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("not a zip archive");
  }
  const method = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  const dataStart = 30 + nameLength + extraLength;
  const dataEnd = compressedSize > 0 ? dataStart + compressedSize : buffer.length;
  const data = buffer.subarray(dataStart, dataEnd);

  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip compression method ${method}`);
}

async function downloadMaster(
  url: string,
  trailerLength: number,
  exchange: Stock["exchange"],
): Promise<Stock[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const zipped = Buffer.from(await res.arrayBuffer());
    const raw = unzipSingleEntry(zipped);
    // 마스터는 EUC-KR이다. Node는 full-ICU 빌드에서 'euc-kr'을 디코딩할 수 있다.
    const text = new TextDecoder("euc-kr").decode(raw);
    return parseMaster(text, trailerLength, exchange);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 상장 종목 전체를 가져온다. 실패하면 **던지지 않고 빈 배열**을 돌려준다.
 *
 * 호출부는 이 빈 배열을 **"그런 종목이 없다"로 해석하면 안 된다** — 다운로드 실패 한 번에
 * 모든 종목이 404가 된다. 라우트의 존재 가드는 `isTickerShaped`가 맡고, 실제 존재 확인은
 * S3의 KIS 시세 조회(`quote-unavailable`)가 한다 (ADR-0008, #79·#81).
 */
export async function getListedStocks(): Promise<Stock[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.stocks;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const results = await Promise.allSettled(
      MASTER_SOURCES.map((source) =>
        downloadMaster(source.url, source.trailerLength, source.exchange),
      ),
    );
    const stocks: Stock[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        stocks.push(...result.value);
      } else {
        console.error(
          `[KIS] 종목 마스터 다운로드 실패 ${MASTER_SOURCES[index]?.url} — ${result.reason}`,
        );
      }
    }

    // 캐시하지 않는다 — 다음 요청에서 다시 시도해야 한다.
    if (stocks.length === 0) return [];

    return stocks;
  })();

  try {
    const stocks = await inFlight;
    if (stocks.length > 0) cache = { stocks, fetchedAt: Date.now() };
    return stocks;
  } finally {
    inFlight = null;
  }
}

/**
 * 상장 종목 1건을 티커로 찾는다. 마스터를 읽지 못했거나 모르는 티커면 `undefined` —
 * 호출부는 이것을 "종목 없음"이 아니라 **"이름을 모른다"**로 다뤄야 한다.
 */
export async function findListedStock(ticker: string): Promise<Stock | undefined> {
  const stocks = await getListedStocks();
  return stocks.find((s) => s.ticker === ticker);
}
