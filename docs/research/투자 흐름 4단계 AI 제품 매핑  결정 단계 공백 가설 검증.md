## 조사 개요와 방법

반나절 리서치로 국내 증권사 AI 기능, 해외 리테일 AI 투자 서비스, 개인 자작 도구 세 부류를 웹 검색으로 수집했다. 검색어는 각 부류별로 "카카오페이증권/토스증권/미래에셋/키움 AI 기능", "Danelfin/Composer/robo-advisor AI investment", "GitHub investment thesis tracker", "devil's advocate AI investment thesis", "노션 매매일지 템플릿", "premortem 매수 전 체크리스트" 등을 사용했다. (c) 부류는 GitHub, Reddit, App Store, Notion 마켓플레이스를 중심으로 탐색했다. 직접 사용해 기능을 확인한 것은 하나도 없으며, 모든 항목은 [미확인] — 공개된 설명/보도자료/리뷰 기반 판정이다.

## 1. 수집 표

| 서비스명 | 부류 | 단계 | 판정 근거 | 출처 | 확인여부 |
|---|---|---|---|---|---|
| 카카오페이증권 '1인 1 AI 투자 에이전트' | a | 탐색·결정(설계 중, 걸침) | 자산·성향·생애주기 분석 후 개인화 정보 제공, "설명가능한 AI"로 판단 근거 제시 예정이나 아직 연말 일부 출시 예정[^1][^2] | biz.heraldcorp 등 | [미확인] (미출시) |
| 토스증권 AI 시그널 | a | 탐색 | 뉴스·공시를 분석해 "왜 올랐는지/내렸는지"를 설명 — 원인 해석이지만 매수 여부 판단은 사용자에게 남김[^3][^4] | hankyung, mstoday | [미확인] |
| 토스증권 AI 어닝콜 / 실시간 이슈 | a | 탐색 | 실적발표 실시간 번역·요약, 뉴스 랭킹 — 정보 소비 단계[^5][^6] | zdnet, tossinvest | [미확인] |
| 미래에셋증권 투자비서/M-STOCK AI투자정보 | a | 탐색 | 급등락 알림, 맞춤 리포트, 위험요소 탐지 — 정보 수집·안내 중심[^7][^8] | etnews, hankyung | [미확인] |
| 미래에셋증권 로보어드바이저 | a | 결정(부분) | 성향·계좌현황 기반 포트폴리오 배분 제안 — "얼마나 살지"에 해당하나 자동 실행형이라 사용자 논지 검증은 아님[^9][^10] | biz.chosun | [미확인] |
| 미래에셋증권 '초고수의 선택' | a | 탐색 | 상위 수익률 투자자 매매패턴을 참고자료로 제공 — 타인 행동 참조형[^11] | biz.heraldcorp | [미확인] |
| 삼성증권 '주식굴링'/AI 차트뷰 | a | 탐색 | 테마 검색 후 관련 종목 추천, 차트 흐름 설명 — 발굴·설명 단계[^12][^13] | ngetnews, economist | [미확인] |
| 키움증권 '키우Me' / '키우Go' | a | 탐색·결정(코파일럿 표방) | "투자 결정을 돕는 코파일럿" 표방하나 실제 기능은 상품 설명·Q&A 중심으로 확인됨[^14][^13] | fnnews | [미확인] |
| Danelfin (스페인, 리테일) | b | 탐색 | 900+ 지표로 종목별 AI Score(1-10) 제공, 스크리닝·랭킹 도구. 개별 투자자의 사전 논지를 입력받지 않음[^15][^16] | wallstreetzen 등 | [미확인] |
| Composer / SoFi Composer | b | 결정·실행 | 자연어로 전략을 구성·백테스트 후 자동매매까지 연결 — 전략 실행이 핵심, 사용자 "논지"를 검증하는 것이 아니라 규칙을 코드화함[^17][^18] | businesswire, marketchameleon | [미확인] |
| 라씨매매비서 / 한경라씨로 (한국, 리테일) | b/a 성격 | 실행 직전 | 매수·매도 타이밍 신호 제공 — AI가 판단을 대신 제시, 사용자 논지 검증 아님[^19][^20] | tradingpoint, hankyung | [미확인] |
| LinqAlpha 'Devil's Advocate' | 기관용 (제외 대상, 참고용) | 결정 | 사용자가 논지 업로드 → 가정 분해 → 반박 근거 자동 생성. 단, 기관(헤지펀드) 대상이라 (b) 리테일 기준에서 제외, 참고 사례로만 인용[^21][^22] | AWS ML Blog | [미확인] |
| unicodeveloper/devilsadvocate (GitHub 오픈소스) | c | **결정** | 개인이 만든 오픈소스 "AI CIO" — 논지 작성→불/베어 에이전트가 반박→House View 위반 시 거부 판정까지. 개인 리테일도 클론해 쓸 수 있음[^23][^24] | github, reddit | [미확인] |
| AskMADE / Devil's Advocate AI (tellodb) | b (개인 개발 소규모 SaaS) | 결정 | 사용자가 투자 논지를 입력하면 독립된 AI 에이전트가 반박 근거를 리서치해 제시하는 범용 디베이트 툴, 투자 사례로 명시적 홍보[^25][^26] | askmade.app, tellodb | [미확인] |
| suprmind.ai 투자 결정 유즈케이스 | b | 결정 | 5개 모델로 불/베어 논쟁, Red Team 모드로 딜브레이커 탐색, 투자 메모 export[^27] | suprmind.ai | [미확인] |
| Reddit 개인 프로젝트 "PSX 투자 논지 추적 시스템" | c | **회고·결정(추적)** | 분기 실적 업로드 시 Gemini+Claude로 "논지가 아직 유효한가" 재평가, red flag 목록 자동 생성 — 전제 붕괴 추적의 정확한 사례[^28] | reddit r/pakistan | [미확인] (개인 사용 후기, 재현 불가) |
| Claude Skill "Thesis Tracker" (equity-research) | c | 결정·회고 | 논지 pillar·리스크·촉매 기록, "논지가 여전히 유효한가" 체크, 대화형 AI 스킬로 개인이 설치해 사용[^29][^30] | findskills.co, mcpmarket | [미확인] |
| Mira (byteseek, GitHub) | c | 결정·탐색 | "증거 추적형, 갱신 가능한 투자 논지" 관리 에이전트 스킬, 반증조건(refresh condition) 명시 요구[^31] | skillsllm.com | [미확인] |
| LLMQuant "investment-thesis-tracker" 워크플로 | c | 결정 | "매수 로직을 매도 조건이 있는 추적형 논지로 전환" — 사용자 커뮤니티 오픈소스[^32] | claudeskills.info | [미확인] |
| Investbrain (오픈소스 LLM 트래커) | c | 회고 | 여러 브로커리지 통합 추적, LLM 활용하지만 논지 검증 기능은 명확히 확인 안 됨 | github | [미확인] |
| 노션 매매일지/자산관리 템플릿 (다수) | c | 회고 (일부 탐색 걸침) | 매수 사유·목표가·손절 기준을 기록하지만, 수동 기록이며 AI가 능동적으로 검증·반박하지는 않음[^33][^34] | notion.com, dupoin | [미확인] |
| Index Guard (개인 개발자 앱, 한국) | c | **결정 직전 마찰** | 매수/매도 전 20초 강제 대기 타이머 + 심리 신호등 — "매수 전 마찰을 거는" 유형이나 판단 근거를 "묻지"는 않고 감정 냉각만 유도[^35] | App Store | [미확인] |
| 두물머리 '불리오 인베스트' (GPTs) | c | 탐색 | 100개국 주식 관련 GPT 대화형 정보 제공, 논지 검증 기능은 확인 안 됨[^33] | news.nate.com | [미확인] |
| Wealthfront/Betterment류 로보어드바이저 (해외) | b | 결정(자동배분) | 목표·리스크 성향 기반 자동 자산배분 — 논지 검증이 아니라 규칙 기반 배분(직접 확인 안 해 세부 기능 미확인) | (검색 결과 부족) | [미확인] |

