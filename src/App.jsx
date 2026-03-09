import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";

const GRADES = ["A", "B", "C", "D", "초심"];
const GENDERS = ["남", "여"];
const MODES = [
  { value: "friendly", label: "친선전", icon: "🏸", accent: "blue" },
  { value: "tournament", label: "대회", icon: "🏆", accent: "purple" },
  { value: "rivalry", label: "대항전", icon: "⚔️", accent: "orange" },
];
const TEAMS = ["홈팀", "원정팀"];

const STORAGE_KEY_PLAYERS = "badmonkeyz_scheduler_v10_players";
const STORAGE_KEY_MODE = "badmonkeyz_scheduler_v10_mode";
const STORAGE_KEY_HOME = "badmonkeyz_scheduler_v10_home";

const MALE_POINTS = { A: 5, B: 4, C: 3, D: 2, 초심: 1 };
const FEMALE_POINTS = { A: 3.8, B: 2.5, C: 2.0, D: 1.5, 초심: 0.5 };

const TOTAL_COURTS = 4;
const MAX_GAMES = 20;
const DEFAULT_MAX_GAMES = 3;
const MAX_DIFF_SAME_TYPE = 1.0;
const MAX_TOTAL_ROUNDS_SOFT = 60;
const MAX_ROUND_TRIES = 220;

const CROSS_TYPE_RULES = {
  HON_YEO: { minGap: 1.0, stronger: "YEO" },
  HON_NAM: { minGap: 1.5, stronger: "HON" },
  NAM_YEO: { minGap: 2.0, stronger: "YEO" },
};

const EVENT_DEFAULTS_BY_GENDER = {
  남: { nam: true, yeo: false, hon: false },
  여: { nam: false, yeo: true, hon: false },
};

const MODE_COPY = {
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
};

const emptyPlayerForm = {
  name: "",
  gender: "남",
  grade: "C",
  maxGames: DEFAULT_MAX_GAMES,
  customScore: "",
  team: "홈팀",
  events: { nam: true, yeo: false, hon: false },
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)",
    color: "#172554",
    fontFamily:
      "Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    width: "min(1180px, calc(100% - 24px))",
    margin: "0 auto",
    padding: "24px 0 44px",
  },
  homeHero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(255,255,255,0.9)",
    boxShadow: "0 18px 60px rgba(51, 65, 85, 0.12)",
    padding: "32px 18px 28px",
  },
  watermark: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(72px, 18vw, 220px)",
    fontWeight: 900,
    letterSpacing: 4,
    color: "rgba(79, 70, 229, 0.04)",
    pointerEvents: "none",
    userSelect: "none",
  },
  brandLogoBox: {
    width: "min(520px, 92%)",
    margin: "0 auto 8px",
    padding: "16px 20px",
    borderRadius: 28,
    background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
    color: "white",
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.22)",
    textAlign: "center",
  },
  brandTop: {
    fontSize: "clamp(13px, 2vw, 18px)",
    fontWeight: 800,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.75)",
  },
  brandMain: {
    marginTop: 6,
    fontSize: "clamp(32px, 7vw, 68px)",
    fontWeight: 900,
    letterSpacing: 2,
    lineHeight: 0.95,
  },
  brandSub: {
    marginTop: 8,
    fontSize: "clamp(16px, 2.4vw, 24px)",
    fontWeight: 800,
    letterSpacing: 1,
    color: "#f59e0b",
  },
  titleBlock: { textAlign: "center", marginTop: 18, position: "relative", zIndex: 1 },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 6vw, 56px)",
    lineHeight: 1,
    fontWeight: 950,
    background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 55%, #7c3aed 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  subtitle: {
    marginTop: 8,
    fontSize: "clamp(16px, 2.6vw, 24px)",
    color: "#334155",
    fontWeight: 800,
  },
  lead: {
    margin: "14px auto 0",
    width: "min(760px, 92%)",
    fontSize: "clamp(14px, 2.2vw, 18px)",
    color: "#475569",
    lineHeight: 1.7,
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  },
  modeGrid: {
    marginTop: 30,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 18,
    position: "relative",
    zIndex: 1,
  },
  card: {
    borderRadius: 28,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(255,255,255,0.95)",
    boxShadow: "0 14px 35px rgba(15, 23, 42, 0.08)",
  },
  modeCard: {
    borderRadius: 28,
    overflow: "hidden",
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(255,255,255,0.98)",
    boxShadow: "0 16px 36px rgba(15, 23, 42, 0.10)",
    cursor: "pointer",
    transition: "transform .18s ease, box-shadow .18s ease",
  },
  sectionCard: {
    borderRadius: 28,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(255,255,255,0.95)",
    boxShadow: "0 14px 35px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  },
  button: {
    border: "none",
    cursor: "pointer",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 15,
    transition: "all .15s ease",
  },
  input: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    padding: "12px 14px",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    padding: "12px 14px",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
  },
  label: { display: "block", fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 800,
  },
};

const accentTheme = {
  blue: {
    soft: "linear-gradient(135deg, #e0f2fe 0%, #eef6ff 100%)",
    shadow: "0 18px 34px rgba(59, 130, 246, 0.14)",
    border: "#dbeafe",
    text: "#1d4ed8",
    button: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
    buttonText: "#fff",
  },
  purple: {
    soft: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)",
    shadow: "0 18px 34px rgba(124, 58, 237, 0.15)",
    border: "#e9d5ff",
    text: "#6d28d9",
    button: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
    buttonText: "#fff",
  },
  orange: {
    soft: "linear-gradient(135deg, #ffedd5 0%, #fff7ed 100%)",
    shadow: "0 18px 34px rgba(249, 115, 22, 0.16)",
    border: "#fed7aa",
    text: "#c2410c",
    button: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
    buttonText: "#fff",
  },
};

const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.trunc(v)));
const deepClone = (v) => JSON.parse(JSON.stringify(v));
const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join("_");
const opponentKey = (a, b) => [a, b].sort((x, y) => x - y).join("_");

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getKoreanDateString = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeEventsByGender = (gender, events) => {
  const base = deepClone(EVENT_DEFAULTS_BY_GENDER[gender]);
  if (!events) return base;
  if (gender === "남") return { nam: !!events.nam, yeo: false, hon: !!events.hon };
  return { nam: false, yeo: !!events.yeo, hon: !!events.hon };
};

