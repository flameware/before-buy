"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** S1.5/S2/S3/S5 공통 헤더 — `←` + 타이틀. S1은 뒤로가기가 없는 홈이라 별도 구성. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
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
        <h1 className="text-base font-semibold">{title}</h1>
      </div>
      {subtitle ? <div className="pl-8 text-sm text-muted-foreground">{subtitle}</div> : null}
    </header>
  );
}
