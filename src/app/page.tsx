import Link from "next/link";

// S1 관심종목 목록 (홈) — 구현은 이 티켓의 범위 밖 (골격만 확정).
export default function Home() {
  return (
    <>
      <header className="shrink-0 border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold">관심종목</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-sm text-muted-foreground">
        <p>S1 관심종목 목록</p>
        <div className="flex gap-3">
          <Link href="/search" className="underline">
            + 종목 추가
          </Link>
          <Link href="/order/017670" className="underline">
            구매 (S4 미리보기)
          </Link>
        </div>
      </div>
    </>
  );
}