const makePlayer = (id, raw) => {
  const gender = raw.gender === "여" ? "여" : "남";
  const grade = GRADES.includes(raw.grade) ? raw.grade : "C";
  const maxGames = clampInt(Number(raw.maxGames) || DEFAULT_MAX_GAMES, 1, MAX_GAMES);
  const customScore =
    raw.customScore === "" || raw.customScore === null || raw.customScore === undefined
      ? null
      : Number.isFinite(Number(raw.customScore))
      ? Number(raw.customScore)
      : null;

  return {
    id,
    name: String(raw.name || "").trim(),
    gender,
    grade,
    maxGames,
    customScore,
    team: TEAMS.includes(raw.team) ? raw.team : "홈팀",
    events: normalizeEventsByGender(gender, raw.events),
  };
};

const getBaseScore = (grade, gender) => (gender === "남" ? MALE_POINTS[grade] : FEMALE_POINTS[grade]);
const getPlayerScore = (player) =>
  typeof player.customScore === "number" && Number.isFinite(player.customScore)
    ? player.customScore
    : getBaseScore(player.grade, player.gender);

const getTeamType = (team) => {
  const maleCount = team.filter((p) => p.gender === "남").length;
  if (maleCount === 2) return "NAM";
  if (maleCount === 1) return "HON";
  return "YEO";
};

const typeLabel = (type) => ({ NAM: "남복", YEO: "여복", HON: "혼복" }[type] || type);

const teamAllowedByEvents = (team, modeValue) => {
  if (modeValue !== "tournament") return true;
  const type = getTeamType(team);
  if (type === "NAM") return team.every((p) => p.gender === "남" && p.events.nam);
  if (type === "YEO") return team.every((p) => p.gender === "여" && p.events.yeo);
  return (
    team.length === 2 &&
    team.some((p) => p.gender === "남") &&
    team.some((p) => p.gender === "여") &&
    team.every((p) => p.events.hon)
  );
};

const eventKeyForCrossType = (typeA, typeB) => [typeA, typeB].sort().join("_");

const buildMeta = (basePlayers) => {
  const playerStats = {};
  const teamPairCounts = {};
  const opponentCounts = {};
  basePlayers.forEach((p) => {
    playerStats[p.id] = {
      gamesPlayed: 0,
      sameTypeGames: { NAM: 0, YEO: 0, HON: 0 },
    };
  });
  return { playerStats, teamPairCounts, opponentCounts };
};

const enrichPlayers = (basePlayers, meta) =>
  basePlayers.map((p) => ({
    ...p,
    score: getPlayerScore(p),
    gamesPlayed: meta.playerStats[p.id]?.gamesPlayed ?? 0,
    remaining: p.maxGames - (meta.playerStats[p.id]?.gamesPlayed ?? 0),
  }));

const evaluateFriendlyLikeMatch = (teamA, teamB) => {
  const scoreA = teamA.reduce((s, p) => s + p.score, 0);
  const scoreB = teamB.reduce((s, p) => s + p.score, 0);
  const typeA = getTeamType(teamA);
  const typeB = getTeamType(teamB);
  const diff = Math.abs(scoreA - scoreB);

  if (typeA === typeB) {
    if (diff > MAX_DIFF_SAME_TYPE) return null;
    return {
      typeA,
      typeB,
      scoreA,
      scoreB,
      diff,
      matchLabel: `${typeLabel(typeA)} vs ${typeLabel(typeB)}`,
      basePenalty: diff * 10,
    };
  }

  const key = eventKeyForCrossType(typeA, typeB);
  const rule = CROSS_TYPE_RULES[key];
  if (!rule) return null;

  const strongerScore = rule.stronger === typeA ? scoreA : scoreB;
  const weakerScore = rule.stronger === typeA ? scoreB : scoreA;
  if (strongerScore - weakerScore < rule.minGap) return null;

  let basePenalty = 200;
  if (key === "HON_YEO") basePenalty = 100;
  if (key === "HON_NAM") basePenalty = 160;
  if (key === "NAM_YEO") basePenalty = 220;

  return {
    typeA,
    typeB,
    scoreA,
    scoreB,
    diff,
    matchLabel: `${typeLabel(typeA)} vs ${typeLabel(typeB)}`,
    basePenalty: basePenalty + Math.abs(strongerScore - weakerScore - rule.minGap) * 8,
  };
};

const evaluateTournamentMatch = (teamA, teamB) => {
  const typeA = getTeamType(teamA);
  const typeB = getTeamType(teamB);
  if (typeA !== typeB) return null;
  if (![...teamA, ...teamB].every((p) => p.grade === teamA[0].grade)) return null;
  if (!teamAllowedByEvents(teamA, "tournament") || !teamAllowedByEvents(teamB, "tournament")) return null;

  const scoreA = teamA.reduce((s, p) => s + p.score, 0);
  const scoreB = teamB.reduce((s, p) => s + p.score, 0);
  const diff = Math.abs(scoreA - scoreB);
  if (diff > MAX_DIFF_SAME_TYPE) return null;

  return {
    typeA,
    typeB,
    scoreA,
    scoreB,
    diff,
    matchLabel: `${teamA[0].grade}급 ${typeLabel(typeA)}`,
    basePenalty: diff * 10,
  };
};

const evaluateRivalryStrictMatch = (teamA, teamB) => {
  const teamNameA = teamA[0].team;
  const teamNameB = teamB[0].team;
  if (teamNameA === teamNameB) return null;
  if (!teamA.every((p) => p.team === teamNameA) || !teamB.every((p) => p.team === teamNameB)) return null;

  const typeA = getTeamType(teamA);
  const typeB = getTeamType(teamB);
  if (typeA !== typeB) return null;
  if (![...teamA, ...teamB].every((p) => p.grade === teamA[0].grade)) return null;

  const scoreA = teamA.reduce((s, p) => s + p.score, 0);
  const scoreB = teamB.reduce((s, p) => s + p.score, 0);
  const diff = Math.abs(scoreA - scoreB);
  if (diff > MAX_DIFF_SAME_TYPE) return null;

  return {
    typeA,
    typeB,
    scoreA,
    scoreB,
    diff,
    matchLabel: `${teamA[0].grade}급 ${typeLabel(typeA)} (${teamNameA} vs ${teamNameB})`,
    basePenalty: diff * 10,
  };
};

const evaluateRivalryFlexibleMatch = (teamA, teamB) => {
  const teamNameA = teamA[0].team;
  const teamNameB = teamB[0].team;
  if (teamNameA === teamNameB) return null;
  if (!teamA.every((p) => p.team === teamNameA) || !teamB.every((p) => p.team === teamNameB)) return null;

  const base = evaluateFriendlyLikeMatch(teamA, teamB);
  if (!base) return null;

  const all = [...teamA, ...teamB];
  const gradePenalty = new Set(all.map((p) => p.grade)).size === 1 ? 0 : 80;
  return {
    ...base,
    matchLabel: `${base.matchLabel} (${teamNameA} vs ${teamNameB})`,
    basePenalty: base.basePenalty + gradePenalty,
  };
};

