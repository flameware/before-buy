import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/layout/screen-header";
import { findStock } from "@/lib/mock";

// S3 AI 검증 결과 — 구현은 이 티켓의 범위 밖 (골격만 확정).
export default async function ThesisResultPage({
  params,
}: PageProps<"/thesis/[ticker]/result">) {
  const { ticker } = await params;
  const stock = findStock(ticker);
  if (!stock) notFound();

  return (
    <>
      <ScreenHeader title={stock.name} />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        S3 AI 검증 결과
      </div>
    </>
  );
}
