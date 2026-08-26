import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/layout/screen-header";
import { findStock } from "@/lib/mock";

// S4 주문 전 확인 — 직접 URL 접근/새로고침 시의 전체 페이지 폴백.
// 소프트 내비게이션에서는 `@modal`의 인터셉트 라우트가 bottom sheet로 대신 렌더한다.
// 실제 내용은 이 티켓의 범위 밖 (골격만 확정).
export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  const stock = findStock(id);
  if (!stock) notFound();

  return (
    <>
      <ScreenHeader title="주문 전 확인" />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        S4 주문 전 확인 — {stock.name}
      </div>
    </>
  );
}