## 2. 단계별 밀도 요약

| 단계 | 개수(대략) | 비중 특징 |
|---|---|---|
| 탐색 | 12개 이상 | 압도적 밀도. (a) 국내 증권사 대부분이 이 단계에 집중 — 뉴스·공시 요약, 번역, 랭킹, 발굴 |
| 결정 | 6~8개 (그러나 대부분 (b)(c)의 소규모/개인 프로젝트) | (a)는 로보어드바이저 정도만 걸침. 진짜 "논지 입력→검증/반박"형은 전부 비주류·오픈소스·1인 개발 |
| 실행 | 2~3개 | Composer류(전략 자동화), 라씨매매비서(신호 제공) 정도 — 국내 대형 증권사는 주문 자체를 AI가 판단하지 않도록 조심스럽게 설계 |
| 회고 | 4~5개 | 노션 템플릿, PSX 논지 추적기, Thesis Tracker 스킬 — (a) 대형사에는 거의 없음, (c)에 몰려 있음 |

탐색 단계가 가장 붐비고, 결정·회고 단계는 (a) 대형 증권사에서는 거의 비어 있으며 (b)(c)의 소규모/개인 프로젝트에서만 발견된다.

## 3. 반증 결과 — 가설은 부분적으로 깨졌다

"결정 단계가 비어 있다"는 가설은 **완전히는 아니지만 유의미하게 깨졌다**. 사용자가 투자 논지를 입력하면 AI가 이를 반박·검증해주는 서비스가 실제로 존재한다.

