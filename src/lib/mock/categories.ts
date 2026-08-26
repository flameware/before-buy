import type { ThesisCategory } from "./types";

export interface FollowupOption {
  value: string;
  label: string;
}

export interface FollowupQuestion {
  id: string;
  prompt: string;
  options: FollowupOption[];
  /** 자유 입력을 허용하는지. 대부분 "직접 입력" 선택지로 표현. */
  allowsFreeText: boolean;
  /** 관측 가능한 값을 받는 질문 — 전제 자동 판정의 근거가 됨 (화면명세 S2 참고). */
  isValueQuestion: boolean;
}

export interface CategoryDef {
  id: ThesisCategory;
  label: string; // Step 1 카드에 쓰는 한 단어 라벨
  headline: string; // Step 1 헤드라인
  questions: FollowupQuestion[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "fundamental",
    label: "실적·성장",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "growth-type",
        prompt: "어떤 성장을 기대하세요?",
        options: [
          { value: "revenue", label: "매출 성장" },
          { value: "margin", label: "이익 개선" },
          { value: "new-business", label: "신사업·신제품" },
          { value: "market-share", label: "점유율 확대" },
        ],
        allowsFreeText: true,
        isValueQuestion: false,
      },
      {
        id: "horizon",
        prompt: "언제쯤 확인할 수 있을까요?",
        options: [
          { value: "next-quarter", label: "다음 분기" },
          { value: "6m", label: "6개월" },
          { value: "1y", label: "1년" },
          { value: "unset", label: "정해두지 않음" },
        ],
        allowsFreeText: false,
        isValueQuestion: true,
      },
      {
        id: "if-wrong",
        prompt: "기대만큼 안 나오면 어떻게 하실 건가요?",
        options: [
          { value: "sell", label: "팔겠다" },
          { value: "wait", label: "더 기다린다" },
          { value: "unsure", label: "생각 안 해봤어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
    ],
  },
  {
    id: "undervalued",
    label: "저평가",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "cheap-vs-what",
        prompt: "무엇 대비 싸다고 보세요?",
        options: [
          { value: "peers", label: "동종업계" },
          { value: "own-history", label: "과거 이 종목의 밸류에이션" },
          { value: "asset-value", label: "자산가치" },
        ],
        allowsFreeText: true,
        isValueQuestion: false,
      },
      {
        id: "metric",
        prompt: "어느 지표로 보셨어요?",
        options: [
          { value: "per", label: "PER" },
          { value: "pbr", label: "PBR" },
          { value: "price-itself", label: "주가 자체" },
          { value: "unsure", label: "잘 모르겠어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
      {
        id: "target-price",
        prompt: "어디까지 오르면 제값이라고 보세요?",
        options: [
          { value: "custom", label: "목표가 직접 입력" },
          { value: "unset", label: "정하지 않음" },
        ],
        allowsFreeText: true,
        isValueQuestion: true,
      },
    ],
  },
  {
    id: "theme",
    label: "테마·모멘텀",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "theme-name",
        prompt: "어떤 테마인가요?",
        options: [],
        allowsFreeText: true,
        isValueQuestion: false,
      },
      {
        id: "duration",
        prompt: "이 흐름이 얼마나 갈 거라고 보세요?",
        options: [
          { value: "weeks", label: "몇 주" },
          { value: "months", label: "몇 달" },
          { value: "1y-plus", label: "1년 이상" },
          { value: "unsure", label: "모르겠어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: true,
      },
      {
        id: "cooldown-signal",
        prompt: "테마가 식었다는 건 뭘 보면 알까요?",
        options: [
          { value: "volume-drop", label: "거래량 감소" },
          { value: "news-drop", label: "관련 뉴스가 줄어듦" },
          { value: "price-drop", label: "주가 하락" },
          { value: "unsure", label: "생각 안 해봤어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
    ],
  },
  {
    id: "dividend",
    label: "배당",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "yield-checked",
        prompt: "지금 배당수익률은 확인하셨어요?",
        options: [
          { value: "yes-enough", label: "네, 충분합니다" },
          { value: "yes-but-growth", label: "네, 아쉽지만 성장도 기대" },
          { value: "not-yet", label: "아직 안 봤어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
      {
        id: "if-cut",
        prompt: "배당이 줄어도 계속 들고 계실 건가요?",
        options: [
          { value: "sell", label: "아니요, 팔겠습니다" },
          { value: "hold", label: "네, 다른 이유도 있어요" },
          { value: "unsure", label: "생각 안 해봤어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
      {
        id: "horizon",
        prompt: "얼마나 오래 보실 생각이세요?",
        options: [
          { value: "1y", label: "1년" },
          { value: "3y", label: "3년" },
          { value: "longer", label: "그 이상" },
          { value: "unset", label: "정하지 않음" },
        ],
        allowsFreeText: false,
        isValueQuestion: true,
      },
    ],
  },
  {
    id: "technical",
    label: "기술적 신호",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "signal-type",
        prompt: "어떤 신호를 보셨어요?",
        options: [
          { value: "ma-breakout", label: "이동평균 돌파" },
          { value: "volume-spike", label: "거래량 급증" },
          { value: "support-bounce", label: "지지선 반등" },
          { value: "chart-pattern", label: "차트 패턴" },
        ],
        allowsFreeText: true,
        isValueQuestion: false,
      },
      {
        id: "stop-loss",
        prompt: "신호가 틀렸다면 어디서 정리하실 건가요?",
        options: [
          { value: "custom", label: "손절가 직접 입력" },
          { value: "-10", label: "-10%" },
          { value: "-20", label: "-20%" },
          { value: "unset", label: "정하지 않음" },
        ],
        allowsFreeText: true,
        isValueQuestion: false,
      },
      {
        id: "target-price",
        prompt: "목표가는 정하셨어요?",
        options: [
          { value: "custom", label: "목표가 직접 입력" },
          { value: "unset", label: "정하지 않음" },
        ],
        allowsFreeText: true,
        isValueQuestion: true,
      },
    ],
  },
  {
    id: "recommended",
    label: "누가 추천해서",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "source",
        prompt: "어디서 보셨어요?",
        options: [
          { value: "youtube-broadcast", label: "유튜브·방송" },
          { value: "community", label: "커뮤니티" },
          { value: "acquaintance", label: "지인" },
          { value: "broker-report", label: "증권사 리포트" },
          { value: "article", label: "기사" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
      {
        id: "reason",
        prompt: "그분이 왜 좋다고 하던가요?",
        options: [],
        allowsFreeText: true,
        isValueQuestion: false,
      },
      {
        id: "verified",
        prompt: "그 이유를 직접 확인해보셨어요?",
        options: [
          { value: "yes", label: "네" },
          { value: "partially", label: "일부만" },
          { value: "no", label: "아니요" },
        ],
        allowsFreeText: false,
        isValueQuestion: true,
      },
    ],
  },
  {
    id: "gut",
    label: "그냥 느낌",
    headline: "왜 이 종목에 관심이 있으세요?",
    questions: [
      {
        id: "feeling",
        prompt: "어떤 느낌이세요?",
        options: [
          { value: "will-do-well", label: "앞으로 잘 될 것 같다" },
          { value: "seen-often", label: "요즘 자주 보인다" },
          { value: "used-it", label: "써보니 좋다" },
          { value: "looks-cheap", label: "싸 보인다" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
      {
        id: "size",
        prompt: "얼마나 넣으실 생각이세요?",
        options: [
          { value: "small", label: "소액으로" },
          { value: "usual", label: "평소만큼" },
          { value: "large", label: "평소보다 크게" },
        ],
        allowsFreeText: false,
        isValueQuestion: false,
      },
      {
        id: "ok-if-wrong",
        prompt: "틀려도 괜찮은 금액인가요?",
        options: [
          { value: "yes", label: "네" },
          { value: "no", label: "아니요" },
          { value: "unsure", label: "생각 안 해봤어요" },
        ],
        allowsFreeText: false,
        isValueQuestion: true,
      },
    ],
  },
];

export function getCategory(id: ThesisCategory): CategoryDef {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown thesis category: ${id}`);
  return found;
}
