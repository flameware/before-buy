import { notFound } from "next/navigation";
import { isTickerShaped } from "@/lib/kis/stock-master-parse";
import { resolveStock } from "@/lib/stock/resolve-stock";
import { ThesisResultView } from "./thesis-result-view";

// S3 AI 검증 결과
// 존재 가드는 **티커 형식**만 본다. 종목 마스터를 존재의 심판자로 앉히면 다운로드
// 실패 한 번에 모든 종목이 404가 된다 — 네트워크 실패를 "그런 종목 없음"으로 둔갑시키지
// 않는다(ADR-0008, #79·#81). 실제 존재 확인은 S3의 KIS 시세 조회가 맡는다.
export default async function ThesisResultPage({
  params,
}: PageProps<"/thesis/[ticker]/result">) {
  const { ticker } = await params;
  if (!isTickerShaped(ticker)) notFound();

  const stock = await resolveStock(ticker);
  return <ThesisResultView ticker={stock.ticker} stockName={stock.name} />;
}