- **LinqAlpha 'Devil's Advocate'**: 논지를 업로드하면 가정을 분해하고 반증 근거를 소스와 함께 제시하는 기관용 시스템. 다만 제약사항(기관 터미널 제외)에 걸려 (b) 리테일 카테고리에는 포함시키지 않았다.[^21][^22]
- **unicodeveloper/devilsadvocate (GitHub 오픈소스)**: 개인이 만들어 공개한 "AI CIO" — 불/베어 에이전트가 논지를 공격하고, House View 위반 시 거부 판정까지 내리는 구조로, 개인이 포크해서 자신의 리테일 투자에도 쓸 수 있다. 이는 (c) 부류에서 가설을 가장 직접적으로 깨는 사례다.[^23][^24]
- **AskMADE / Devil's Advocate AI (tellodb) / suprmind.ai**: 리테일 대상 범용 AI 디베이트 툴로, 투자 논지를 명시적 유즈케이스로 홍보하며 불/베어 논쟁·Red Team 모드를 제공한다.[^25][^26][^27]
- **Reddit PSX 논지 추적기**: "전제가 깨졌는지 추적"하는 세 번째 요청 유형에 정확히 부합하는 사례. 분기 실적 업로드 시 논지의 유효성을 재평가하고 red flag를 나열한다. 다만 개인 사용 후기 기반이라 재현·검증은 하지 못했다.[^28]
- **Claude Skill 'Thesis Tracker', Mira, LLMQuant 워크플로**: 모두 "논지가 여전히 유효한가" 체크를 핵심 기능으로 명시한 오픈소스/스킬이다.[^29][^31][^32]

다만 이들 대부분이 **(1) 개인 개발자의 사이드 프로젝트이거나 (2) 소규모 스타트업의 범용 디베이트 툴**이며, **국내·해외 대형 리테일 증권사·핀테크 중 어느 곳도 "매수 전 사용자의 논지를 입력받아 반박하는" 기능을 정식 상용화하지 않았다**는 점은 확인됐다. 카카오페이증권이 "설명가능한 AI"를 내세우지만 이는 AI의 추천 근거를 설명하는 것이지, 사용자 논지를 반박하는 것은 아니다.[^2][^36]

**검색 범위 명시**: "devil's advocate AI investment thesis", "premortem investing checklist AI tool", "매수 전 마찰 앱", "논지 검증 봇" 등으로 검색했고, Google 상위 결과·GitHub Topics·Reddit·App Store·Notion 마켓플레이스까지 확인했다. 국내 서비스 중 정식 상용 제품에서는 발견하지 못했다.

## 4. 공백의 원인 가설

1. **규제/책임 회피 (규제 층위)**: 국내 증권사가 "논지를 반박"하거나 "매수를 만류"하는 AI를 내놓으면 투자 판단에 관여한 것으로 간주되어 자본시장법상 투자자문업 인가·불완전판매 책임 이슈에 노출될 수 있다. 이것이 맞다면, 카카오페이증권처럼 "최종 판단은 고객 몫"이라는 문구를 반복적으로 강조하는 패턴이 관찰되어야 하는데, 실제로 그렇게 관찰된다.[^1][^36]

