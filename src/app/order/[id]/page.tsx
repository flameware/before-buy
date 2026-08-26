import { notFound } from "next/navigation";
import { OrderConfirmContent } from "@/components/order/order-confirm-content";
import { findStock } from "@/lib/mock";
import { getWatchlistItemForOrder } from "@/lib/watchlist/get-watchlist-item";

// S4 주문 전 확인 — 직접 URL 접근/새로고침 시의 전체 페이지 폴백.
// 소프트 내비게이션에서는 `@modal`의 인터셉트 라우트가 bottom sheet로 대신 렌더한다.
export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  const stock = findStock(id);
  if (!stock) notFound();

  // 세션의 관심종목이 아닌 티커(제거됐거나 애초에 담은 적 없음)로 직접 접근하면
  // order_events를 남길 watchlist_item_id가 없다 — 404로 처리한다.
  const item = await getWatchlistItemForOrder(stock.ticker, false);
  if (!item) notFound();

  return <OrderConfirmContent ticker={stock.ticker} stockName={stock.name} variant="page" />;
}
