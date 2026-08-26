import { notFound } from "next/navigation";
import { findStock } from "@/lib/mock";
import { ThesisResultView } from "./thesis-result-view";

// S3 AI 검증 결과
export default async function ThesisResultPage({
  params,
}: PageProps<"/thesis/[ticker]/result">) {
  const { ticker } = await params;
  const stock = findStock(ticker);
  if (!stock) notFound();

  return <ThesisResultView ticker={stock.ticker} stockName={stock.name} />;
}
