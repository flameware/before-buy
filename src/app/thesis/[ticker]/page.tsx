import { notFound } from "next/navigation";
import { isTickerShaped } from "@/lib/kis/stock-master-parse";
import { resolveStock } from "@/lib/stock/resolve-stock";
import { isTickerWatched } from "@/lib/watchlist/get-watchlist-item";
import { ThesisFlow } from "./thesis-flow";

// S2 근거 입력 (3-step)
// 존재 가드는 **티커 형식**만 본다. 종목 마스터를 존재의 심판자로 앉히면 다운로드
// 실패 한 번에 모든 종목이 404가 된다 — 네트워크 실패를 "그런 종목 없음"으로 둔갑시키지
// 않는다(ADR-0008, #79·#81). 실제 존재 확인은 S3의 KIS 시세 조회가 맡는다.
export default async function ThesisPage({
  params,
}: PageProps<"/thesis/[ticker]">) {
  const { ticker } = await params;
  if (!isTickerShaped(ticker)) notFound();

  // 이미 담긴 종목이면 Step 1의 "건너뛰기"를 감춘다 — 근거 없이 한 번 더 담아
  // 중복 카드를 만드는 길을 열어두지 않는다 (#96). 클라이언트 캐시가 아니라 여기서
  // 판정하는 이유는 직접 URL 진입·새로고침에도 답이 같아야 하기 때문이다.
  const [stock, alreadyWatched] = await Promise.all([
    resolveStock(ticker),
    isTickerWatched(ticker),
  ]);
  return (
    <ThesisFlow ticker={stock.ticker} stockName={stock.name} alreadyWatched={alreadyWatched} />
  );
}
