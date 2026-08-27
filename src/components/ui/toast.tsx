"use client";

import { Toast } from "@base-ui/react/toast";
import { cn } from "@/lib/utils";

/**
 * 지나가는 알림. 이 앱에서는 **변동 요약**(CONTEXT.md)이 유일한 사용처다.
 *
 * 탭할 수 없다 — 요약이 맡는 일은 진입점이 아니라 주의 환기이고(#103), 눌러도 아무 일이
 * 없다는 사실이 손끝에 먼저 닿게 `pointer-events-none`으로 못 박는다. `달라짐` 종목으로
 * 가는 길은 카드 배지가 그대로 맡는다.
 *
 * 읽히는 것은 Base UI가 뷰포트의 `aria-live`로 처리한다 — `Toast.Root` 자체는
 * `role="dialog"`라 여기서 role을 덧씌우면 그 구조가 깨진다.
 */

/** 4초 — 탭할 수 없으므로 "잡을 시간"은 필요 없고 "읽을 시간"만 있으면 된다. */
const TOAST_TIMEOUT_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // limit 1: 이 앱의 토스트는 한 종류뿐이라 쌓일 일이 없다.
  return (
    <Toast.Provider timeout={TOAST_TIMEOUT_MS} limit={1}>
      {children}
    </Toast.Provider>
  );
}

export const useToastManager = Toast.useToastManager;

/**
 * 폰 프레임 안 하단 중앙. Portal을 쓰지 않고 프레임의 DOM 후손으로 직접 렌더한다 —
 * 프레임이 `relative`라 `absolute` 하나로 데스크톱에서도 402px 액자 안에 머문다.
 * 상단은 방금 누른 토글·안내문구와 자리가 겹쳐 무엇이 무엇인지 흐려진다(#103).
 */
export function ToastViewport() {
  const { toasts } = useToastManager();

  return (
    <Toast.Viewport className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6 outline-none">
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          className={cn(
            // 붉은 톤은 `달라짐` 배지와 눈이 연결되도록 유지하되, 배지의 반투명 배경과 달리
            // 목록 위에 떠야 하므로 불투명 + 그림자.
            "pointer-events-none w-fit max-w-full rounded-full bg-destructive px-4 py-2.5",
            "text-center text-sm font-medium text-white shadow-lg select-none",
            "transition-[opacity,transform] duration-300",
            "data-starting-style:translate-y-3 data-starting-style:opacity-0",
            "data-ending-style:translate-y-3 data-ending-style:opacity-0",
            // limit을 넘긴 토스트는 제거되지 않고 `inert`로 남는다 — 가로로 늘어서지 않게 감춘다.
            "data-limited:hidden",
          )}
        >
          <Toast.Title />
        </Toast.Root>
      ))}
    </Toast.Viewport>
  );
}
