import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/layout/screen-header";
import { findStock } from "@/lib/mock";

// S5 관심종목 상세 — 구현은 이 티켓의 범위 밖 (골격만 확정).
export default async function StockDetailPage({
  params,
}: PageProps<"/stocks/[id]">) {
  const { id } = await params;
  const stock = findStock(id);
  if (!stock) notFound();

  return (
    <>
      <ScreenHeader title={stock.name} />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        S5 관심종목 상세
      </div>
    </>
  );
}
