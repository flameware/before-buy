"use client";

import { createContext, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToastViewport } from "@/components/ui/toast";

/**
 * Drawer(base-ui)의 Portal은 기본적으로 `document.body`에 붙는다 — React 트리상
 * PhoneFrame 안에 있어도 DOM 트리에서는 바깥으로 빠지므로, 프레임 자체의
 * `[contain:layout]`은 그 노드에 적용되지 않는다(컨테인먼트는 실제 DOM 후손에만
 * 적용됨). Drawer가 이 컨텍스트로 프레임 엘리먼트를 받아 그 안에 포탈하게 한다.
 */
export const PhoneFrameContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

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
  const frameRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex min-h-dvh w-full justify-center bg-muted sm:items-center sm:py-10">
      <div
        ref={frameRef}
        className={cn(
          // `[contain:layout]`은 폰 프레임을 하위 `position:fixed` 요소(Drawer 오버레이/뷰포트 등)의
          // containing block으로 만든다 — 없으면 bottom sheet가 데스크톱 너비에서 프레임을
          // 벗어나 브라우저 전체를 덮는다. Drawer 쪽에서 이 엘리먼트로 직접 portal해야 실제로 적용된다.
          "group relative flex h-dvh w-full flex-col overflow-hidden bg-background [contain:layout]",
          // 곡률은 `rounded-md`(= `--radius-md`, 11.2px) — 기기 목업이 아니라 뷰포트 액자라서
          // 앱의 radius 스케일을 따른다. 예전의 40px은 카드(14px)의 2.9배라 헤더 좌우를
          // 파고들었다. 토큰 밖 상수로 되돌리지 말 것 (#125).
          "sm:h-[874px] sm:w-[402px] sm:rounded-md sm:border sm:border-border sm:shadow-xl",
        )}
      >
        {/* Provider가 `children`까지 감싸는 이유: 화면 안에서 여는 오버레이(S5의 관심종목
            해제 확인 AlertDialog 등)도 같은 이유로 프레임 안에 포탈해야 한다. modal 슬롯만
            감싸두면 그런 다이얼로그가 데스크톱에서 402px 액자를 벗어나 화면 전체를 덮는다. */}
        <PhoneFrameContext.Provider value={frameRef}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          {modal}
        </PhoneFrameContext.Provider>
        {/* 프레임의 DOM 후손이라 데스크톱에서도 402px 액자 안 하단에 머문다. */}
        <ToastViewport />
      </div>
    </div>
  );
}
