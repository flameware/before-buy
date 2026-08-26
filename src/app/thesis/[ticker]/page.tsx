import { notFound } from "next/navigation";
import { findStock } from "@/lib/mock";
import { ThesisFlow } from "./thesis-flow";

// S2 근거 입력 (3-step)
export default async function ThesisPage({
  params,
}: PageProps<"/thesis/[ticker]">) {
  const { ticker } = await params;
  const stock = findStock(ticker);
  if (!stock) notFound();

  return <ThesisFlow ticker={stock.ticker} stockName={stock.name} />;
}