2. **수익모델 충돌 (비즈니스 층위)**: 증권사의 수익은 거래 빈도·자산 성장에서 나오므로, AI가 매수에 마찰을 거는 기능은 거래량을 줄이는 방향이라 수익모델과 상충한다. 맞다면, 대형 증권사 AI 기능은 대부분 "정보 제공·발굴 촉진"형이고 "매수 저지·반박"형은 전혀 없어야 하는데, 실제 수집 결과가 이를 뒷받침한다(탐색 단계 밀집).

3. **기술적 난이도 (기술 층위)**: 논지 반박은 사용자의 비정형 서술(자연어 논지)을 파싱하고, 이를 구조화된 가정으로 분해한 뒤 실시간 반증 근거를 찾아 인용까지 붙여야 하는 고난도 RAG+추론 파이프라인이다. LinqAlpha가 Textract·OpenSearch·다중 에이전트를 동원한 것도 이 복잡성 때문이다. 맞다면, 이 기능이 상용화된 곳은 대규모 인프라를 가진 기관용 시스템(LinqAlpha)이나 오픈소스로 직접 구축하는 개발자(unicodeveloper)뿐이어야 하는데, 실제로 그렇다.[^21]

4. **사용자 수요/행동경제학적 저항 (수요 층위)**: 투자자는 확인 편향으로 인해 자신의 논지를 반박하는 도구를 자발적으로 찾지 않는 경향이 있다(홍보 문구에서도 "AI가 당신의 신념에 동조하는 대신"이라는 표현이 반복됨). 맞다면, 이런 기능은 개발자 본인이 자기 필요로 만든 사이드 프로젝트(Reddit PSX 사례, Notion 템플릿 저자 후기)로만 존재하고, 마케팅 주도의 대중 서비스로는 확산되지 않아야 하는데, 실제로 정식 대중 서비스가 거의 없다.[^26]

5. **회고 단계의 낮은 시급성 (제품 우선순위 층위)**: 회고는 즉각적 전환(가입·거래)을 만들지 않아 그로스 지표에 기여도가 낮다. 맞다면, 증권사 AI 로드맵 발표에서 회고·사후관리는 항상 "추후 확장" 항목으로 뒤로 밀려야 하는데, 미래에셋 사례에서 "사후 투자 관리"가 콘텐츠 맞춤형 AI로 "올해 중 확장 예정"이라고 표현된 것이 이를 뒷받침한다.[^37]

## 5. 프레임 관련 지적 및 놓친 부분

