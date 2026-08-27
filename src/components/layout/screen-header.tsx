"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * S1.5/S2/S3/S5 공통 헤더 — `←` + 타이틀. S1은 뒤로가기가 없는 홈이라 별도 구성.
 *
 * `action`은 타이틀 줄 오른쪽 끝에 붙는 자리다. 지금 쓰는 곳은 S5 관심종목의 북마크
 * 하나뿐 — 하단 바에 있던 `관심종목에서 제외`가 여기로 올라왔다(#105).
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  action?: ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="flex shrink-0 flex-col gap-1 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack ?? (() => router.back())}
          aria-label="뒤로가기"
          className="-ml-2 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        {action}
      </div>
      {subtitle ? <div className="pl-8 text-sm text-muted-foreground">{subtitle}</div> : null}
    </header>
  );
}
