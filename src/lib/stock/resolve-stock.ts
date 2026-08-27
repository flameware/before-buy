/**
 * 티커 하나를 화면·프롬프트가 쓸 이름과 업종으로 푼다 (#92).
 *
 * 출처가 둘이라 순서가 중요하다:
 *   1. **데모 화이트리스트** — 손으로 고른 27종. 큐레이션된 업종 라벨이 여기에만 있으므로
 *      먼저 본다. (마스터에도 같은 종목이 있지만 업종이 없다.)
 *   2. **상장 종목** — KIS 종목 마스터. 이름은 알고 업종은 모른다(ADR-0008).
 *
 * **실패하지 않는다.** 마스터를 읽지 못했거나 모르는 티커면 이름 자리에 티커를 그대로 쓴다 —
 * 이름을 모르는 것과 종목이 없는 것은 다르며, 여기서 `throw`하거나 `notFound()`를 유도하면
 * 마스터 다운로드 실패 한 번이 "그런 종목 없음"으로 둔갑한다(#79·#81과 같은 계보).
 * 실제 존재 확인은 S3의 KIS 시세 조회(`quote-unavailable`)가 맡는다.
 */

import "server-only";
import { findListedStock } from "@/lib/kis/stock-master";
import { findDemoStock } from "@/lib/mock/demo-whitelist";

export interface ResolvedStock {
  ticker: string;
  /** 모르면 티커 그대로. 화면 타이틀과 `watchlist_items.name`이 이 값을 쓴다. */
  name: string;
  /** 데모 화이트리스트 27종에만 있다. 없으면 화면도 프롬프트도 그 자리를 비운다. */
  sector?: string;
}

export async function resolveStock(ticker: string): Promise<ResolvedStock> {
  const demo = findDemoStock(ticker);
  if (demo) return { ticker, name: demo.name, sector: demo.sector };

  const listed = await findListedStock(ticker);
  if (listed) return { ticker, name: listed.name, sector: listed.sector };

  return { ticker, name: ticker };
}
