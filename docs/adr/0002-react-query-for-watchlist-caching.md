# 0002. React Query for watchlist client-side caching, list/quote split

## Status

Accepted

## Context

S1(관심종목 메인)은 `useEffect`에서 Server Action(`loadWatchlist` → `getWatchlistView`)을
직접 호출하는 방식으로, 앱 전체에 어떤 캐싱 레이어도 없었다. S1.5(종목검색)는 `@modal`
패턴이 아닌 별도 라우트라 S1을 떠났다가 돌아오면 완전히 언마운트/리마운트되고, 매번
"불러오는 중..."부터 새로 로딩되는 것이 배포 환경에서 실측 확인됐다.

두 가지 방향을 검토했다: (A) `/search`를 S4(`@modal/(.)order`)처럼 parallel-route
모달로 바꿔 S1을 언마운트시키지 않는 방법, (B) 언마운트는 그대로 두고 클라이언트 캐시로
데이터를 보존하는 방법. (A)는 이 화면 하나엔 깔끔하지만 라우팅 구조 변경이 더 크고, 다른
화면(S2~S5)의 동일한 "재방문 시 리프레시" 문제는 해결하지 못한다.

또한 `getWatchlistView`는 DB 조회(목록/근거/전제)와 KIS 실시간 시세 조회를 한 호출에
묶어서 반환하고 있어, 목록과 시세에 서로 다른 신선도(freshness) 정책을 적용할 수 없었다.

## Decision

- (B)를 채택: React Query(TanStack Query)를 도입해 클라이언트 캐시 레이어로 사용한다.
  `QueryClientProvider`는 `app/layout.tsx`에 전역으로 배치하되, 실제 쿼리 전환은
  이번 스코프인 **S1에만** 적용한다.
- `getWatchlistView`를 목록 쿼리(DB: 종목/근거/전제, staleTime 60초)와 시세 쿼리
  (KIS 실시간가, staleTime 15~30초)로 분리한다. 시세 쿼리 키에 `isFuture`를 포함시켜
  "3개월 후 보기" 토글 전환 시 별도 캐시 엔트리로 자연 분리되게 하며(명시적 invalidate
  불필요), 목록은 토글과 무관하게 유지된다.
- 무효화는 데이터를 실제로 바꾸는 액션에서만 명시적으로 수행한다: S1.5에서 종목 추가 시
  목록 invalidate, S4에서 매수/매도 실행 시 목록+시세 invalidate.
- 백그라운드 재검증(stale-while-revalidate)은 로딩 인디케이터 없이 조용히 이전 데이터를
  교체한다.
- `watchlist_items`가 이미 `session_id`로 서버에서 격리되어 있고 React Query 캐시는
  브라우저별 메모리에 상주하므로, 동시 접속자(로그인 없음, 복수 테스터)를 위한 별도의
  캐시 키 스코핑은 하지 않는다.

## Consequences

- 이 앱에 캐싱 라이브러리가 처음 들어오는 것이며, 이후 S2~S5도 같은 패턴(쿼리 분리 +
  명시적 invalidate)을 따르는 것이 기본값이 된다.
- `evaluateWatchlistPremises`가 전제(price/valuation) 판정을 위해 내부적으로 별도의
  KIS 시세 조회를 수행하는 중복 호출은 이번 스코프에서 해소하지 않는다. 목록 쿼리의
  staleTime(60초)만큼 빈도는 줄지만 완전히 제거되지는 않으며, 별도 이슈로 트래킹한다.
