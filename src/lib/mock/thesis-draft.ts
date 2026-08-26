import type { FollowupAnswer, ThesisCategory } from "./types";

export interface ThesisDraft {
  category: ThesisCategory;
  followup: FollowupAnswer[];
  freeText?: string;
  createdAt: string;
}

/**
 * S2에서 작성한 근거를 S3가 읽어갈 임시 저장소. 모듈 스코프 인메모리 상태라
 * 같은 세션의 클라이언트 라우팅 사이에는 유지되고, 새로고침하면 휘발된다
 * (Notes: "작성 중인 근거는 새로고침 시 휘발되어도 무방").
 */
const drafts = new Map<string, ThesisDraft>();

export function setThesisDraft(ticker: string, draft: ThesisDraft): void {
  drafts.set(ticker, draft);
}

export function getThesisDraft(ticker: string): ThesisDraft | undefined {
  return drafts.get(ticker);
}
