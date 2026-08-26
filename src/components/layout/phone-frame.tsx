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
          // `[contain:layout]`은 폰 프레임을 하위 `position:fixed` 요소(Drawer 오버레이/뷰포트 등)의
          // containing block으로 만든다 — 없으면 bottom sheet가 데스크톱 너비에서 프레임을
          // 벗어나 브라우저 전체를 덮는다.
          "relative flex h-dvh w-full flex-col overflow-hidden bg-background [contain:layout]",
          "sm:h-[874px] sm:w-[402px] sm:rounded-[2.5rem] sm:border sm:border-border sm:shadow-xl",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        {modal}
      </div>
    </div>
  );
}
