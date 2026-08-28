import type { GenerateThesisResultOutcome } from "@/lib/thesis/generate-result";
import type { FollowupAnswer, ThesisCategory } from "./types";

export interface ThesisDraft {
  category: ThesisCategory;
  followup: FollowupAnswer[];
  freeText?: string;
  createdAt: string;
}

/** 진행 중이거나 이미 끝난, 이 draft의 유일한 유상 호출. */
type ResultSlot =
  | { status: "in-flight"; promise: Promise<GenerateThesisResultOutcome> }
  | { status: "done"; outcome: Extract<GenerateThesisResultOutcome, { ok: true }> };

/**
 * S2에서 작성한 근거와 **그 근거가 만든 결과 한 자리**를 함께 들고 있는 임시 저장소.
 * 모듈 스코프 인메모리 상태라 같은 세션의 클라이언트 라우팅 사이에는 유지되고,
 * 새로고침하면 휘발된다 (Notes: "작성 중인 근거는 새로고침 시 휘발되어도 무방").
 *
 * 규칙 하나를 지킨다: **draft 하나는 유상 critique을 최대 한 번 만든다** (#122).
 * S3 → 뒤로 → 다시 S3의 재진입은 컴포넌트 `ref`로 막을 수 없다 — 언마운트되면
 * 리셋되기 때문이다. 그래서 가드가 draft와 같은 수명을 갖는 여기에 산다.
 */
const drafts = new Map<string, ThesisDraft>();
const results = new Map<string, ResultSlot>();

/** 새 draft는 앞선 draft의 결과를 함께 버린다 — 다시 써서 들어온 것은 새 호출이 맞다. */
export function setThesisDraft(ticker: string, draft: ThesisDraft): void {
  drafts.set(ticker, draft);
  results.delete(ticker);
}

export function getThesisDraft(ticker: string): ThesisDraft | undefined {
  return drafts.get(ticker);
}

/**
 * 커밋에 성공했을 때 draft와 결과를 함께 버린다. 그러면 S1에서 뒤로 돌아온 S3는
 * draft가 없어 `getExistingThesisAction` fallback으로 떨어지고, 커밋된 근거를
 * 공짜로 읽어 보여준다 — 재커밋도 그 자리에서 함께 막힌다.
 */
export function clearThesisDraft(ticker: string): void {
  drafts.delete(ticker);
  results.delete(ticker);
}

/**
 * 이 draft의 결과 자리를 통과해서만 유상 호출을 태운다.
 *
 * - 비어 있으면 `generate`를 태우고 그 promise를 자리에 넣는다
 * - 진행 중이면 새로 태우지 않고 **같은 promise를 돌려준다** (재진입도, Strict Mode의
 *   effect 이중 실행도 여기서 한 번으로 접힌다)
 * - 성공한 결과가 있으면 호출 없이 그대로 되돌려준다 — 시세도 생성 시점 값 그대로다
 * - 실패는 자리에 남기지 않는다. `다시 시도`가 실제로 새 호출을 태워야 한다
 */
export function resolveThesisResultOnce(
  ticker: string,
  generate: () => Promise<GenerateThesisResultOutcome>
): Promise<GenerateThesisResultOutcome> {
  const slot = results.get(ticker);
  if (slot?.status === "done") return Promise.resolve(slot.outcome);
  if (slot?.status === "in-flight") return slot.promise;

  const settle = (next: ResultSlot | undefined) => {
    // 태우는 사이에 새 draft가 들어와 자리를 비웠다면 이 결과는 이미 남의 것이다.
    if (results.get(ticker) !== pending) return;
    if (next) results.set(ticker, next);
    else results.delete(ticker);
  };

  const promise = generate().then(
    (outcome) => {
      settle(outcome.ok ? { status: "done", outcome } : undefined);
      return outcome;
    },
    (error) => {
      settle(undefined);
      throw error;
    }
  );
  const pending: ResultSlot = { status: "in-flight", promise };
  results.set(ticker, pending);
  return promise;
}