4단계(탐색-결정-실행-회고) 프레임은 실무적으로 유용하지만, 실제 서비스들은 "결정"을 다시 세분화해야 정밀하게 분류된다 — (a) 얼마나 살지(포지션 사이징: 로보어드바이저형), (b) 왜 사는지(논지 형성/검증: Devil's Advocate형), (c) 지금 사는지(타이밍: 라씨매매비서형)가 실제로는 서로 다른 제품 카테고리이며 한데 묶으면 "결정 단계가 비었다"는 판단이 과장되거나 왜곡될 수 있다. 로보어드바이저는 (a)에는 강하지만 (b)에는 전혀 관여하지 않는다.

놓치고 있을 만한 점으로는 다음을 제안한다: 첫째, 채권·ETF·해외소형주 등 자산군별로 결정 단계 공백의 정도가 다를 수 있는데 이번 조사는 주식 중심이었다. 둘째, 국내 커뮤니티(디시·블라인드·클리앙)의 자작 봇은 검색 엔진 노출이 낮아 이번 반나절 조사로는 충분히 탐색하지 못했으며, 실제로 존재할 가능성이 있다. 셋째, "반박형 AI"가 상용화되지 않은 것이 정말 공급 부재 때문인지, 혹은 이미 시도됐다가 사용자 이탈로 조용히 종료된 사례가 있는지는 확인하지 못했다 — 이는 프로토타입 설계 시 "왜 아무도 안 만들었는가"를 뒷받침하는 근거가 약하다는 뜻이므로, Day 2에 국내 증권사 UX 담당자 인터뷰나 실패 사례 추가 조사가 필요하다. 넷째, 규제 리스크(원인 1)를 프로토타입에 어떻게 반영할지 — "투자자문업" 경계선을 넘지 않는 문구·UX 설계가 4일 프로토타입 설계의 핵심 제약이 될 것이다.

---

## References

1. [카카오페이증권 "해외투자자 韓주식 24시간거래 위한 토큰화 검토"](https://www.yna.co.kr/view/AKR20260723098600008) - (서울=연합뉴스) 김유향 기자 = 카카오페이증권이 인공지능(AI) 기반 투자 서비스를 앞세워 3년 내 우리 국민 2천만명이 투자하는 시대를 열겠...

2. [신호철 "증권사 편 서는 AI 안 된다"… 카카오페이증권, 2000만 투자자 정조준](https://biz.newdaily.co.kr/site/data/html/2026/07/23/2026072300173.html) - 카카오페이증권이 증권사가 아닌 이용자 편에 서는 AI 투자 에이전트로 3년 안에 국민 2000만명이 투자하는 시대를 열겠다고 선언했다. 국민 3명 중 2명이 자본시장 밖에 머물러 ...

3. [토스증권 "관심종목이 갑자기 25% 급등? 실시간으로 이유 알려줍니다"](https://www.hankyung.com/article/202511128003i) - 토스증권 "관심종목이 갑자기 25% 급등? 실시간으로 이유 알려줍니다", AI 서비스 'AI 시그널' 선보여 MTS에서 실시간으로 등락 이유 확인

4. [[인터뷰] 조중현 토스증권 MLE "AI가 뉴스 해석까지 '조력자 도구'로 나선다"](https://www.newspim.com/news/view/20260421001282) - [서울=뉴스핌] 양태훈 기자 = 개인투자자가 뉴스를 해석해 투자 판단까지 이어가기란 쉽지 않다. 언어 장벽은 물론, 하루에도 쏟아지는 방대한 정보량이 걸림돌이다. 토스증권은 이 문...

5. [출범 5주년 토스증권, 승부수는 'AI'…데이터 기반 투자 ...](https://zdnet.co.kr/view/?no=20260429135936) - 토스증권이 출범 5주년을 맞아 인공지능(AI)을 핵심 성장 전략으로 내세웠다. 연초 전담 조직을 신설하고 주요 서비스 전반에 AI를 적용하며 데이터 기반 투자 플랫폼으로 고도화하는...

6. [https://home.tossinvest.com/en/news-room/detail?id...](https://home.tossinvest.com/en/news-room/detail?id=49165) - We Empower All Investors | Toss Securities provides access to overseas bonds, domestic/overseas stoc...

7. [미래에셋증권, 초개인화 AI 투자비서 선보인다](https://www.etnews.com/20230724000162) - 미래에셋증권이 인공지능(AI)기술과 초개인화 엔진을 기반으로 투자의사결정에 도움을 주는 ‘투자비서’를 선보인다. ‘투자비서’ 서비스는 미래에셋증권 모바일트레이딩시스템(MTS)인 m...

8. [미래에셋증권, AI 강화 'M-STOCK', 1020세대 투자자 사로잡아](https://www.hankyung.com/article/2025100196831) - 미래에셋증권, AI 강화 'M-STOCK', 1020세대 투자자 사로잡아, 전예진 기자, 증권

9. [미래에셋증권, ISA·주식계좌·종합저축으로 로보어드바이저 ...](https://biz.chosun.com/stock/stock_general/2025/06/30/LQY2RIOVJFFQLIM7NPV6OHQHUA/) - 미래에셋증권, ISA·주식계좌·종합저축으로 로보어드바이저 적용 확대

10. [미래에셋증권, 로보어드바이저부터 AI 투자 정보 지원까지 ...](https://www.press9.kr/news/articleView.html?idxno=66011) - [프레스나인] 미래에셋증권이 투자자를 대상으로 한 다양한 서비스를 통해 고객 자산 관리에 힘쓰고 있다. 초고액자산가 관리는 물론이고 일반 투자자 역시 놓치지 않고 있는 모습이다. ...

11. [AI엔진 자체 개발, 투자 정보 실시간 번역·요약[2024 헤럴드경제 자본시장대상-디지털프론티어대상 미래에셋증권]](https://biz.heraldcorp.com/article/3382555) - 미래에셋증권이 자체 개발한 인공지능(AI)엔진을 통해 투자정보를 제공하고 국내외 업체와 협력해 혁신적인 서비스를 제공한 점을 높이 평가받아 ‘2024 헤럴드경제 자본시장대상’에서 ...

12. [AI가 추천한 주식투자... 증권사, 맞춤형 서비스 강화](https://www.ngetnews.com/news/articleView.html?idxno=412664) - 증권사가 인공지능(AI) 기술을 활용한 로보어드바이저 서비스로 고객 유치에 나서고 있다. 소액투자가 가능하고 편의성이 높아 접근성이 뛰어나다는 평가다.19일 업계에 따르면 삼성증권...

13. [‘증권사 AI’가 PB 된다…투자 조언도 자산관리도 척척[AI, 회사를 다시 쓴다]④](https://economist.co.kr/article/view/ecn202606090042) - 인공지능(AI)이 증권업계의 자산관리 방식을 바꾸고 있다. 과거에는 프라이빗뱅커(PB)나 애널리스트를 통해서만 얻을 수 있었던 투자 정보와 분석 서비

14. [“AI 자산관리 챗봇 '키우Me'로 투자자 돕는다” [fn이사람]](https://www.fnnews.com/news/202504041636100903) - “인공지능(AI) 자산관리 챗봇 ‘키우미(Me)’로 투자자의 합리적 판단을 돕겠습니다.” 키움증권 AIX팀 이택헌 이사(사진)는 6일 “주식, 상장지수펀드(ETF), 펀드, 채권 ...

15. [Danelfin AI Stock Analysis Review — AI Score Tested Across 28 ...](https://alphagaindaily.com/en/blog/danelfin-ai-stock-analysis-review) - Honest Danelfin review after 3 months testing the AI Score on 28 stocks. Pricing ($0–89/mo), accurac...

16. [Danelfin AI Stock Analytics Platform](https://7wdata.be/tool/danelfin-ai-stock-analytics-platform/) - Danelfin is an AI-powered stock analytics platform founded in Barcelona that helps retail and semi-p...

17. [Composer Supercharges Investing Platform with New ' ...](https://www.businesswire.com/news/home/20251021050436/en/Composer-Supercharges-Investing-Platform-with-New-Trade-With-AI-Tool) - Composer, the AI-native, no-code investing platform that allows retail investors to build, automate ...

18. [SoFi Unveils Composer: AI-Powered Investing Platform Lets...](https://marketchameleon.com/articles/b/2026/6/23/sofi-introduces-composer-ai-investing-strategy-automation) - SoFi introduces Composer by SoFi, an AI-driven platform for retail investors to design, test, and au...

19. [라씨매매비서 :: 주식 잘하는 방법](https://tradingpoint.co.kr/) - 언제 살까? 언제 팔까? 주식 잘하는 방법, 라씨 매매비서가 수익나는 매매타이밍을 분석

20. [[알립니다] AI가 매매타이밍 알려주는 '한경라씨로' - 한국경제](https://www.hankyung.com/article/2022021054391) - [알립니다] AI가 매매타이밍 알려주는 '한경라씨로', 한경닷컴, 주식투자 정보 앱 출시

21. [How LinqAlpha assesses investment theses using Devil's Advocate ...](https://aws.amazon.com/blogs/machine-learning/how-linqalpha-assesses-investment-theses-using-devils-advocate-on-amazon-bedrock/) - LinqAlpha is a Boston-based multi-agent AI system built specifically for institutional investors. Th...

22. [AI-powered investment critique: Devil's Advocate | LinqAlpha posted ...](https://www.linkedin.com/posts/linqalpha_how-linqalpha-assesses-investment-theses-activity-7427658098820993025-n8BD) - Conviction drives investment decisions, but unexamined assumptions introduce risk. That’s why LinqAl...

23. [Architecture](https://github.com/unicodeveloper/devilsadvocate/) - An AI-powered Fund Manager & Chief Investment Officer app that stress-tests your Stock & Funds thesi...

24. [Built an Open-Source Devil's Advocate for Stock, Fund and Investing Deals](https://www.reddit.com/r/AI_Agents/comments/1tdtrp8/built_an_opensource_devils_advocate_for_stock/) - Built an Open-Source Devil's Advocate for Stock, Fund and Investing Deals

25. [Use Cases - AskMADE | Multi-Agent AI Debate Tool](https://www.askmade.app/use-cases) - See how multi-agent AI is used for research, investing, strategy, and decision-making. Independent A...

26. [Devil's Advocate AI - Multi Model AI Debate Tool](https://debate.tellodb.com/devils-advocate-ai) - Stress-test your ideas with Devil's Advocate AI. An automated multi-model AI peer review tool.

27. [Vc Associate Screening...](https://suprmind.ai/hub/use-cases/investment-decisions/) - Use Case Investment Decisions with AI-Powered Devil's Advocacy Run investment theses through 5 AI mo...

28. [I built an open-source AI system to track whether my PSX investment theses are still intact — free to use](https://www.reddit.com/r/pakistan/comments/1tiniz8/i_built_an_opensource_ai_system_to_track_whether/) - I built an open-source AI system to track whether my PSX investment theses are still intact — free t...

29. [Thesis Tracker - findskills.co](https://findskills.co/skills/equity-research-thesis-tracker/) - Track and monitor investment thesis milestones, update conviction scores, and flag when thesis assum...

30. [Thesis Tracker - Investment Analysis Claude Code Skill](https://mcpmarket.com/tools/skills/thesis-tracker-2) - Track investment theses, monitor catalysts, and manage portfolio convictions with the Thesis Tracker...

31. [Mira - AI Agents on GitHub | SkillsLLM](https://skillsllm.com/skill/mira) - Agent-native investment research system for evidence-tracked, refreshable investment theses. Mira is...

32. [llmquant-portfolio Skill by llmquant](https://claudeskills.info/skills/llmquant/skills/llmquant-portfolio/) - Router skill for LLMQuant portfolio workflows. Use when the user needs company profiles, thesis trac...

33. [두물머리, 투자 전문 GPTs '불리오 인베스트' GPT 스토어에 선봬](https://news.nate.com/view/20240111n30703) - 한눈에 보는 오늘 : 경제 - 뉴스 : 챗GPT(ChatGPT)를 운영하는 오픈AI가 GPT 스토어를 공식 오픈했다. 이를 통해 유용한 ChatGPT 버전을 쉽게 찾아 사용할 수 ...

34. [노션으로 자산관리 하는 방법 (노션 주식, 코인, ETF 투자 ...](https://gongysd.com/notion-budget/?bmode=view&idx=168007072) - 노션 자산 관리 템플릿으로 수입·지출부터 주식·코인·ETF까지 한눈에 통합 관리! 자동 계산·매매일지로 자산 변화를 똑똑하게 파악하세요.단순 가계부를 넘어 수입·지출과 투자 자산을...

35. [‎Index Guard - 투자 심리 및 손실 방어 앱](https://apps.apple.com/us/app/index-guard-%ED%88%AC%EC%9E%90-%EC%8B%AC%EB%A6%AC-%EB%B0%8F-%EC%86%90%EC%8B%A4-%EB%B0%A9%EC%96%B4/id6755416239?l=ko) - App Store에서 Jaeho Sin의 Index Guard - 투자 심리 및 손실 방어 앱을 다운로드하십시오. 스크린샷, 평가 및 리뷰, 사용자 팁 및 Index Guard -...

36. [[현장] 카카오페이증권 "성장 공식 찾았다"…AI·카카오 생태계 ...](https://kr.investing.com/news/stock-market-news/article-2025967) - [현장] 카카오페이증권 "성장 공식 찾았다"…AI·카카오 생태계로 토스증권 추격

37. [[조세금융신문] 미래에셋증권, ‘AI’로 투자정보 제공…상품제안‧사후관리 지원](https://www.tfmedia.co.kr/news/article.html?no=161552) - (조세금융신문=진민경 기자) 미래에셋증권이 금융투자업계에서 AI 도입 관련 가시적인 성과를 내고 있는 것으로 확인됐다. 챗 GPT가 전 세계에 생성형 인공지능 열풍을 불러 온지 1...

