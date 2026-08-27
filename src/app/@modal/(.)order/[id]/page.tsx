import { OrderConfirmContent } from "@/components/order/order-confirm-content";
import { isTickerShaped } from "@/lib/kis/stock-master-parse";
import { resolveStock } from "@/lib/stock/resolve-stock";

// S4 주문 전 확인 — `/` 등에서 `구매`를 눌렀을 때 뜨는 bottom sheet.
// (..)order를 가로채 @modal 슬롯에서 렌더한다 (`/order/[id]`가 하드 내비게이션 폴백).
// Drawer 자체는 OrderConfirmContent(variant="modal")가 소유한다 — 취소 버튼/외부
// 탭/스와이프가 모두 같은 "나가기" 경로를 타야 order_events cancel이 정확히 한 번만
// 남기 때문.
//
// **Server Component다.** 종목 이름을 종목 마스터에서 `await`로 얻어야 하는데, 이 파일이
// 클라이언트였던 유일한 이유는 `use(params)`였다(#92). 클라이언트로 남겨두고 이름만 따로
// 조회하면 시트에 로딩 상태가 새로 생기는데, 그건 #74에서 "시트가 800ms 동안 빈 채로
// 보인다"고 고쳤던 바로 그 화면이다.
export default async function OrderModal({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  // 형식이 아니면 시트를 띄우지 않는다. 인터셉트 슬롯이라 notFound() 대신 null이다.
  if (!isTickerShaped(id)) return null;

  const stock = await resolveStock(id);
  return <OrderConfirmContent ticker={stock.ticker} stockName={stock.name} variant="modal" />;
}
