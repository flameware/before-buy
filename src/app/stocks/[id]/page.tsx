import { notFound } from "next/navigation";
import { findStock } from "@/lib/mock";
import { StockDetailView } from "./stock-detail-view";

// S5 관심종목 상세
export default async function StockDetailPage({
  params,
}: PageProps<"/stocks/[id]">) {
  const { id } = await params;
  const stock = findStock(id);
  if (!stock) notFound();

  return <StockDetailView ticker={stock.ticker} stockName={stock.name} />;
}
