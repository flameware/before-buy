"use client";

import { useEffect, useState } from "react";

/**
 * 값이 `delay`ms 동안 잠잠해진 뒤에야 바뀌는 사본을 돌려준다.
 *
 * S1.5 검색이 쓴다 (#92). 한글 IME는 한 글자를 완성하기까지 조합 중간 상태를 계속
 * 내보내므로("ㅅ" → "사" → "삼"), 디바운스가 없으면 그 전부가 서버 왕복이 된다.
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
