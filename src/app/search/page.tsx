import { ScreenHeader } from "@/components/layout/screen-header";

// S1.5 종목 검색 — 구현은 이 티켓의 범위 밖 (골격만 확정).
export default function SearchPage() {
  return (
    <>
      <ScreenHeader title="종목 검색" />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        S1.5 종목 검색
      </div>
    </>
  );
}
