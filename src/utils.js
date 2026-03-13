import {
  AGE_BANDS,
  DEFAULT_MAX_GAMES,
  EVENT_DEFAULTS_BY_GENDER,
  FEMALE_POINTS,
  GRADES,
  MALE_POINTS,
  RIVALRY_TEAMS,
} from "./constants";

export function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeEventsByGender(gender, events) {
  const base = deepClone(EVENT_DEFAULTS_BY_GENDER[gender] || EVENT_DEFAULTS_BY_GENDER["남"]);

  if (!events) return base;

  if (gender === "남") {
    return {
      nam: !!events.nam,
      yeo: false,
      hon: !!events.hon,
    };
  }

  return {
    nam: false,
    yeo: !!events.yeo,
    hon: !!events.hon,
  };
}

export function getBaseScore(grade, gender) {
  return gender === "남" ? MALE_POINTS[grade] : FEMALE_POINTS[grade];
}

export function getPlayerScore(player) {
  if (typeof player.customScore === "number" && Number.isFinite(player.customScore)) {
    return player.customScore;
  }
  return getBaseScore(player.grade, player.gender);
}

export function makePlayer(id, raw) {
  const gender = raw.gender === "여" ? "여" : "남";
  const grade = GRADES.includes(raw.grade) ? raw.grade : "C";
  const ageBand = AGE_BANDS.includes(raw.ageBand) ? raw.ageBand : "40대";

  const parsedScore =
    raw.customScore === "" || raw.customScore === null || raw.customScore === undefined
      ? null
      : Number(raw.customScore);

  return {
    id,
    name: String(raw.name || "").trim(),
    gender,
    grade,
    ageBand,
    maxGames: clampInt(raw.maxGames || DEFAULT_MAX_GAMES, 1, 20),
    customScore: Number.isFinite(parsedScore) ? parsedScore : null,
    rivalryTeam: RIVALRY_TEAMS.includes(raw.rivalryTeam) ? raw.rivalryTeam : "홈팀",
    events: normalizeEventsByGender(gender, raw.events),
  };
}

export function parseTruthy(value) {
  return ["y", "yes", "1", "true", "o", "참가", "예", "ㅇ", "on"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

export function normalizeHeaderKey(key) {
  return String(key ?? "").replace(/\s+/g, "").trim().toLowerCase();
}

export function getRowValue(row, aliases) {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderKey(alias);
    const found = entries.find(([k]) => normalizeHeaderKey(k) === normalizedAlias);
    if (found) return found[1];
  }
  return "";
}

export function getTeamType(team) {
  const maleCount = team.filter((p) => p.gender === "남").length;
  if (maleCount === 2) return "NAM";
  if (maleCount === 1) return "HON";
  return "YEO";
}

export function typeLabel(type) {
  return {
    NAM: "남복",
    YEO: "여복",
    HON: "혼복",
  }[type] || type;
}

export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}