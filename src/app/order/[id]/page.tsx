import { notFound } from "next/navigation";
import { OrderConfirmContent } from "@/components/order/order-confirm-content";
import { isTickerShaped } from "@/lib/kis/stock-master-parse";
import { resolveStock } from "@/lib/stock/resolve-stock";

// S4 주문 전 확인 — 직접 URL 접근/새로고침 시의 전체 페이지 폴백.
// 소프트 내비게이션에서는 `@modal`의 인터셉트 라우트가 bottom sheet로 대신 렌더한다.
//
// 관심종목 존재 여부는 여기서 확인하지 않는다 — 이 파일이 db를 (간접적으로도) import하면
// Next 빌드의 "Collecting page data" 단계가 그 모듈을 즉시 평가해 DATABASE_URL이 없는
// 빌드 환경에서 크래시한다. `resolveStock`은 종목 마스터와 데모 화이트리스트만 보므로
// 이 제약을 지킨다(모듈 평가 시점에 네트워크를 타지도 않는다). 세션 소유 여부 확인은
// OrderConfirmContent가 Server Action으로 조회한 뒤 인라인 에러 상태로 처리한다.
// 존재 가드는 **티커 형식**만 본다. 종목 마스터를 존재의 심판자로 앉히면 다운로드
// 실패 한 번에 모든 종목이 404가 된다 — 네트워크 실패를 "그런 종목 없음"으로 둔갑시키지
// 않는다(ADR-0008, #79·#81). 실제 존재 확인은 S3의 KIS 시세 조회가 맡는다.
export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  if (!isTickerShaped(id)) notFound();

  const stock = await resolveStock(id);
  return <OrderConfirmContent ticker={stock.ticker} stockName={stock.name} variant="page" />;
}
