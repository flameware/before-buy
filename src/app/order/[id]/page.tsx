import { notFound } from "next/navigation";
import { OrderConfirmContent } from "@/components/order/order-confirm-content";
import { findStock } from "@/lib/mock";

// S4 주문 전 확인 — 직접 URL 접근/새로고침 시의 전체 페이지 폴백.
// 소프트 내비게이션에서는 `@modal`의 인터셉트 라우트가 bottom sheet로 대신 렌더한다.
//
// 관심종목 존재 여부는 여기서 확인하지 않는다 — 이 파일이 db를 (간접적으로도) import하면
// Next 빌드의 "Collecting page data" 단계가 그 모듈을 즉시 평가해 DATABASE_URL이 없는
// 빌드 환경에서 크래시한다(다른 모든 Server Component page.tsx가 findStock 같은 순수
// mock 조회만 하는 이유와 동일). 세션 소유 여부 확인은 OrderConfirmContent가 Server
// Action으로 조회한 뒤 인라인 에러 상태로 처리한다.
export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  const stock = findStock(id);
  if (!stock) notFound();

  return <OrderConfirmContent ticker={stock.ticker} stockName={stock.name} variant="page" />;
}
