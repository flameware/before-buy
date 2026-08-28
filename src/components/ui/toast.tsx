"use client";

import { Toast } from "@base-ui/react/toast";
import { cn } from "@/lib/utils";

/**
 * 지나가는 알림. 용도는 두 가지다 — **변동 요약**(CONTEXT.md)과, 매수·매도가 아직
 * 구현되지 않았다는 안내(`useUnsupportedTradeToast`).
 *
 * **색이 둘을 가른다.** 변동 요약은 붉은 톤(`달라짐` 배지와 눈이 연결되도록), 그 외는
 * 무채색이다. 하나로 두면 "달라진 게 있어요"와 "지원하지 않아요"가 같은 빨간 알약으로
 * 번갈아 떠서 둘 다 흐려지고, 이제 빨강은 `구매` 버튼 색이기도 하다.
 *
 * 탭할 수 없다 — 요약이 맡는 일은 진입점이 아니라 주의 환기이고(#103), 눌러도 아무 일이
 * 없다는 사실이 손끝에 먼저 닿게 `pointer-events-none`으로 못 박는다. `달라짐` 종목으로
 * 가는 길은 카드 배지가 그대로 맡는다.
 *
 * 읽히는 것은 Base UI가 뷰포트의 `aria-live`로 처리한다 — `Toast.Root` 자체는
 * `role="dialog"`라 여기서 role을 덧씌우면 그 구조가 깨진다.
 */

/** 2.5초 — 탭할 수 없으므로 "잡을 시간"은 필요 없고 "읽을 시간"만 있으면 된다. */
const TOAST_TIMEOUT_MS = 2500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // limit 1: 한 번에 하나만 뜬다 — 변동 요약과 미구현 안내가 겹칠 일도 사실상 없다.
  return (
    <Toast.Provider timeout={TOAST_TIMEOUT_MS} limit={1}>
      {children}
    </Toast.Provider>
  );
}

/** 토스트의 색을 고르는 값. 기본(생략)은 변동 요약의 붉은 톤이다. */
export type ToastTone = "info";

export const useToastManager = Toast.useToastManager;

/**
 * 폰 프레임 안 하단 중앙. Portal을 쓰지 않고 프레임의 DOM 후손으로 직접 렌더한다 —
 * 프레임이 `relative`라 `absolute` 하나로 데스크톱에서도 402px 액자 안에 머문다.
 * 상단은 방금 누른 토글·안내문구와 자리가 겹쳐 무엇이 무엇인지 흐려진다(#103).
 *
 * `z-60`인 이유: Drawer도 `z-50`이고 같은 프레임에 **나중에** 포탈되므로, 같은 층에 두면
 * S4 시트가 토스트를 그대로 덮는다 — 시트 안의 `구매`가 띄우는 안내가 보이지 않는다(#105).
 *
 * **하단 액션 바나 시트가 있으면 그 위로 올라간다.** 위로 겹치는 것만으로는 부족한데,
 * 토스트를 띄우는 버튼이 바로 그 바 안에 있기 때문이다 — 방금 누른 버튼을 자기가 띄운
 * 안내가 가리면 무엇에 대한 응답인지 흐려진다. 올림폭(`pb-24`)은 `size="lg"` 한 줄짜리
 * 바의 높이(py-3 + h-12 + py-3 = 72px)에 여백을 더한 값이다.
 */
export function ToastViewport() {
  const { toasts } = useToastManager();

  return (
    <Toast.Viewport
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-60 flex justify-center px-4 pb-6 outline-none",
        "group-has-[[data-slot=action-bar]]:pb-24 group-has-[[data-slot=drawer-popup]]:pb-24"
      )}
    >
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          className={cn(
            // 배지의 반투명 배경과 달리 목록 위에 떠야 하므로 불투명 + 그림자.
            "pointer-events-none w-fit max-w-full rounded-full px-4 py-2.5",
            "text-center text-sm font-medium text-white shadow-lg select-none",
            // 붉은 톤은 `달라짐` 배지와 눈이 연결되도록 변동 요약에만 남긴다.
            toast.data?.tone === "info" ? "bg-foreground" : "bg-destructive",
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