const scorePreferencePenalty = (meta, teamA, teamB, evaluated) => {
  let penalty = evaluated.basePenalty;
  const allPlayers = [...teamA, ...teamB];

  allPlayers.forEach((player) => {
    const st = meta.playerStats[player.id];
    penalty += st.gamesPlayed * 16;
    penalty -= Math.max(0, player.maxGames - st.gamesPlayed) * 5;
  });

  const teamAType = getTeamType(teamA);
  const teamBType = getTeamType(teamB);
  teamA.forEach((p) => {
    penalty += meta.playerStats[p.id].sameTypeGames[teamAType] * 2;
  });
  teamB.forEach((p) => {
    penalty += meta.playerStats[p.id].sameTypeGames[teamBType] * 2;
  });

  [teamA, teamB].forEach((team) => {
    const key = pairKey(team[0].id, team[1].id);
    penalty += (meta.teamPairCounts[key] || 0) * 35;
  });

  const crossPairs = [
    [teamA[0].id, teamB[0].id],
    [teamA[0].id, teamB[1].id],
    [teamA[1].id, teamB[0].id],
    [teamA[1].id, teamB[1].id],
  ];
  crossPairs.forEach(([a, b]) => {
    penalty += (meta.opponentCounts[opponentKey(a, b)] || 0) * 8;
  });

  return penalty;
};

const buildTeamCandidates = (pool, modeValue) => {
  const teams = [];
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const team = [pool[i], pool[j]];
      if (modeValue === "tournament" && !teamAllowedByEvents(team, modeValue)) continue;
      if (modeValue === "rivalry") {
        const teamNames = new Set(team.map((p) => p.team));
        if (teamNames.size !== 1) continue;
      }
      teams.push({
        players: team,
        type: getTeamType(team),
        score: team.reduce((s, p) => s + p.score, 0),
      });
    }
  }
  return teams;
};

const selectGreedyMatches = (possibleMatches, usedIdsGlobal) => {
  const localUsed = new Set();
  const selected = [];
  for (const match of possibleMatches) {
    const ids = [...match.teamA, ...match.teamB].map((p) => p.id);
    if (ids.some((id) => usedIdsGlobal.has(id) || localUsed.has(id))) continue;
    ids.forEach((id) => localUsed.add(id));
    selected.push(match);
    if (selected.length >= TOTAL_COURTS) break;
  }
  return selected;
};

const buildCandidateMatches = (pool, meta, modeValue, evaluator) => {
  const teams = buildTeamCandidates(pool, modeValue);
  const possibleMatches = [];

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const idsA = new Set(teams[i].players.map((p) => p.id));
      if (teams[j].players.some((p) => idsA.has(p.id))) continue;
      const evaluated = evaluator(teams[i].players, teams[j].players);
      if (!evaluated) continue;
      possibleMatches.push({
        courtId: 0,
        teamA: teams[i].players,
        teamB: teams[j].players,
        ...evaluated,
        penalty: scorePreferencePenalty(meta, teams[i].players, teams[j].players, evaluated),
      });
    }
  }

  return possibleMatches.sort((a, b) => a.penalty - b.penalty);
};

const pickBestRound = (basePlayers, meta, modeValue) => {
  const enriched = enrichPlayers(basePlayers, meta).filter((p) => p.remaining > 0);
  if (enriched.length < 4) return [];

  const ordered = shuffle(enriched).sort((a, b) => {
    const remainingDiff = (b.maxGames - meta.playerStats[b.id].gamesPlayed) - (a.maxGames - meta.playerStats[a.id].gamesPlayed);
    if (remainingDiff !== 0) return remainingDiff;
    return meta.playerStats[a.id].gamesPlayed - meta.playerStats[b.id].gamesPlayed;
  });

  const usedIds = new Set();

  if (modeValue === "rivalry") {
    const strictPossible = buildCandidateMatches(ordered, meta, modeValue, evaluateRivalryStrictMatch);
    const strictSelected = selectGreedyMatches(strictPossible, usedIds);
    strictSelected.forEach((match) => [...match.teamA, ...match.teamB].forEach((p) => usedIds.add(p.id)));

    if (strictSelected.length >= TOTAL_COURTS) {
      return strictSelected.map((m, idx) => ({ ...m, courtId: idx + 1 }));
    }

    const remainPool = ordered.filter((p) => !usedIds.has(p.id));
    const flexiblePossible = buildCandidateMatches(remainPool, meta, modeValue, evaluateRivalryFlexibleMatch);
    const flexibleSelected = selectGreedyMatches(flexiblePossible, usedIds);
    return [...strictSelected, ...flexibleSelected]
      .slice(0, TOTAL_COURTS)
      .map((m, idx) => ({ ...m, courtId: idx + 1 }));
  }

  const evaluator = modeValue === "tournament" ? evaluateTournamentMatch : evaluateFriendlyLikeMatch;
  const possible = buildCandidateMatches(ordered, meta, modeValue, evaluator);
  return selectGreedyMatches(possible, usedIds).map((m, idx) => ({ ...m, courtId: idx + 1 }));
};

const commitMatchesToMeta = (matches, meta) => {
  matches.forEach((match) => {
    const typeA = getTeamType(match.teamA);
    const typeB = getTeamType(match.teamB);

    [...match.teamA, ...match.teamB].forEach((player) => {
      meta.playerStats[player.id].gamesPlayed += 1;
    });

    match.teamA.forEach((player) => {
      meta.playerStats[player.id].sameTypeGames[typeA] += 1;
    });
    match.teamB.forEach((player) => {
      meta.playerStats[player.id].sameTypeGames[typeB] += 1;
    });

    [match.teamA, match.teamB].forEach((team) => {
      const k = pairKey(team[0].id, team[1].id);
      meta.teamPairCounts[k] = (meta.teamPairCounts[k] || 0) + 1;
    });

    const crossPairs = [
      [match.teamA[0].id, match.teamB[0].id],
      [match.teamA[0].id, match.teamB[1].id],
      [match.teamA[1].id, match.teamB[0].id],
      [match.teamA[1].id, match.teamB[1].id],
    ];
    crossPairs.forEach(([a, b]) => {
      const k = opponentKey(a, b);
      meta.opponentCounts[k] = (meta.opponentCounts[k] || 0) + 1;
    });
  });
};

