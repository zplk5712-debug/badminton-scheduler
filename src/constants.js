export const GRADES = ["A", "B", "C", "D", "초심"];
export const GENDERS = ["남", "여"];
export const AGE_BANDS = ["20대", "30대", "40대", "50대", "60대+"];

export const MODES = [
  { value: "friendly", label: "친선전", icon: "🏸", accent: "blue" },
  { value: "tournament", label: "대회", icon: "🏆", accent: "purple" },
  { value: "rivalry", label: "대항전", icon: "⚔️", accent: "orange" },
  { value: "league", label: "정기전", icon: "👥", accent: "green" },
];

export const RIVALRY_TEAMS = ["홈팀", "원정팀"];
export const DEFAULT_MAX_GAMES = 3;
export const TOTAL_COURTS = 4;
export const STORAGE_KEY = "badmonkeyz_scheduler_final_v1";

export const MALE_POINTS = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  초심: 1,
};

export const FEMALE_POINTS = {
  A: 3.8,
  B: 2.5,
  C: 2.0,
  D: 1.5,
  초심: 0.5,
};

export const EVENT_DEFAULTS_BY_GENDER = {
  남: { nam: true, yeo: false, hon: false },
  여: { nam: false, yeo: true, hon: false },
};

export const MODE_COPY = {
  friendly: {
    title: "친선전 매치 생성",
    short: "실력 점수 기반 밸런스 자동 매칭",
    description: "실력 점수를 기준으로 밸런스가 맞는 복식 경기를 자동으로 생성합니다.",
    bullets: ["점수 밸런스 매칭", "혼복 · 남복 · 여복 자동 조합"],
  },
  tournament: {
    title: "대회 대진표 생성",
    short: "급수와 참가 종목 기준 매칭",
    description: "급수와 참가 종목을 기준으로 경기 대진표를 생성합니다.",
    bullets: ["급수 기준 경기", "남복 · 여복 · 혼복 설정"],
  },
  rivalry: {
    title: "대항전 매치 생성",
    short: "홈팀 vs 원정팀 팀 대결 매칭",
    description: "홈팀과 원정팀 방식으로 팀 대결 대진표를 공정하게 생성합니다.",
    bullets: ["팀 기반 매칭", "홈팀 · 원정팀 밸런스"],
  },
  league: {
    title: "정기전 매치 생성",
    short: "연령대 팀 내부 리그전",
    description: "연령대 자체를 팀으로 보고, 팀 내부에서 파트너를 선정해 내부 리그전과 순위표를 생성합니다.",
    bullets: ["연령대 팀 생성", "팀 내부 파트너", "팀별 순위표"],
  },
};