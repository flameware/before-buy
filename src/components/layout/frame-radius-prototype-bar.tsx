"use client";

/**
 * PROTOTYPE — 버릴 코드. 질문 하나에만 답한다: "데스크톱 액자의 모서리 radius는 얼마여야 하는가?"
 *
 * 기존 라우트 위에 그대로 얹는다(sub-shape A) — 실제 헤더·실제 카드·실제 밀도와 부딪혀 봐야
 * 곡률 판단이 선다. 프리셋 칩으로 후보값을 튕겨 보고, 슬라이더로 그 사이를 훑는다.
 * 상태는 메모리에만 있고(새로고침하면 초기값), 프로덕션 빌드에서는 렌더 자체를 하지 않는다.
 *
 * 값이 정해지면: phone-frame.tsx의 `--frame-radius`를 확정값으로 되돌리고 이 파일과
 * layout.tsx의 마운트를 지운다.
 */

import { useEffect, useState } from "react";

/** 1라운드에서 합의한 후보. 14 = 앱의 `--radius`(카드/버튼), 20 = 그 1.4배(`--radius-xl`). */
const PRESETS = [
  { px: 40, label: "현행" },
  { px: 24, label: "" },
  { px: 20, label: "제안 · --radius-xl" },
  { px: 16, label: "" },
  { px: 12, label: "" },
] as const;

const CARD_RADIUS_PX = 14;
const MIN = 0;
const MAX = 48;

export function FrameRadiusPrototypeBar() {
  const [px, setPx] = useState(40);

  useEffect(() => {
    document.documentElement.style.setProperty("--frame-radius", `${px}px`);
  }, [px]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") setPx((v) => Math.max(MIN, v - 1));
      else if (e.key === "ArrowRight") setPx((v) => Math.min(MAX, v + 1));
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ratio = (px / CARD_RADIUS_PX).toFixed(2);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] hidden justify-center p-4 sm:flex">
      <div className="pointer-events-auto flex items-center gap-4 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 font-mono text-xs text-neutral-100 shadow-2xl">
        <span className="font-semibold tracking-wide text-amber-400">PROTOTYPE</span>

        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.px}
              type="button"
              onClick={() => setPx(p.px)}
              title={p.label || undefined}
              className={
                "rounded px-2 py-1 tabular-nums transition-colors " +
                (px === p.px
                  ? "bg-neutral-100 text-neutral-900"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700")
              }
            >
              {p.px}
            </button>
          ))}
        </div>

        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={px}
          onChange={(e) => setPx(Number(e.target.value))}
          aria-label="프레임 모서리 radius"
          className="w-48 accent-amber-400"
        />

        {/* 상태를 그대로 드러낸다 — 지금 값과, 카드 곡률 대비 몇 배인지. */}
        <div className="flex flex-col leading-tight tabular-nums">
          <span className="text-neutral-100">{px}px</span>
          <span className="text-neutral-400">카드(14px)의 {ratio}×</span>
        </div>

        <span className="text-neutral-500">← →</span>
      </div>
    </div>
  );
}
