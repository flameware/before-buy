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
          // 곡률은 `rounded-md`(= `--radius-md`, `--radius`의 0.8배) — 기기 목업이 아니라 뷰포트
          // 액자라서 앱의 radius 스케일을 따른다. 예전에 박아둔 40px은 당시 카드 곡률의 2.9배라
          // 헤더 좌우를 파고들었다. 수치를 적지 않는 것은 스케일이 통째로 움직이기 때문이다(#145) —
          // 액자가 카드(1.8배)보다 덜 둥글다는 관계만이 지켜야 할 것이다.
          // 토큰 밖 상수로 되돌리지 말 것 (#125).
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
      <PhoneQrPanel />
    </div>
  );
}

/**
 * 데스크톱 여백에 상주하는 "휴대폰으로 열기" 안내판. 액자는 "이건 폰 화면이다"라고
 * 말하지만 거기서 그치므로, 배포 주소를 담은 QR로 그 문장을 끝맺는다 (#147).
 *
 * 프레임의 후손이 아니라 **형제**여야 한다 — 프레임의 `[contain:layout]`이 하위
 * `position:fixed`의 containing block이 되므로, 안에 두면 402px 액자에 갇힌다.
 *
 * 흐름에 두지 않고 `fixed`인 이유: 액자는 874px + `py-10`으로 이미 세로 954px을 쓴다.
 * 노트북 뷰포트에서는 프레임 아래 여백이 0이라, 거기 놓인 안내는 스크롤해야 보인다.
 *
 * `md` 미만에서 숨기는 이유와 치수가 빡빡한 이유: 액자가 954px(874 + `py-10`)이라 데스크톱
 * 세로에서 항상 스크롤바가 서고, 액자는 그걸 뺀 폭에서 중앙 정렬된다. 여백 한쪽은
 * `(뷰포트 - 스크롤바 - 402) / 2`라 768px에서 175.5px뿐이다. 카드는 `128 + 12×2 + 테두리
 * = 154px`, 오프셋 16px까지 170px — 5.5px 여유다. 패딩이나 오프셋을 키우면 `md`에서 액자를
 * 파고든다. QR을 줄여 여유를 사는 대안은 357px 원본을 뭉개 스캔을 실패시킨다 — 스캔되라고
 * 놓는 물건이라 그게 유일한 실패 모드다.
 *
 * 시트가 열려도 남는다: Drawer/AlertDialog 오버레이는 프레임 안으로 포탈되므로 이 노드를
 * 덮지 않는다. 숨기려면 앱 상태를 프레임 밖으로 새게 하는 결합이 필요하다.
 */
function PhoneQrPanel() {
  return (
    <div className="fixed right-4 bottom-4 hidden rounded-md border border-border bg-background p-3 shadow-xl md:block">
      {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 SVG 한 장이라 최적화할 것이 없다 */}
      <img
        src="/qr.svg"
        alt="사기 전에 모바일 주소 QR 코드 — before-buy-stock.vercel.app"
        width={128}
        height={128}
        className="block size-32"
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">휴대폰으로 열기</p>
    </div>
  );
}
