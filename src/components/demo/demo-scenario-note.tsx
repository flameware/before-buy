import type { ReactNode } from "react";

/**
 * `데모 시점`이 `3개월 후`일 때 화면이 그 사실을 선언하는 자리(CONTEXT.md `데모 시점`, #134).
 *
 * **모양은 한 벌이고 문구만 화면마다 다르다.** S1은 조작 장치가 있는 화면이라 그 값이 무엇을
 * 뜻하는지까지 말하고, S5는 앱의 상태만 말한다 — 같은 성격의 표시가 화면마다 다른 무게로
 * 보이면 사용자는 둘을 다른 것으로 읽는다.
 */
export function DemoScenarioNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{children}</p>
  );
}