const getRoundPenalty = (matches) => matches.reduce((sum, m) => sum + (m.penalty || 0), 0);

const Card = ({ children, style = {}, className = "" }) => (
  <div className={className} style={{ ...styles.card, ...style }}>{children}</div>
);

const SectionCard = ({ title, right, children }) => (
  <div style={styles.sectionCard}>
    <div
      style={{
        padding: "18px 18px 14px",
        borderBottom: "1px solid #eef2ff",
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color: "#1e1b4b" }}>{title}</div>
      {right}
    </div>
    <div style={{ padding: 18 }}>{children}</div>
  </div>
);

const Button = ({ children, onClick, variant = "primary", disabled = false, style = {}, type = "button" }) => {
  const map = {
    primary: {
      background: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)",
      color: "white",
      boxShadow: "0 10px 24px rgba(59, 130, 246, 0.24)",
    },
    secondary: {
      background: "white",
      color: "#334155",
      border: "1px solid #cbd5e1",
      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
    },
    success: {
      background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
      color: "white",
      boxShadow: "0 10px 24px rgba(34, 197, 94, 0.20)",
    },
    danger: {
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
      boxShadow: "0 10px 24px rgba(239, 68, 68, 0.20)",
    },
    excel: {
      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
      color: "white",
      boxShadow: "0 10px 24px rgba(34, 197, 94, 0.18)",
    },
    modeBack: {
      background: "rgba(255,255,255,0.88)",
      color: "#1f2937",
      border: "1px solid #e2e8f0",
      boxShadow: "0 8px 18px rgba(15,23,42,.04)",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.button,
        ...map[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
};

const Pill = ({ children, tone = "slate" }) => {
  const toneMap = {
    slate: { background: "#f1f5f9", color: "#334155" },
    blue: { background: "#dbeafe", color: "#1d4ed8" },
    pink: { background: "#fce7f3", color: "#be185d" },
    indigo: { background: "#e0e7ff", color: "#4338ca" },
    orange: { background: "#ffedd5", color: "#c2410c" },
    green: { background: "#dcfce7", color: "#166534" },
  };
  return <span style={{ ...styles.pill, ...toneMap[tone] }}>{children}</span>;
};

const Input = (props) => <input {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
const Select = ({ children, ...props }) => <select {...props} style={{ ...styles.select, ...(props.style || {}) }}>{children}</select>;

function LogoPanel() {
  return (
    <div style={styles.brandLogoBox}>
      <div style={styles.brandTop}>YEAR OF THE MON</div>
      <div style={styles.brandMain}>BADMONKEYZ</div>
      <div style={styles.brandSub}>BADMINTON</div>
    </div>
  );
}

function HomePage({ onSelectMode }) {
  return (
    <div style={styles.homeHero}>
      <div style={styles.watermark}>BADMONKEYZ</div>
      <LogoPanel />
      <div style={styles.titleBlock}>
        <h1 style={styles.title}>BADMONKEYZ</h1>
        <div style={styles.subtitle}>Badminton Match System</div>
      </div>
      <div style={styles.lead}>
        배드민턴 친선전 · 대회 · 대항전을 자동으로 생성하는 매치 시스템입니다.<br />
        원하는 경기 모드를 선택해 바로 시작할 수 있습니다.
      </div>

      <div style={styles.modeGrid}>
        {MODES.map((mode) => {
          const theme = accentTheme[mode.accent];
          const copy = MODE_COPY[mode.value];
          return (
            <div
              key={mode.value}
              style={{ ...styles.modeCard, background: theme.soft, boxShadow: theme.shadow, border: `1px solid ${theme.border}` }}
              onClick={() => onSelectMode(mode.value)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = theme.shadow.replace("34px", "42px");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = theme.shadow;
              }}
            >
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                    background: "rgba(255,255,255,0.78)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.8)",
                  }}
                >
                  {mode.icon}
                </div>
                <div style={{ marginTop: 18, fontSize: 32, fontWeight: 950, color: theme.text }}>{mode.label}</div>
                <div style={{ marginTop: 10, color: "#475569", lineHeight: 1.7, minHeight: 70 }}>{copy.description}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                  {copy.bullets.map((bullet) => (
                    <div key={bullet} style={{ color: theme.text, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                      <span>✓</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="primary"
                  style={{
                    width: "100%",
                    marginTop: 18,
                    background: theme.button,
                    color: theme.buttonText,
                    boxShadow: "0 10px 24px rgba(15,23,42,.10)",
                  }}
                >
                  {mode.label} 시작
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useResponsive() {
  const [mobile, setMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 768 : false));
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

function App() {
  const isMobile = useResponsive();
  const [players, setPlayers] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [activeTab, setActiveTab] = useState("players");
  const [mode, setMode] = useState("friendly");
  const [homeMode, setHomeMode] = useState(true);
  const [playerForm, setPlayerForm] = useState(emptyPlayerForm);
  const [message, setMessage] = useState("");
  const [uploadSummary, setUploadSummary] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const scheduleRef = useRef(null);
  const uploadInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedPlayers = localStorage.getItem(STORAGE_KEY_PLAYERS);
      const savedMode = localStorage.getItem(STORAGE_KEY_MODE);
      const savedHome = localStorage.getItem(STORAGE_KEY_HOME);
      if (savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        if (Array.isArray(parsed)) {
          setPlayers(parsed.map((p, idx) => makePlayer(p.id ?? idx + 1, p)).filter((p) => p.name));
        }
      }
      if (savedMode && MODES.some((m) => m.value === savedMode)) setMode(savedMode);
      if (savedHome !== null) setHomeMode(savedHome === "true");
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HOME, String(homeMode));
  }, [homeMode]);

  useEffect(() => {
    setSchedule([]);
    setActiveTab("players");
    setUploadSummary(null);
    setMessage("");
  }, [mode]);

  const playersWithLiveScore = useMemo(() => players.map((p) => ({ ...p, liveScore: getPlayerScore(p) })), [players]);
  const nextId = useMemo(() => (players.length ? Math.max(...players.map((p) => p.id)) + 1 : 1), [players]);
  const modeTheme = accentTheme[MODES.find((m) => m.value === mode)?.accent || "blue"];
  const modeInfo = MODE_COPY[mode];

  const countByGender = useCallback((gender) => players.filter((p) => p.gender === gender).length, [players]);
  const countByTeam = useCallback((team) => players.filter((p) => p.team === team).length, [players]);

  const theoreticalRounds = useMemo(() => {
    const totalGames = players.reduce((sum, p) => sum + Number(p.maxGames || 0), 0);
    const totalMatches = Math.floor(totalGames / 4);
    return Math.floor(totalMatches / TOTAL_COURTS);
  }, [players]);

  const changeGenderInForm = (gender) => {
    setPlayerForm((prev) => ({
      ...prev,
      gender,
      events: normalizeEventsByGender(gender, prev.events),
    }));
  };

  const updatePlayerField = (id, patch) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        if (patch.gender && patch.gender !== p.gender) {
          merged.events = normalizeEventsByGender(patch.gender, merged.events);
        }
        return makePlayer(id, merged);
      })
    );
  };

  const addPlayer = () => {
    const trimmedName = playerForm.name.trim();
    if (!trimmedName) {
      setMessage("선수 이름을 입력해 주세요.");
      return;
    }
    if (players.some((p) => p.name === trimmedName)) {
      setMessage(`'${trimmedName}' 선수는 이미 등록되어 있습니다.`);
      return;
    }

    const candidate = makePlayer(nextId, {
      ...playerForm,
      name: trimmedName,
      customScore: playerForm.customScore === "" ? null : playerForm.customScore,
    });

    setPlayers((prev) => [...prev, candidate]);
    setPlayerForm((prev) => ({
      ...emptyPlayerForm,
      gender: prev.gender,
      grade: prev.grade,
      team: prev.team,
      events: normalizeEventsByGender(prev.gender, prev.events),
    }));
    setMessage(`선수 '${candidate.name}' 등록 완료`);
  };

  const deletePlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setSchedule([]);
  };

  const resetAllPlayers = () => {
    if (!window.confirm("등록된 선수 전체를 삭제할까요?")) return;
    setPlayers([]);
    setSchedule([]);
    setMessage("전체 선수 목록이 초기화되었습니다.");
  };

  const triggerExcelUpload = () => uploadInputRef.current?.click();

  const downloadTemplate = () => {
    const rows = [
      {
        이름: "김철수",
        성별: "남",
        급수: "B",
        목표경기: 3,
        커스텀점수: "",
        소속팀: "홈팀",
        남복참가: "Y",
        여복참가: "",
        혼복참가: "",
      },
      {
        이름: "이영희",
        성별: "여",
        급수: "C",
        목표경기: 3,
        커스텀점수: "",
        소속팀: "원정팀",
        남복참가: "",
        여복참가: "Y",
        혼복참가: "Y",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 8 },
      { wch: 8 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "선수등록예시");
    XLSX.writeFile(wb, `BADMONKEYZ_선수등록_예시_${getKoreanDateString()}.xlsx`);
  };

  const parseTruthy = (value) => ["y", "yes", "1", "true", "o", "참가"].includes(String(value ?? "").trim().toLowerCase());

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSummary(null);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      let currentId = nextId;
      const success = [];
      const failures = [];
      const existingNames = new Set(players.map((p) => p.name));
      const newNames = new Set();

      rows.forEach((row, idx) => {
        const rowNo = idx + 2;
        const name = String(row.이름 ?? row.name ?? "").trim();
        const gender = String(row.성별 ?? row.gender ?? "").trim();
        const grade = String(row.급수 ?? row.grade ?? "").trim();
        const maxGamesRaw = row.목표경기 ?? row.maxGames ?? row["목표 경기"];
        const customScoreRaw = row.커스텀점수 ?? row.customScore ?? "";
        const team = String(row.소속팀 ?? row.team ?? "홈팀").trim() || "홈팀";
        const nam = parseTruthy(row.남복참가 ?? row.nam ?? "");
        const yeo = parseTruthy(row.여복참가 ?? row.yeo ?? "");
        const hon = parseTruthy(row.혼복참가 ?? row.hon ?? "");

        if (!name) return failures.push({ rowNo, reason: "이름이 비어 있습니다." });
        if (existingNames.has(name) || newNames.has(name)) return failures.push({ rowNo, reason: "중복된 이름입니다." });
        if (!GENDERS.includes(gender)) return failures.push({ rowNo, reason: "성별은 남 또는 여여야 합니다." });
        if (!GRADES.includes(grade)) return failures.push({ rowNo, reason: "급수는 A/B/C/D/초심 중 하나여야 합니다." });

        const maxGames = Number(maxGamesRaw);
        if (!Number.isFinite(maxGames) || maxGames < 1 || maxGames > MAX_GAMES) {
          return failures.push({ rowNo, reason: `목표경기는 1~${MAX_GAMES} 사이 숫자여야 합니다.` });
        }

        if (
          !(customScoreRaw === "" || customScoreRaw === null || customScoreRaw === undefined) &&
          !Number.isFinite(Number(customScoreRaw))
        ) {
          return failures.push({ rowNo, reason: "커스텀점수는 비우거나 숫자여야 합니다." });
        }

        if (!TEAMS.includes(team)) return failures.push({ rowNo, reason: "소속팀은 홈팀/원정팀이어야 합니다." });

        const candidate = makePlayer(currentId++, {
          name,
          gender,
          grade,
          maxGames,
          customScore: customScoreRaw === "" ? null : Number(customScoreRaw),
          team,
          events: normalizeEventsByGender(gender, { nam, yeo, hon }),
        });
        newNames.add(name);
        success.push(candidate);
      });

      if (success.length) setPlayers((prev) => [...prev, ...success]);
      setUploadSummary({
        total: rows.length,
        success: success.length,
        failed: failures.length,
        failures: failures.slice(0, 5),
      });
      setMessage(`엑셀 등록 완료: 성공 ${success.length}건 / 실패 ${failures.length}건`);
    } catch (err) {
      console.error(err);
      setMessage("엑셀 업로드 중 오류가 발생했습니다.");
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const generateSchedule = () => {
    if (players.length < 4) {
      setMessage("최소 4명 이상 등록해야 합니다.");
      return;
    }

    try {
      const meta = buildMeta(playersWithLiveScore);
      const rounds = [];

      for (let roundNo = 1; roundNo <= MAX_TOTAL_ROUNDS_SOFT; roundNo += 1) {
        let bestMatches = [];
        let bestPenalty = Infinity;

        for (let tryCount = 0; tryCount < MAX_ROUND_TRIES; tryCount += 1) {
          const result = pickBestRound(shuffle(playersWithLiveScore), meta, mode);
          const penalty = getRoundPenalty(result);
          if (
            result.length > bestMatches.length ||
            (result.length === bestMatches.length && penalty < bestPenalty)
          ) {
            bestMatches = result;
            bestPenalty = penalty;
          }
          if (bestMatches.length >= TOTAL_COURTS && bestPenalty <= 20) break;
        }

        if (!bestMatches.length) break;
        commitMatchesToMeta(bestMatches, meta);
        rounds.push({ id: roundNo, matches: bestMatches });

        const completed = playersWithLiveScore.every((p) => meta.playerStats[p.id].gamesPlayed >= p.maxGames);
        if (completed) break;
      }

      setSchedule(rounds);
      setActiveTab("schedule");

      const unmetCount = playersWithLiveScore.filter((p) => meta.playerStats[p.id].gamesPlayed < p.maxGames).length;

      if (!rounds.length) {
        setMessage("대진을 생성하지 못했습니다. 인원, 성별, 급수, 참가종목, 소속팀 조건을 확인해 주세요.");
      } else if (unmetCount > 0) {
        setMessage(`대진 생성 완료 (${rounds.length}R). 일부 선수는 목표경기를 모두 채우지 못했습니다.`);
      } else {
        setMessage(`대진 생성 완료 (${rounds.length}R)`);
      }
    } catch (e) {
      console.error(e);
      setMessage("대진 생성 중 오류가 발생했습니다.");
    }
  };

  const downloadExcel = () => {
    if (!schedule.length) {
      window.alert("생성된 대진표가 없습니다.");
      return;
    }

    const rows = [];
    schedule.forEach((round) => {
      round.matches.forEach((match) => {
        rows.push({
          모드: MODES.find((m) => m.value === mode)?.label,
          라운드: `${round.id}R`,
          코트: `${match.courtId}코트`,
          경기유형: match.matchLabel,
          팀A: `${match.teamA[0].name} / ${match.teamA[1].name}`,
          팀B: `${match.teamB[0].name} / ${match.teamB[1].name}`,
          팀A합점: match.scoreA.toFixed(1),
          팀B합점: match.scoreB.toFixed(1),
          점수차: match.diff.toFixed(1),
        });
      });
      rows.push({});
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "대진표");
    XLSX.writeFile(wb, `BADMONKEYZ_대진표_${getKoreanDateString()}.xlsx`);
  };

  const downloadScheduleImage = async () => {
    if (!scheduleRef.current) return;
    try {
      const node = scheduleRef.current;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: "#f8fafc",
        skipFonts: false,
        width: node.scrollWidth,
        height: node.scrollHeight,
        canvasWidth: node.scrollWidth,
        canvasHeight: node.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = `BADMONKEYZ_대진표_${getKoreanDateString()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      setMessage("이미지 저장 중 오류가 발생했습니다.");
    }
  };

  const modeAllows = {
    team: mode === "rivalry",
    events: mode === "tournament",
  };

  const renderEventChecks = (player, onChange, compact = false) => {
    const items = [
      { key: "nam", label: "남복", disabled: player.gender !== "남" },
      { key: "yeo", label: "여복", disabled: player.gender !== "여" },
      { key: "hon", label: "혼복", disabled: false },
    ];

    return (
      <div style={{ display: "flex", gap: compact ? 12 : 16, flexWrap: "wrap", fontSize: compact ? 13 : 12 }}>
        {items.map((item) => (
          <label key={item.key} style={{ display: "inline-flex", gap: 6, alignItems: "center", opacity: item.disabled ? 0.45 : 1 }}>
            <input
              type="checkbox"
              checked={!!player.events[item.key]}
              disabled={item.disabled}
              onChange={(e) => onChange(item.key, e.target.checked)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    );
  };

  const headerSummary = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
      <Pill tone="indigo">현재 모드: {MODES.find((m) => m.value === mode)?.label}</Pill>
      <Pill tone="slate">인원 {players.length}명</Pill>
      <Pill tone="blue">남 {countByGender("남")}명</Pill>
      <Pill tone="pink">여 {countByGender("여")}명</Pill>
      {mode === "rivalry" && (
        <>
          <Pill tone="orange">홈팀 {countByTeam("홈팀")}명</Pill>
          <Pill tone="orange">원정팀 {countByTeam("원정팀")}명</Pill>
        </>
      )}
      <Pill tone="green">이론상 최대 {theoreticalRounds}R</Pill>
    </div>
  );

  if (homeMode) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <HomePage
            onSelectMode={(value) => {
              setMode(value);
              setHomeMode(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <input ref={uploadInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleExcelUpload} />

        <div
          style={{
            ...Card,
            borderRadius: 30,
            overflow: "hidden",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 16px 48px rgba(30, 41, 59, 0.10)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 30,
              background: `linear-gradient(135deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.80) 100%)`,
              padding: isMobile ? 18 : 26,
            }}
          >
            <div style={{ position: "absolute", right: -20, top: -10, fontSize: isMobile ? 90 : 160, fontWeight: 900, color: "rgba(79,70,229,.04)" }}>
              BAD
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: isMobile ? "flex-start" : "center", flexWrap: "wrap", position: "relative" }}>
              <div>
                <Button variant="modeBack" onClick={() => setHomeMode(true)} style={{ marginBottom: 16 }}>
                  ← HOME
                </Button>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: modeTheme.text }}>🐵🏸 BADMONKEYZ</div>
                <div style={{ marginTop: 4, fontSize: isMobile ? 28 : 40, fontWeight: 950, color: "#1e1b4b", lineHeight: 1.05 }}>{modeInfo.title}</div>
                <div style={{ marginTop: 8, color: "#475569", fontWeight: 700 }}>{modeInfo.short}</div>
                {headerSummary}
              </div>
              {!isMobile && (
                <div
                  style={{
                    minWidth: 250,
                    borderRadius: 26,
                    padding: 18,
                    background: modeTheme.soft,
                    border: `1px solid ${modeTheme.border}`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.85)",
                  }}
                >
                  <div style={{ fontSize: 30 }}>{MODES.find((m) => m.value === mode)?.icon}</div>
                  <div style={{ marginTop: 10, fontWeight: 900, fontSize: 18, color: modeTheme.text }}>{MODES.find((m) => m.value === mode)?.label}</div>
                  <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.7 }}>{modeInfo.description}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {message && (
          <div
            style={{
              ...styles.card,
              marginBottom: 16,
              background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)",
              border: "1px solid #dbeafe",
              padding: "14px 16px",
              color: "#1d4ed8",
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div
            style={{
              display: "inline-flex",
              gap: 8,
              padding: 8,
              borderRadius: 22,
              background: "rgba(255,255,255,0.86)",
              border: "1px solid rgba(255,255,255,0.95)",
              boxShadow: "0 12px 28px rgba(15, 23, 42, .06)",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setActiveTab("players")}
              style={{
                ...styles.button,
                background: activeTab === "players" ? modeTheme.button : "transparent",
                color: activeTab === "players" ? "white" : "#475569",
                minWidth: isMobile ? 140 : 180,
              }}
            >
              선수 관리 ({players.length})
            </button>
            <button
              onClick={() => setActiveTab("schedule")}
              style={{
                ...styles.button,
                background: activeTab === "schedule" ? modeTheme.button : "transparent",
                color: activeTab === "schedule" ? "white" : "#475569",
                minWidth: isMobile ? 140 : 180,
              }}
            >
              대진표 ({schedule.length}R)
            </button>
          </div>
        </div>

        {activeTab === "players" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              title="선수 등록"
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="excel" onClick={downloadTemplate}>📄 템플릿</Button>
                  <Button variant="secondary" onClick={triggerExcelUpload}>📥 엑셀 불러오기</Button>
                </div>
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(12, 1fr)",
                  gap: 14,
                }}
              >
                <div style={{ gridColumn: isMobile ? undefined : "span 3" }}>
                  <label style={styles.label}>이름</label>
                  <Input
                    value={playerForm.name}
                    placeholder="이름 입력"
                    onChange={(e) => setPlayerForm((prev) => ({ ...prev, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                  />
                </div>
                <div style={{ gridColumn: isMobile ? undefined : "span 2" }}>
                  <label style={styles.label}>성별</label>
                  <Select value={playerForm.gender} onChange={(e) => changeGenderInForm(e.target.value)}>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </Select>
                </div>
                <div style={{ gridColumn: isMobile ? undefined : "span 2" }}>
                  <label style={styles.label}>급수</label>
                  <Select value={playerForm.grade} onChange={(e) => setPlayerForm((prev) => ({ ...prev, grade: e.target.value }))}>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </Select>
                </div>
                <div style={{ gridColumn: isMobile ? undefined : "span 2" }}>
                  <label style={styles.label}>목표경기</label>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_GAMES}
                    value={playerForm.maxGames}
                    onChange={(e) =>
                      setPlayerForm((prev) => ({
                        ...prev,
                        maxGames: clampInt(Number(e.target.value || DEFAULT_MAX_GAMES), 1, MAX_GAMES),
                      }))
                    }
                  />
                </div>
                <div style={{ gridColumn: isMobile ? undefined : "span 3" }}>
                  <label style={styles.label}>커스텀점수 (선택)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="비우면 기본점수"
                    value={playerForm.customScore}
                    onChange={(e) => setPlayerForm((prev) => ({ ...prev, customScore: e.target.value }))}
                  />
                </div>

                {modeAllows.team && (
                  <div style={{ gridColumn: isMobile ? undefined : "span 3" }}>
                    <label style={styles.label}>소속팀 (대항전용)</label>
                    <Select value={playerForm.team} onChange={(e) => setPlayerForm((prev) => ({ ...prev, team: e.target.value }))}>
                      {TEAMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                )}

                {modeAllows.events && (
                  <div style={{ gridColumn: isMobile ? undefined : "span 6" }}>
                    <label style={styles.label}>참가종목 (대회 모드용)</label>
                    <div style={{ borderRadius: 18, border: "1px solid #dbeafe", background: "#f8fbff", padding: "13px 14px" }}>
                      {renderEventChecks(
                        playerForm,
                        (key, checked) =>
                          setPlayerForm((prev) => ({
                            ...prev,
                            events: normalizeEventsByGender(prev.gender, { ...prev.events, [key]: checked }),
                          })),
                        true
                      )}
                    </div>
                  </div>
                )}

                <div style={{ gridColumn: isMobile ? undefined : modeAllows.events || modeAllows.team ? "span 3" : "span 2", display: "flex", alignItems: "end" }}>
                  <Button variant="success" onClick={addPlayer} style={{ width: "100%", minHeight: 48 }}>➕ 선수 추가</Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={`선수 목록 (${players.length}명)`}
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button onClick={generateSchedule}>🚀 대진표 생성</Button>
                  <Button variant="secondary" onClick={() => setActiveTab("schedule")}>🏆 결과 보기</Button>
                  <Button variant="danger" onClick={resetAllPlayers}>🗑 전체 초기화</Button>
                </div>
              }
            >
              {uploadSummary && (
                <div
                  style={{
                    marginBottom: 14,
                    borderRadius: 18,
                    background: "#ecfdf5",
                    border: "1px solid #bbf7d0",
                    padding: "12px 14px",
                    color: "#166534",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  총 {uploadSummary.total}행 / 성공 {uploadSummary.success}행 / 실패 {uploadSummary.failed}행
                  {uploadSummary.failures?.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      {uploadSummary.failures.map((f, idx) => (
                        <div key={idx}>- {f.rowNo}행: {f.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isMobile ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 900 }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: "#64748b" }}>
                        {[
                          "이름",
                          "성별",
                          "급수",
                          "기본점수",
                          "커스텀점수",
                          "적용점수",
                          "목표경기",
                          ...(modeAllows.team ? ["소속팀"] : []),
                          ...(modeAllows.events ? ["참가종목"] : []),
                          "삭제",
                        ].map((head) => (
                          <th key={head} style={{ padding: "12px 10px", borderBottom: "1px solid #eef2ff" }}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {playersWithLiveScore.map((p) => (
                        <tr key={p.id}>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{p.name}</td>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                            <Pill tone={p.gender === "남" ? "blue" : "pink"}>{p.gender}</Pill>
                          </td>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>{p.grade}</td>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>{getBaseScore(p.grade, p.gender)}</td>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                            <Input
                              type="number"
                              step="0.1"
                              style={{ width: 92 }}
                              value={p.customScore ?? ""}
                              onChange={(e) => updatePlayerField(p.id, { customScore: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                          </td>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{p.liveScore}</td>
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                            <Input
                              type="number"
                              min={1}
                              max={MAX_GAMES}
                              style={{ width: 90 }}
                              value={p.maxGames}
                              onChange={(e) => updatePlayerField(p.id, { maxGames: clampInt(Number(e.target.value || DEFAULT_MAX_GAMES), 1, MAX_GAMES) })}
                            />
                          </td>
                          {modeAllows.team && (
                            <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                              <Select value={p.team} onChange={(e) => updatePlayerField(p.id, { team: e.target.value })}>
                                {TEAMS.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </Select>
                            </td>
                          )}
                          {modeAllows.events && (
                            <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                              {renderEventChecks(p, (key, checked) =>
                                updatePlayerField(p.id, {
                                  events: normalizeEventsByGender(p.gender, { ...p.events, [key]: checked }),
                                })
                              )}
                            </td>
                          )}
                          <td style={{ padding: "14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                            <button onClick={() => deletePlayer(p.id)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {playersWithLiveScore.map((p) => {
                    const expanded = editingId === p.id;
                    return (
                      <div key={p.id} style={{ borderRadius: 22, border: "1px solid #e2e8f0", padding: 16, background: "white", boxShadow: "0 10px 24px rgba(15,23,42,.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 900 }}>{p.name}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                              <Pill tone={p.gender === "남" ? "blue" : "pink"}>{p.gender}</Pill>
                              <Pill tone="indigo">{p.grade}급</Pill>
                              {modeAllows.team && <Pill tone="orange">{p.team}</Pill>}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setEditingId(expanded ? null : p.id)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}>✏️</button>
                            <button onClick={() => deletePlayer(p.id)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}>🗑</button>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
                          <div style={{ borderRadius: 16, background: "#f8fafc", padding: 12 }}>
                            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>적용점수</div>
                            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900 }}>{p.liveScore}</div>
                          </div>
                          <div style={{ borderRadius: 16, background: "#f8fafc", padding: 12 }}>
                            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>목표경기</div>
                            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900 }}>{p.maxGames}회</div>
                          </div>
                        </div>
                        {expanded && (
                          <div style={{ marginTop: 14, display: "grid", gap: 12, borderTop: "1px solid #eef2ff", paddingTop: 14 }}>
                            <div>
                              <label style={styles.label}>커스텀점수</label>
                              <Input type="number" step="0.1" value={p.customScore ?? ""} onChange={(e) => updatePlayerField(p.id, { customScore: e.target.value === "" ? null : Number(e.target.value) })} />
                            </div>
                            <div>
                              <label style={styles.label}>목표경기</label>
                              <Input type="number" min={1} max={MAX_GAMES} value={p.maxGames} onChange={(e) => updatePlayerField(p.id, { maxGames: clampInt(Number(e.target.value || DEFAULT_MAX_GAMES), 1, MAX_GAMES) })} />
                            </div>
                            {modeAllows.team && (
                              <div>
                                <label style={styles.label}>소속팀</label>
                                <Select value={p.team} onChange={(e) => updatePlayerField(p.id, { team: e.target.value })}>
                                  {TEAMS.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </Select>
                              </div>
                            )}
                            {modeAllows.events && (
                              <div>
                                <label style={styles.label}>참가종목</label>
                                {renderEventChecks(p, (key, checked) =>
                                  updatePlayerField(p.id, { events: normalizeEventsByGender(p.gender, { ...p.events, [key]: checked }) }), true
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {activeTab === "schedule" && (
          <div style={{ display: "grid", gap: 18 }}>
            {!schedule.length ? (
              <div style={{ ...styles.sectionCard, padding: "34px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>🐵</div>
                <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: "#334155" }}>생성된 대진표가 없습니다.</div>
                <div style={{ marginTop: 8, color: "#64748b" }}>먼저 선수 등록 후 대진표를 생성해 주세요.</div>
                <div style={{ marginTop: 18 }}>
                  <Button variant="secondary" onClick={() => setActiveTab("players")}>선수 관리로 이동</Button>
                </div>
              </div>
            ) : (
              <>
                <SectionCard
                  title="매칭 결과"
                  right={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button onClick={generateSchedule}>🔄 재생성</Button>
                      <Button variant="excel" onClick={downloadExcel}>📊 엑셀 저장</Button>
                      <Button variant="secondary" onClick={downloadScheduleImage}>🖼 이미지 저장</Button>
                    </div>
                  }
                >
                  <div style={{ color: "#475569", fontWeight: 700 }}>
                    BADMONKEYZ {MODES.find((m) => m.value === mode)?.label} / 총 {schedule.length}R
                  </div>
                </SectionCard>

                <div ref={scheduleRef} style={{ display: "grid", gap: 16 }}>
                  {schedule.map((round) => (
                    <div key={round.id} style={{ ...styles.sectionCard, overflow: "hidden" }}>
                      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)", color: "white", padding: "14px 18px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>ROUND {round.id}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ fontSize: 24 }}>🐵🐷🐯🐰</div>
                          <Pill tone="slate">{round.matches.length} matches</Pill>
                        </div>
                      </div>

                      <div style={{ padding: 14, display: "grid", gap: 14, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                        {round.matches.map((match, idx) => {
                          const titleA = mode === "rivalry" ? match.teamA[0].team : "TEAM A";
                          const titleB = mode === "rivalry" ? match.teamB[0].team : "TEAM B";
                          return (
                            <div key={idx} style={{ borderRadius: 24, border: "1px solid #e2e8f0", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", padding: 14, boxShadow: "0 10px 24px rgba(15,23,42,.04)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <Pill tone="indigo">{match.courtId}코트</Pill>
                                <Pill tone="slate">{match.matchLabel}</Pill>
                              </div>
                              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                                <div style={{ borderRadius: 18, border: "1px solid #bfdbfe", background: "#eff6ff", padding: 12 }}>
                                  <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 800 }}>{titleA}</div>
                                  {match.teamA.map((p) => (
                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 14 }}>
                                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                                      <div style={{ color: "#475569" }}>{p.gender}/{p.grade} ({p.score})</div>
                                    </div>
                                  ))}
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bfdbfe", textAlign: "right", fontWeight: 900, color: "#1d4ed8" }}>합계 {match.scoreA.toFixed(1)}</div>
                                </div>

                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                                  <div style={{ fontSize: 24, fontWeight: 950, color: "#94a3b8" }}>VS</div>
                                  <Pill tone={Math.abs(match.diff) < 0.0001 ? "indigo" : "green"}>
                                    {Math.abs(match.diff) < 0.0001 ? "Perfect" : `${match.diff.toFixed(1)}차`}
                                  </Pill>
                                </div>

                                <div style={{ borderRadius: 18, border: "1px solid #fecdd3", background: "#fff1f2", padding: 12 }}>
                                  <div style={{ fontSize: 12, color: "#be123c", fontWeight: 800 }}>{titleB}</div>
                                  {match.teamB.map((p) => (
                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 14 }}>
                                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                                      <div style={{ color: "#475569" }}>{p.gender}/{p.grade} ({p.score})</div>
                                    </div>
                                  ))}
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #fecdd3", textAlign: "right", fontWeight: 900, color: "#be123c" }}>합계 {match.scoreB.toFixed(1)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
