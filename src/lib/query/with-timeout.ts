// 정착하지 않는 promise를 시간으로 깨운다 (#82).
//
// React Query는 `queryFn`이 돌려준 promise가 정착해야만 상태를 옮긴다. 그 promise가
// 영원히 미결이면 `retry`도 `isError`도 걸리지 않고 쿼리는 `pending`에 머문다 — 화면은
// 아무 피드백 없이 skeleton만 그린다. Server Action이 실패했는데도 클라이언트 promise가
// 깨지지 않는 경우가 실제로 그렇다(원인은 #83에서 따로 쫓는다. 서버는 500을 돌려주고
// 예외도 기록하는데 클라이언트는 그것을 리젝션으로 받지 못한다).
//
// 그래서 이 방어는 **원인과 무관해야 한다.** 서버 쪽 try/catch는 액션 본문이 던진
// 것만 잡고, 직렬화 실패(`return` 이후)나 인프라 크래시(액션에 도달조차 못 함)는 그
// 그물 밖이다. 미결 promise를 깨울 수 있는 자리는 클라이언트뿐이다.

/** 시간 안에 정착하지 않아 깨운 것. 서버가 돌려준 실패와 구분하려고 따로 둔다. */
export class QueryTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label}: ${ms}ms 안에 응답이 오지 않았다`);
    this.name = "QueryTimeoutError";
  }
}

/**
 * `work`가 `ms` 안에 정착하지 않으면 `QueryTimeoutError`로 reject한다. 정착한 뒤에는
 * 타이머를 반드시 지운다 — 해피 패스에서 타이머가 남으면 매 조회마다 쌓인다.
 *
 * 이긴 쪽이 결과다. `work`가 나중에 정착하더라도 그때는 아무도 보지 않는다.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const alarm = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new QueryTimeoutError(label, ms)), ms);
  });
  return Promise.race([work, alarm]).finally(() => clearTimeout(timer));
}
