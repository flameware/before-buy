import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * 순수 함수 단위 테스트만 돌린다 (#78). 대상은 시세·전제·배지처럼 상태 조합이 많고
 * 조합 하나를 빠뜨리면 화면이 거짓말을 하는 계산들이다 — 실제로 #79, #81이 그렇게 났다.
 *
 * DOM이 없어도 되므로 `environment`는 기본값(node) 그대로 두고 jsdom을 들이지 않는다.
 * 컴포넌트/훅 테스트(RTL)가 필요해지는 시점에 그때 추가한다.
 *
 * 테스트는 대상 파일 옆에 `*.test.ts`로 둔다. 서버 전용 모듈(`server-only`, `"use server"`)을
 * 끌고 들어오는 파일은 node 환경에서 임포트할 수 없으므로, 테스트 대상 순수 함수는
 * 그런 모듈과 분리된 자리에 있어야 한다.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
