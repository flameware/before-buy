import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/layout/screen-header";
import { findStock } from "@/lib/mock";

// S2 근거 입력 (3-step) — 구현은 이 티켓의 범위 밖 (골격만 확정).
export default async function ThesisPage({
  params,
}: PageProps<"/thesis/[ticker]">) {
  const { ticker } = await params;
  const stock = findStock(ticker);
  if (!stock) notFound();

  return (
    <>
      <ScreenHeader title={stock.name} subtitle="1/3" />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        S2 근거 입력 (3-step)
      </div>
    </>
  );
}
