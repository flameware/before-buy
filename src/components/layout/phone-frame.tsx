import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 모든 화면이 도는 모바일 뷰포트 컨테이너. 기술스펙 1장 — 폼팩터는
 * 402×874 고정, 데스크톱에서는 중앙 정렬 + 여백. 실제 기기에서는
 * 402px가 뷰포트 전체를 채우고, 넓은 화면에서만 액자처럼 보인다.
 */
export function PhoneFrame({
  children,
  modal,
}: {
  children: ReactNode;
  modal?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-muted sm:items-center sm:py-10">
      <div
        className={cn(
          "relative flex h-dvh w-full flex-col overflow-hidden bg-background",
          "sm:h-[874px] sm:w-[402px] sm:rounded-[2.5rem] sm:border sm:border-border sm:shadow-xl",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        {modal}
      </div>
    </div>
  );
}
