"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 모든 화면 헤더의 외곽. `ScreenHeaderRow`와 짝으로 쓴다.
 *
 * **행 사이 간격(`gap`)은 일부러 소유하지 않는다.** 타이틀 행 아래에 무엇이 쌓이는지는
 * 화면마다 다르고(S1은 서로 독립된 상태 문장들, `ScreenHeader`는 타이틀에 달라붙는 캡션)
 * 그 간격은 어긋난 적이 없다. 여기로 끌어올리면 셸이 화면 목록을 알게 된다 (#129).
 */
export function ScreenHeaderShell({ children }: { children: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-col border-b border-border px-4 py-3">{children}</header>
  );
}

/**
 * 타이틀이 앉는 행. 높이 `h-8`(32px)은 뒤로가기 버튼(`size-8`)이 차지하는 자리이며,
 * **버튼이 없는 화면에서도 비워둔다** — S1(홈)이나 S3 로딩처럼 뒤로갈 곳이 없어도 마찬가지다.
 * 이 자리를 안 잡으면 행이 `h1` 줄높이(24px)로 주저앉아 그 화면만 헤더가 8px 낮아지고,
 * 화면을 넘나들 때 타이틀 베이스라인이 뛴다 (#129).
 */
export function ScreenHeaderRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex h-8 items-center gap-2", className)}>{children}</div>;
}

/** S1.5/S2/S3/S4/S5 공통 헤더 — `←` + 타이틀. S1은 뒤로가기가 없는 홈이라 셸을 직접 쓴다. */
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
    <ScreenHeaderShell>
      <ScreenHeaderRow>
        <button
          type="button"
          onClick={onBack ?? (() => router.back())}
          aria-label="뒤로가기"
          className="-ml-2 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-base font-semibold">{title}</h1>
      </ScreenHeaderRow>
      {/* `pl-8`은 위 타이틀과 가로를 맞추는 값이라 셸이 아니라 여기 남는다 — 뒤로가기가 있는
          화면에만 해당한다. S1은 버튼이 영영 안 들어오므로 이 들여쓰기를 따라가지 않는다. */}
      {subtitle ? <div className="mt-1 pl-8 text-sm text-muted-foreground">{subtitle}</div> : null}
    </ScreenHeaderShell>
  );
}
