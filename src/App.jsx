import React, { useEffect, useMemo, useState } from "react";
import HomePage from "./components/HomePage";
import PlayerManager from "./components/PlayerManager";
import ScheduleBoard from "./components/ScheduleBoard";
import StandingsBoard from "./components/StandingsBoard";
import { MODES, STORAGE_KEY } from "./constants";

import { buildFriendlySchedule } from "./engines/friendlyEngine";
import { applyTournamentProgression, buildTournamentSchedule } from "./engines/tournamentEngine";
import { buildRivalrySchedule } from "./engines/rivalryEngine";
import { buildLeagueSchedule, buildLeagueStandings } from "./league/leagueEngine";
import { loadAppState, saveAppState } from "./utils/appStorage";
import {
  buildFriendlyManualMatch,
  buildRivalryManualMatch,
  resolveManualPlayersByName,
} from "./utils/manualMatches";
import { asArray, exportScheduleWorkbook } from "./utils/exportScheduleExcel";
import { reflowScheduleByCourt } from "./utils/scheduleRuntime";

const DEFAULT_WINNING_SCORE = 25;
const MAX_MATCH_SCORE_DIFF = 2;
const MALE_SCORE_BY_GRADE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const FEMALE_SCORE_BY_GRADE = { A: 3.8, B: 2.5, C: 1.8, D: 0.9, E: 0.5 };
const TOURNAMENT_TYPE_SORT_ORDER = { "남복": 0, "여복": 1, "혼복": 2 };

function shuffleArray(items) {
  const next = Array.isArray(items) ? [...items] : [];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function getTournamentCategorySortValue(label) {
  const text = String(label || "").trim();
  const type = text.split(" ")[0];
  const typeOrder = TOURNAMENT_TYPE_SORT_ORDER[type] ?? 99;
  const baseName = text.replace(/^(남복|여복|혼복)\s*/, "");
  return { typeOrder, baseName, text };
}

function normalizeManualName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildAssignedCountMap(schedule) {
  const assignedCounts = new Map();

  asArray(schedule).forEach((round) => {
    asArray(round?.matches).forEach((match) => {
      [...asArray(match?.teamA), ...asArray(match?.teamB)].forEach((player, playerIndex) => {
        const playerId = String(getPlayerIdentity(player, playerIndex));
        assignedCounts.set(playerId, (assignedCounts.get(playerId) || 0) + 1);
      });
    });
  });

  return assignedCounts;
}

function countUnderTargetPlayers(players, schedule, targetMatchCount) {
  const safeTarget = Math.max(1, Number(targetMatchCount) || 1);
  const assignedCounts = buildAssignedCountMap(schedule);

  return asArray(players).reduce((count, player, index) => {
    const playerId = String(getPlayerIdentity(player, index));
    const assignedCount = assignedCounts.get(playerId) || 0;
    return count + (assignedCount < safeTarget ? 1 : 0);
  }, 0);
}

function getMaxUsedCourts(schedule) {
  return asArray(schedule).reduce(
    (maxCount, round) => Math.max(maxCount, asArray(round?.matches).length),
    0
  );
}

function buildGenerationWarnings({ modeValue, players, schedule, targetMatchCount, courtCount }) {
  const warnings = [];
  const maxUsedCourts = getMaxUsedCourts(schedule);
  const safeCourtCount = Math.max(1, Number(courtCount) || 1);

  if (maxUsedCourts > 0 && maxUsedCourts < safeCourtCount) {
    warnings.push(`코트는 최대 ${maxUsedCourts}개까지만 활용되었습니다.`);
  }

  if (modeValue === "friendly" || modeValue === "rivalry") {
    const underTargetCount = countUnderTargetPlayers(players, schedule, targetMatchCount);
    if (underTargetCount > 0) {
      warnings.push(`${underTargetCount}명의 선수가 목표 경기 수를 채우지 못했습니다.`);
    }
  }

  return warnings;
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#f8fafc 0%,#eef2ff 55%,#f8fafc 100%)",
    color: "#172554",
    fontFamily:
      "Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  page: {
    width: "100%",
    maxWidth: 1880,
    margin: "0 auto",
    padding: "20px 18px 28px",
    boxSizing: "border-box",
  },

  messageWrap: {
    marginBottom: 14,
  },

  message: {
    padding: "12px 14px",
    borderRadius: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "560px minmax(0, 1fr)",
    gap: 20,
    alignItems: "start",
  },

  leftPane: {
    minWidth: 0,
  },

  rightPane: {
    minWidth: 0,
  },

  scheduleBoard: {
    background: "rgba(255,255,255,0.97)",
    border: "1px solid #dbeafe",
    borderRadius: 28,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(30,41,59,0.08)",
  },

  scheduleHeader: {
    padding: "18px 22px",
    borderBottom: "1px solid #e2e8f0",
    background:
      "linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(14,165,233,0.05) 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  scheduleTitleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  scheduleEyebrow: {
    fontSize: 12,
    fontWeight: 900,
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  scheduleTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  scheduleSub: {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },

  collapseButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#2563eb",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  collapsedBodyNotice: {
    padding: "16px 18px",
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
    borderTop: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  headerStats: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  statCard: {
    minWidth: 108,
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #dbeafe",
    boxShadow: "0 10px 22px rgba(30,41,59,0.05)",
  },

  statLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
  },

  statValue: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.1,
  },

  statInput: {
    width: "100%",
    maxWidth: 120,
    height: 34,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    boxSizing: "border-box",
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
  },

  scheduleActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  actionButton: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #93c5fd",
    background: "#ffffff",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37,99,235,0.08)",
  },

  primaryActionButton: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37,99,235,0.18)",
  },

  excelActionButton: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #16a34a",
    background: "#22c55e",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(34,197,94,0.2)",
  },

  scheduleBody: {
    padding: 18,
  },

  pairRankBoard: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    borderRadius: 18,
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(30,41,59,0.04)",
  },

  pairRankHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pairRankHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  pairRankHeaderButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#2563eb",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  pairRankBody: {
    padding: 12,
    display: "grid",
    gap: 10,
  },

  pairRankTeam: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#ffffff",
  },

  pairRankTeamHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },

  pairRankTeamName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#1d4ed8",
  },

  pairRankLine: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.7,
  },

  pairRankSubhead: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: 900,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  tournamentSectionBlock: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    overflow: "hidden",
    background: "#ffffff",
  },

  tournamentSectionToggle: {
    width: "100%",
    border: "none",
    background: "#eff6ff",
    color: "#0f172a",
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 900,
    textAlign: "left",
  },

  tournamentSectionMeta: {
    fontSize: 11,
    fontWeight: 800,
    color: "#475569",
  },

  tournamentSectionBody: {
    padding: 8,
  },
};

const responsiveCss = `
  @media (max-width: 1280px) {
    .app-layout {
      grid-template-columns: 500px 1fr !important;
    }
  }

  @media (max-width: 1080px) {
    .app-layout {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 820px) {
    .app-round-title {
      font-size: 28px !important;
    }

    .app-match-body {
      grid-template-columns: 1fr !important;
    }

    .app-vs-circle {
      width: 60px !important;
      height: 60px !important;
      margin: 0 auto !important;
      font-size: 18px !important;
    }
  }
`;

function normalizeModeValue(mode) {
  if (!mode) return "";
  if (typeof mode === "string") return mode;
  return mode.value || mode.key || mode.id || "";
}

function normalizeModeLabel(mode) {
  if (!mode) return "";
  if (typeof mode === "string") {
    const found = MODES.find((m) => m.value === mode);
    return found?.label || mode;
  }
  return mode.label || mode.name || mode.title || mode.value || "";
}

function isMatchLike(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;

  return Boolean(
    item.teamA ||
      item.teamB ||
      item.team1 ||
      item.team2 ||
      item.leftTeam ||
      item.rightTeam ||
      item.homeTeam ||
      item.awayTeam ||
      item.matchLabel ||
      item.matchType ||
      item.courtId ||
      item.court ||
      item.courtNumber
  );
}

function isRoundLike(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  return Array.isArray(item.matches);
}

function toNumber(value, fallback = NaN) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function inferAge(player) {
  const direct = Number(player?.age);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const fromAgeGroup = String(player?.ageGroup || "").match(/\d+/);
  if (fromAgeGroup) {
    const parsed = Number(fromAgeGroup[0]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 30;
}

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toLowerCase();
  if (["m", "male", "man", "boy", "남", "남자"].includes(raw)) return "M";
  if (["f", "female", "woman", "girl", "여", "여자"].includes(raw)) return "F";
  return "U";
}

function getBaseScoreByGenderAndGrade(gender, grade) {
  const normalizedGender = normalizeGender(gender);
  const normalizedGrade = String(grade || "").trim().toUpperCase();
  const scoreTable =
    normalizedGender === "F" ? FEMALE_SCORE_BY_GRADE : MALE_SCORE_BY_GRADE;
  return scoreTable[normalizedGrade] ?? 0;
}

function normalizePlayersForLeague(players) {
  return asArray(players).map((player) => ({
    ...player,
    age: inferAge(player),
    gender: normalizeGender(player?.gender),
    baseScore: getBaseScoreByGenderAndGrade(player?.gender, player?.grade),
  }));
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || player.fullName || "";
}

function getPlayerIdentity(player, index = 0) {
  if (!player) return `player-${index}`;
  if (typeof player === "string") return player;
  return player.id || player.__id || player.playerId || getPlayerName(player) || `player-${index}`;
}

function readScoreA(match) {
  const candidates = [
    match?.scoreA,
    match?.teamAScore,
    match?.homeScore,
    match?.score1,
    match?.leftScore,
    match?.scoreAInput,
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readScoreB(match) {
  const candidates = [
    match?.scoreB,
    match?.teamBScore,
    match?.awayScore,
    match?.score2,
    match?.rightScore,
    match?.scoreBInput,
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildTeamPairRankings(schedule, teams) {
  const safeTeams = asArray(teams);
  const registry = new Map();

  safeTeams.forEach((team, teamIndex) => {
    const teamId = team?.id || `team-${teamIndex}`;
    const pairs = asArray(team?.pairs).map((pair, pairIndex) => {
      const pairId = pair?.id || `${teamId}-pair-${pairIndex + 1}`;
      const names = asArray(pair?.players).map(getPlayerName).filter(Boolean).join(", ");
      const item = {
        id: pairId,
        pairIndex: pairIndex,
        names,
        win: 0,
        lose: 0,
        draw: 0,
        point: 0,
        against: 0,
        diff: 0,
      };
      registry.set(pairId, item);
      return item;
    });

    registry.set(`__team__${teamId}`, {
      id: teamId,
      name: team?.name || `팀 ${teamIndex + 1}`,
      ageBand: team?.ageBand || "",
      pairs,
    });
  });

  asArray(schedule).forEach((round) => {
    asArray(round?.matches).forEach((match) => {
      const pairA = registry.get(match?.team1?.id);
      const pairB = registry.get(match?.team2?.id);
      if (!pairA || !pairB) return;

      const scoreA = readScoreA(match);
      const scoreB = readScoreB(match);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
      if (scoreA === scoreB) return;

      pairA.point += scoreA;
      pairA.against += scoreB;
      pairA.diff = pairA.point - pairA.against;
      pairB.point += scoreB;
      pairB.against += scoreA;
      pairB.diff = pairB.point - pairB.against;

      if (scoreA > scoreB) {
        pairA.win += 1;
        pairB.lose += 1;
      } else {
        pairB.win += 1;
        pairA.lose += 1;
      }
    });
  });

  return safeTeams.map((team, teamIndex) => {
    const teamId = team?.id || `team-${teamIndex}`;
    const base = registry.get(`__team__${teamId}`) || {
      id: teamId,
      name: team?.name || `팀 ${teamIndex + 1}`,
      ageBand: team?.ageBand || "",
      pairs: [],
    };

    const rankedPairs = [...base.pairs].sort((a, b) => {
      if (b.win !== a.win) return b.win - a.win;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.point !== a.point) return b.point - a.point;
      return a.pairIndex - b.pairIndex;
    });

    return {
      ...base,
      rankedPairs,
    };
  });
}

function resolveLeagueMatchTeamKey(match, orderedTeams = []) {
  const directId = String(match?.teamId || match?.homeTeamId || match?.awayTeamId || "").trim();
  if (directId) return directId;

  const directName = String(match?.teamName || match?.homeTeamName || match?.awayTeamName || "").trim();
  if (!directName) return "";

  const foundTeam = orderedTeams.find((team) => String(team?.name || "").trim() === directName);
  return String(foundTeam?.id || directName).trim();
}

function arrangeLeagueScheduleByTeamCourt(schedule, teams, randomize = false) {
  const orderedTeams = asArray(teams).map((team, index) => ({
    ...team,
    id: team?.id || `team-${index + 1}`,
  }));
  if (orderedTeams.length === 0) return asArray(schedule);

  const teamMatches = new Map(
    orderedTeams.map((team, index) => [String(team?.id || `team-${index + 1}`), []])
  );
  const flatMatches = asArray(schedule).flatMap((round) =>
    asArray(round?.matches).map((match) => ({ ...match }))
  );

  flatMatches.forEach((match) => {
    const teamKey = resolveLeagueMatchTeamKey(match, orderedTeams);
    if (!teamMatches.has(teamKey)) {
      teamMatches.set(teamKey, []);
    }
    teamMatches.get(teamKey).push(match);
  });

  orderedTeams.forEach((team, teamIndex) => {
    const teamKey = String(team?.id || `team-${teamIndex + 1}`);
    const matches = teamMatches.get(teamKey) || [];
    teamMatches.set(teamKey, randomize ? shuffleArray(matches) : matches);
  });

  const maxRounds = orderedTeams.reduce((maxValue, team, teamIndex) => {
    const teamKey = String(team?.id || `team-${teamIndex + 1}`);
    return Math.max(maxValue, (teamMatches.get(teamKey) || []).length);
  }, 0);

  const rounds = [];
  for (let roundIndex = 0; roundIndex < maxRounds; roundIndex += 1) {
    const matches = orderedTeams.flatMap((team, teamIndex) => {
      const teamKey = String(team?.id || `team-${teamIndex + 1}`);
      const match = (teamMatches.get(teamKey) || [])[roundIndex];
      if (!match) return [];

      const courtNo = teamIndex + 1;
      return [
        {
          ...match,
          round: roundIndex + 1,
          court: courtNo,
          courtLabel: `코트 ${courtNo}`,
        },
      ];
    });

    if (matches.length === 0) continue;

    rounds.push({
      id: `round-${roundIndex + 1}`,
      label: `ROUND ${roundIndex + 1}`,
      round: roundIndex + 1,
      matches,
    });
  }

  return rounds;
}

function detectPairType(pair) {
  const members = asArray(pair?.players);
  const genders = members
    .map((player) => String(player?.gender || "").trim().toUpperCase())
    .filter(Boolean);
  if (genders.length >= 2) {
    const unique = new Set(genders);
    if (unique.size === 1 && unique.has("M")) return "남복";
    if (unique.size === 1 && unique.has("F")) return "여복";
    if (unique.has("M") && unique.has("F")) return "혼복";
  }
  return String(pair?.pairType || "").trim() || "일반복식";
}

function getPairMatchScore(pair) {
  return asArray(pair?.players).reduce(
    (sum, player) => sum + getBaseScoreByGenderAndGrade(player?.gender, player?.grade),
    0
  );
}

function canFormPairType(playerA, playerB, pairType) {
  if (!pairType) return true;
  return detectPairType({ players: [playerA, playerB] }) === pairType;
}

function createAutoPair(team, players, pairIndex) {
  const pairType = detectPairType({ players });
  const pairKey = players.map((player) => getPlayerName(player)).filter(Boolean).join("-");
  return {
    id: `${team?.id || "team"}-auto-fallback-${pairKey || pairIndex + 1}`,
    players,
    pairType,
    pairIndex: pairIndex + 1,
    isFallback: true,
  };
}

function getPairTypeMaxDiff(pairType) {
  if (pairType === "남복") return 3;
  if (pairType === "여복") return 2;
  if (pairType === "혼복") return 1.5;
  return MAX_MATCH_SCORE_DIFF;
}

function isPairDiffAllowed(pairType, diff) {
  const limit = getPairTypeMaxDiff(pairType);
  if (pairType === "남복" || pairType === "여복") {
    return diff < limit;
  }
  return diff <= limit;
}

function dedupePlayers(players) {
  const byId = new Map();
  asArray(players).forEach((player, index) => {
    const key = getPlayerIdentity(player, index);
    if (!byId.has(key)) byId.set(key, player);
  });
  return Array.from(byId.values());
}

function getPlayerBaseScore(player) {
  return getBaseScoreByGenderAndGrade(player?.gender, player?.grade);
}

function pullBalancedPairByType(poolPlayers, pairType) {
  const eligiblePlayers = poolPlayers.filter((player) =>
    pairType === "남복"
      ? normalizeGender(player?.gender) === "M"
      : pairType === "여복"
        ? normalizeGender(player?.gender) === "F"
        : ["M", "F"].includes(normalizeGender(player?.gender))
  );
  if (eligiblePlayers.length < 2) return null;

  const pairTargetScore =
    eligiblePlayers.reduce((sum, player) => sum + getPlayerBaseScore(player), 0) /
    Math.max(1, Math.floor(eligiblePlayers.length / 2));
  const eligibleIndices = poolPlayers
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => eligiblePlayers.includes(player))
    .sort((a, b) => getPlayerBaseScore(b.player) - getPlayerBaseScore(a.player));

  for (const anchorEntry of eligibleIndices) {
    const anchor = anchorEntry.player;
    let best = null;

    for (let j = 0; j < poolPlayers.length; j += 1) {
      if (j === anchorEntry.index) continue;

      const partner = poolPlayers[j];
      if (!canFormPairType(anchor, partner, pairType)) continue;

      const diff = Math.abs(getPlayerBaseScore(anchor) - getPlayerBaseScore(partner));
      if (!isPairDiffAllowed(pairType, diff)) continue;

      const pairScore = getPlayerBaseScore(anchor) + getPlayerBaseScore(partner);
      const targetGap = Math.abs(pairScore - pairTargetScore);
      const sameAgeBand =
        String(anchor?.ageGroup || "").trim() === String(partner?.ageGroup || "").trim();
      const sameGrade =
        String(anchor?.grade || "").trim().toUpperCase() ===
        String(partner?.grade || "").trim().toUpperCase();
      const ageDistance = Math.abs(inferAge(anchor) - inferAge(partner));

      const candidate = {
        indices: [anchorEntry.index, j],
        players: [anchor, partner],
        targetGap,
        sameAgeBand,
        sameGrade,
        ageDistance,
        diff,
      };

      if (
        !best ||
        candidate.targetGap < best.targetGap ||
        (candidate.targetGap === best.targetGap &&
          Number(candidate.sameAgeBand) > Number(best.sameAgeBand)) ||
        (candidate.targetGap === best.targetGap &&
          candidate.sameAgeBand === best.sameAgeBand &&
          Number(candidate.sameGrade) > Number(best.sameGrade)) ||
        (candidate.targetGap === best.targetGap &&
          candidate.sameAgeBand === best.sameAgeBand &&
          candidate.sameGrade === best.sameGrade &&
          candidate.ageDistance < best.ageDistance) ||
        (candidate.targetGap === best.targetGap &&
          candidate.sameAgeBand === best.sameAgeBand &&
          candidate.sameGrade === best.sameGrade &&
          candidate.ageDistance === best.ageDistance &&
          candidate.diff < best.diff)
      ) {
        best = candidate;
      }
    }

    if (best) {
      const [firstIndex, secondIndex] = [...best.indices].sort((a, b) => b - a);
      poolPlayers.splice(firstIndex, 1);
      poolPlayers.splice(secondIndex, 1);
      return best.players;
    }
  }

  return null;
}

function buildAutoPairsByPriority(players, team) {
  const reservePool = [...dedupePlayers(players)];
  const createdPairs = [];
  const forcedPairType = String(team?.preferredPairType || "").trim();
  const pairPriority = forcedPairType ? [forcedPairType] : ["남복", "여복", "혼복"];

  pairPriority.forEach((pairType) => {
    let nextPlayers = pullBalancedPairByType(reservePool, pairType);
    while (nextPlayers) {
      createdPairs.push(createAutoPair(team, nextPlayers, createdPairs.length));
      nextPlayers = pullBalancedPairByType(reservePool, pairType);
    }
  });

  return { createdPairs, leftovers: reservePool };
}

function getGenderCounts(players) {
  return dedupePlayers(players).reduce(
    (counts, player) => {
      const gender = normalizeGender(player?.gender);
      if (gender === "M") counts.male += 1;
      if (gender === "F") counts.female += 1;
      return counts;
    },
    { male: 0, female: 0 }
  );
}

function buildLeaguePairsWithMinorityMixedRule(players) {
  const normalizedPlayers = dedupePlayers(players);
  const { male, female } = getGenderCounts(normalizedPlayers);
  const minorityCount = Math.min(male, female);

  if (minorityCount === 0 || minorityCount > 6) {
    return buildAutoPairsByPriority(normalizedPlayers, {});
  }

  const mixedFirst = buildAutoPairsByPriority(normalizedPlayers, { preferredPairType: "혼복" });
  const mixedPlayers = mixedFirst.createdPairs.flatMap((pair) => asArray(pair?.players));
  const usedIds = new Set(mixedPlayers.map((player, index) => getPlayerIdentity(player, index)));
  const remainingPlayers = normalizedPlayers.filter(
    (player, index) => !usedIds.has(getPlayerIdentity(player, index))
  );
  const remainingPairs = buildAutoPairsByPriority(remainingPlayers, {});

  return {
    createdPairs: [...mixedFirst.createdPairs, ...remainingPairs.createdPairs].map((pair, pairIndex) => ({
      ...pair,
      pairIndex: pairIndex + 1,
    })),
    leftovers: remainingPairs.leftovers,
  };
}

function getDominantAgeBand(players) {
  const counts = new Map();
  dedupePlayers(players).forEach((player) => {
    const ageBand =
      String(player?.ageGroup || "").trim() ||
      `${Math.max(10, Math.floor(inferAge(player) / 10) * 10)}대`;
    counts.set(ageBand, (counts.get(ageBand) || 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "30대";
}

function sortPairsForTeaming(pairs) {
  return [...asArray(pairs)].sort((a, b) => {
    const aPlayers = dedupePlayers(asArray(a?.players));
    const bPlayers = dedupePlayers(asArray(b?.players));
    const aAgeBand = getDominantAgeBand(aPlayers);
    const bAgeBand = getDominantAgeBand(bPlayers);
    if (aAgeBand !== bAgeBand) return aAgeBand.localeCompare(bAgeBand, "ko");

    const aGrades = aPlayers.map((player) => String(player?.grade || "")).sort().join("");
    const bGrades = bPlayers.map((player) => String(player?.grade || "")).sort().join("");
    if (aGrades !== bGrades) return aGrades.localeCompare(bGrades, "ko");

    return getPairMatchScore(a) - getPairMatchScore(b);
  });
}

function splitPairsIntoBuckets(pairs, bucketCount) {
  const orderedPairs = sortPairsForTeaming(pairs);
  const safeBucketCount = Math.max(1, Math.min(bucketCount, orderedPairs.length));
  const buckets = Array.from({ length: safeBucketCount }, () => []);
  const baseSize = Math.floor(orderedPairs.length / safeBucketCount);
  const remainder = orderedPairs.length % safeBucketCount;

  let cursor = 0;
  for (let index = 0; index < safeBucketCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    buckets[index] = orderedPairs.slice(cursor, cursor + size);
    cursor += size;
  }

  return buckets.filter((bucket) => bucket.length > 0);
}

function buildTeamName(teamIndex) {
  const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${code[teamIndex] || `팀${teamIndex + 1}`}팀`;
}

function getBucketSizesFromCount(count, slotCount) {
  if (!slotCount || count <= 0) return [];
  const baseSize = Math.floor(count / slotCount);
  const remainder = count % slotCount;
  return Array.from({ length: slotCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function countMatchesFromPairSize(pairCount) {
  if (pairCount < 2) return 0;
  return (pairCount * (pairCount - 1)) / 2;
}

function getBucketScoreSpread(bucket) {
  const scores = asArray(bucket).map(getPairMatchScore);
  if (scores.length <= 1) return 0;
  return Math.max(...scores) - Math.min(...scores);
}

function buildCappedBuckets(pairs, bucketCount, maxSpread = 2) {
  const orderedPairs = sortPairsForTeaming(pairs);
  const safeBucketCount = Math.max(1, Math.min(bucketCount, orderedPairs.length));
  const targetSize = Math.ceil(orderedPairs.length / safeBucketCount);
  const buckets = Array.from({ length: safeBucketCount }, () => []);
  const overflow = [];

  orderedPairs.forEach((pair) => {
    const candidates = buckets
      .map((bucket, index) => {
        const nextBucket = [...bucket, pair];
        const spread = getBucketScoreSpread(nextBucket);
        if (spread > maxSpread) return null;

        return {
          index,
          isEmpty: bucket.length === 0,
          size: bucket.length,
          overTarget: bucket.length >= targetSize,
          spread,
        };
      })
      .filter(Boolean);

    if (candidates.length === 0) {
      overflow.push(pair);
      return;
    }

    candidates.sort((a, b) => {
      // Prefer opening a new bucket first so requested court/team counts can actually be used.
      if (Number(a.isEmpty) !== Number(b.isEmpty)) return Number(b.isEmpty) - Number(a.isEmpty);
      if (Number(a.overTarget) !== Number(b.overTarget)) return Number(a.overTarget) - Number(b.overTarget);
      if (a.size !== b.size) return a.size - b.size;
      if (a.spread !== b.spread) return a.spread - b.spread;
      return a.index - b.index;
    });

    buckets[candidates[0].index].push(pair);
  });

  return {
    buckets: buckets.filter((bucket) => bucket.length > 0),
    overflow,
  };
}

function getBucketMetrics(pairPools, allocation) {
  const pairTypes = ["남복", "여복", "혼복"];
  const pairSizes = [];
  const matchSizes = [];
  let overflowCount = 0;
  let maxScoreSpread = 0;

  pairTypes.forEach((pairType) => {
    const { buckets, overflow } = buildCappedBuckets(asArray(pairPools[pairType]), allocation[pairType], 2);
    overflowCount += overflow.length;
    buckets.forEach((bucket) => {
      pairSizes.push(bucket.length);
      matchSizes.push(countMatchesFromPairSize(bucket.length));
      maxScoreSpread = Math.max(maxScoreSpread, getBucketScoreSpread(bucket));
    });
  });

  if (pairSizes.length === 0) {
    return {
      overflowCount: Number.POSITIVE_INFINITY,
      maxScoreSpread: Number.POSITIVE_INFINITY,
      maxPairSize: Number.POSITIVE_INFINITY,
      matchSpread: Number.POSITIVE_INFINITY,
      pairSpread: Number.POSITIVE_INFINITY,
      variance: Number.POSITIVE_INFINITY,
    };
  }

  const avgPairs = pairSizes.reduce((sum, value) => sum + value, 0) / pairSizes.length;
  const variance = pairSizes.reduce((sum, value) => sum + (value - avgPairs) ** 2, 0);

  return {
    overflowCount,
    maxScoreSpread,
    maxPairSize: Math.max(...pairSizes),
    matchSpread: Math.max(...matchSizes) - Math.min(...matchSizes),
    pairSpread: Math.max(...pairSizes) - Math.min(...pairSizes),
    variance,
  };
}

function getMixedPairOptionScore(players) {
  const [playerA, playerB] = players;
  const diff = Math.abs(
    getBaseScoreByGenderAndGrade(playerA?.gender, playerA?.grade) -
      getBaseScoreByGenderAndGrade(playerB?.gender, playerB?.grade)
  );
  if (!isPairDiffAllowed("혼복", diff)) return null;

  const sameAgeBand = String(playerA?.ageGroup || "").trim() === String(playerB?.ageGroup || "").trim();
  const sameGrade =
    String(playerA?.grade || "").trim().toUpperCase() ===
    String(playerB?.grade || "").trim().toUpperCase();
  const ageDistance = Math.abs(inferAge(playerA) - inferAge(playerB));

  return { diff, sameAgeBand, sameGrade, ageDistance };
}

function buildMixedPairsFromMaleFemalePair(malePair, femalePair) {
  const malePlayers = dedupePlayers(asArray(malePair?.players));
  const femalePlayers = dedupePlayers(asArray(femalePair?.players));
  if (malePlayers.length < 2 || femalePlayers.length < 2) return null;

  const options = [
    [
      [malePlayers[0], femalePlayers[0]],
      [malePlayers[1], femalePlayers[1]],
    ],
    [
      [malePlayers[0], femalePlayers[1]],
      [malePlayers[1], femalePlayers[0]],
    ],
  ];

  let best = null;

  options.forEach((optionPairs, optionIndex) => {
    const scores = optionPairs.map(getMixedPairOptionScore);
    if (scores.some((score) => !score)) return;

    const candidate = {
      optionIndex,
      pairs: optionPairs,
      scores,
      totalDiff: scores.reduce((sum, score) => sum + score.diff, 0),
      sameAgeBandCount: scores.reduce((sum, score) => sum + Number(score.sameAgeBand), 0),
      sameGradeCount: scores.reduce((sum, score) => sum + Number(score.sameGrade), 0),
      totalAgeDistance: scores.reduce((sum, score) => sum + score.ageDistance, 0),
    };

    if (
      !best ||
      candidate.sameAgeBandCount > best.sameAgeBandCount ||
      (candidate.sameAgeBandCount === best.sameAgeBandCount &&
        candidate.sameGradeCount > best.sameGradeCount) ||
      (candidate.sameAgeBandCount === best.sameAgeBandCount &&
        candidate.sameGradeCount === best.sameGradeCount &&
        candidate.totalAgeDistance < best.totalAgeDistance) ||
      (candidate.sameAgeBandCount === best.sameAgeBandCount &&
        candidate.sameGradeCount === best.sameGradeCount &&
        candidate.totalAgeDistance === best.totalAgeDistance &&
        candidate.totalDiff < best.totalDiff)
    ) {
      best = candidate;
    }
  });

  if (!best) return null;

  return best.pairs.map((players, pairIndex) => ({
    id: `mixed-rebalance-${malePair?.id || "m"}-${femalePair?.id || "f"}-${best.optionIndex}-${pairIndex + 1}`,
    players,
    pairType: "혼복",
    isRebalancedMixed: true,
  }));
}

function isAllocationBetter(candidatePools, candidateAllocation, currentPools, currentAllocation) {
  const candidateMetrics = getBucketMetrics(candidatePools, candidateAllocation);
  const currentMetrics = getBucketMetrics(currentPools, currentAllocation);

  if (candidateMetrics.overflowCount !== currentMetrics.overflowCount) {
    return candidateMetrics.overflowCount < currentMetrics.overflowCount;
  }
  if (candidateMetrics.maxScoreSpread !== currentMetrics.maxScoreSpread) {
    return candidateMetrics.maxScoreSpread < currentMetrics.maxScoreSpread;
  }
  if (candidateMetrics.maxPairSize !== currentMetrics.maxPairSize) {
    return candidateMetrics.maxPairSize < currentMetrics.maxPairSize;
  }
  if (candidateMetrics.matchSpread !== currentMetrics.matchSpread) {
    return candidateMetrics.matchSpread < currentMetrics.matchSpread;
  }
  if (candidateMetrics.pairSpread !== currentMetrics.pairSpread) {
    return candidateMetrics.pairSpread < currentMetrics.pairSpread;
  }
  if (candidateMetrics.variance !== currentMetrics.variance) {
    return candidateMetrics.variance < currentMetrics.variance;
  }
  return (candidateAllocation?.total || 0) >= (currentAllocation?.total || 0);
}

function rebalancePairPoolsWithMixedTeams(pairPools, requestedTeamCount) {
  let currentPools = {
    남복: [...asArray(pairPools?.남복)],
    여복: [...asArray(pairPools?.여복)],
    혼복: [...asArray(pairPools?.혼복)],
  };

  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const currentAllocation = allocateTeamSlotsByPairType(currentPools, requestedTeamCount);
    let bestCandidate = null;

    asArray(currentPools.남복).forEach((malePair, maleIndex) => {
      asArray(currentPools.여복).forEach((femalePair, femaleIndex) => {
        const mixedPairs = buildMixedPairsFromMaleFemalePair(malePair, femalePair);
        if (!mixedPairs) return;

        const candidatePools = {
          남복: asArray(currentPools.남복).filter((_, index) => index !== maleIndex),
          여복: asArray(currentPools.여복).filter((_, index) => index !== femaleIndex),
          혼복: [...asArray(currentPools.혼복), ...mixedPairs],
        };
        const candidateAllocation = allocateTeamSlotsByPairType(candidatePools, requestedTeamCount);

        if (!isAllocationBetter(candidatePools, candidateAllocation, currentPools, currentAllocation)) {
          return;
        }

        if (
          !bestCandidate ||
          isAllocationBetter(
            candidatePools,
            candidateAllocation,
            bestCandidate.pools,
            bestCandidate.allocation
          )
        ) {
          bestCandidate = {
            pools: candidatePools,
            allocation: candidateAllocation,
          };
        }
      });
    });

    if (!bestCandidate) break;
    currentPools = bestCandidate.pools;
  }

  return currentPools;
}

function allocateTeamSlotsByPairType(pairPools, requestedTeamCount) {
  const pairTypes = ["남복", "여복", "혼복"];
  const requested = Math.max(1, Number(requestedTeamCount) || 1);
  const counts = Object.fromEntries(pairTypes.map((pairType) => [pairType, asArray(pairPools[pairType]).length]));
  const viableTypes = pairTypes.filter((pairType) => counts[pairType] >= 2);
  const activeTypes = viableTypes.length > 0 ? viableTypes : pairTypes.filter((pairType) => counts[pairType] > 0);
  if (activeTypes.length === 0) return { 남복: 0, 여복: 0, 혼복: 0, total: 0 };

  const maxSlotsByType = Object.fromEntries(
    pairTypes.map((pairType) => {
      if (counts[pairType] <= 0) return [pairType, 0];
      if (counts[pairType] < 2) return [pairType, viableTypes.length > 0 ? 0 : 1];
      return [pairType, Math.floor(counts[pairType] / 2)];
    })
  );
  const mandatoryTypes =
    viableTypes.filter((pairType) => pairType !== "혼복") ||
    [];
  const effectiveMandatoryTypes =
    mandatoryTypes.length > 0 ? mandatoryTypes : activeTypes.filter((pairType) => maxSlotsByType[pairType] > 0);
  const minTeamCount = Math.max(1, effectiveMandatoryTypes.length);
  const maxTeamCount = Math.max(
    minTeamCount,
    Math.min(requested, activeTypes.reduce((sum, pairType) => sum + maxSlotsByType[pairType], 0))
  );
  const candidateMinTeamCount =
    requested > 1
      ? Math.max(minTeamCount, Math.min(maxTeamCount, requested - 1))
      : minTeamCount;
  const candidateMaxTeamCount = Math.max(candidateMinTeamCount, maxTeamCount);

  const buildSlotsForTotal = (targetTeamCount) => {
    const slots = { 남복: 0, 여복: 0, 혼복: 0 };

    effectiveMandatoryTypes.forEach((pairType) => {
      if (slots[pairType] < maxSlotsByType[pairType]) {
        slots[pairType] = 1;
      }
    });

    while (Object.values(slots).reduce((sum, value) => sum + value, 0) < targetTeamCount) {
      let bestType = "";
      let bestMetrics = null;

      activeTypes.forEach((pairType) => {
        if (slots[pairType] >= maxSlotsByType[pairType]) return;
        const candidateSlots = { ...slots, [pairType]: slots[pairType] + 1 };
        const metrics = getBucketMetrics(pairPools, candidateSlots);

        if (
          !bestMetrics ||
          metrics.overflowCount < bestMetrics.overflowCount ||
          (metrics.overflowCount === bestMetrics.overflowCount &&
            metrics.maxScoreSpread < bestMetrics.maxScoreSpread) ||
          (metrics.overflowCount === bestMetrics.overflowCount &&
            metrics.maxScoreSpread === bestMetrics.maxScoreSpread &&
            metrics.matchSpread < bestMetrics.matchSpread) ||
          (metrics.overflowCount === bestMetrics.overflowCount &&
            metrics.maxScoreSpread === bestMetrics.maxScoreSpread &&
            metrics.matchSpread === bestMetrics.matchSpread &&
            metrics.pairSpread < bestMetrics.pairSpread) ||
          (metrics.overflowCount === bestMetrics.overflowCount &&
            metrics.maxScoreSpread === bestMetrics.maxScoreSpread &&
            metrics.matchSpread === bestMetrics.matchSpread &&
            metrics.pairSpread === bestMetrics.pairSpread &&
            metrics.variance < bestMetrics.variance)
        ) {
          bestType = pairType;
          bestMetrics = metrics;
        }
      });

      if (!bestType) break;
      slots[bestType] += 1;
    }

    return slots;
  };

  let bestAllocation = null;

  for (let teamCount = candidateMinTeamCount; teamCount <= candidateMaxTeamCount; teamCount += 1) {
    const slots = buildSlotsForTotal(teamCount);
    const total = Object.values(slots).reduce((sum, value) => sum + value, 0);
    if (total === 0) continue;

    const metrics = getBucketMetrics(pairPools, slots);
    const candidate = { ...slots, total, ...metrics };

    if (
      !bestAllocation ||
      candidate.overflowCount < bestAllocation.overflowCount ||
      (candidate.overflowCount === bestAllocation.overflowCount &&
        candidate.maxScoreSpread < bestAllocation.maxScoreSpread) ||
      (candidate.overflowCount === bestAllocation.overflowCount &&
        candidate.maxScoreSpread === bestAllocation.maxScoreSpread &&
        candidate.matchSpread < bestAllocation.matchSpread) ||
      (candidate.overflowCount === bestAllocation.overflowCount &&
        candidate.maxScoreSpread === bestAllocation.maxScoreSpread &&
        candidate.matchSpread === bestAllocation.matchSpread &&
        candidate.pairSpread < bestAllocation.pairSpread) ||
      (candidate.overflowCount === bestAllocation.overflowCount &&
        candidate.maxScoreSpread === bestAllocation.maxScoreSpread &&
        candidate.matchSpread === bestAllocation.matchSpread &&
        candidate.pairSpread === bestAllocation.pairSpread &&
        candidate.variance < bestAllocation.variance) ||
      (candidate.overflowCount === bestAllocation.overflowCount &&
        candidate.maxScoreSpread === bestAllocation.maxScoreSpread &&
        candidate.matchSpread === bestAllocation.matchSpread &&
        candidate.pairSpread === bestAllocation.pairSpread &&
        candidate.variance === bestAllocation.variance &&
        candidate.total > bestAllocation.total)
    ) {
      bestAllocation = candidate;
    }
  }

  return bestAllocation || { 남복: 0, 여복: 0, 혼복: 0, total: 0 };
}

function attachLeftoversToTeams(teams, leftovers) {
  const nextTeams = asArray(teams).map((team) => ({
    ...team,
    leftovers: [...asArray(team?.leftovers)],
  }));

  if (nextTeams.length === 0) return nextTeams;

  dedupePlayers(leftovers).forEach((player) => {
    const playerAgeBand =
      String(player?.ageGroup || "").trim() ||
      `${Math.max(10, Math.floor(inferAge(player) / 10) * 10)}대`;
    let targetIndex = nextTeams.findIndex((team) => team?.ageBand === playerAgeBand);
    if (targetIndex < 0) {
      targetIndex = nextTeams.reduce((bestIndex, team, index) => {
        const bestSize = asArray(nextTeams[bestIndex]?.leftovers).length;
        const currentSize = asArray(team?.leftovers).length;
        return currentSize < bestSize ? index : bestIndex;
      }, 0);
    }
    nextTeams[targetIndex].leftovers = [...asArray(nextTeams[targetIndex].leftovers), player];
  });

  return nextTeams;
}

function buildLeagueInfoFromPlayers(players, requestedTeamCount, targetMatchCount, winningScore) {
  const normalizedPlayers = dedupePlayers(normalizePlayersForLeague(players));
  const initialPairBuild = buildLeaguePairsWithMinorityMixedRule(normalizedPlayers);
  const initialPairPools = {
    남복: initialPairBuild.createdPairs.filter((pair) => detectPairType(pair) === "남복"),
    여복: initialPairBuild.createdPairs.filter((pair) => detectPairType(pair) === "여복"),
    혼복: initialPairBuild.createdPairs.filter((pair) => detectPairType(pair) === "혼복"),
  };
  const pairPools = rebalancePairPoolsWithMixedTeams(initialPairPools, requestedTeamCount);
  const teamSlots = allocateTeamSlotsByPairType(pairPools, requestedTeamCount);
  const pairTypes = ["남복", "여복", "혼복"];
  const builtTeams = [];
  const assignedPairIds = new Set();
  const overflowPairs = [];

  pairTypes.forEach((pairType) => {
    const slotCount = teamSlots[pairType];
    if (!slotCount) return;

    const { buckets, overflow } = buildCappedBuckets(pairPools[pairType], slotCount, 2);
    buckets.forEach((bucket) => {
      bucket.forEach((pair) => assignedPairIds.add(pair?.id));
      const teamPlayers = dedupePlayers(bucket.flatMap((pair) => asArray(pair?.players)));
      builtTeams.push({
        id: `team-${builtTeams.length + 1}`,
        name: buildTeamName(builtTeams.length),
        ageBand: getDominantAgeBand(teamPlayers),
        preferredPairType: pairType,
        targetMatchCount: Math.max(1, Number(targetMatchCount) || 1),
        players: teamPlayers,
        pairs: bucket.map((pair, pairIndex) => ({
          ...pair,
          pairIndex: pairIndex + 1,
        })),
        leftovers: [],
      });
    });
    overflowPairs.push(...overflow);
  });

  const unassignedPairPlayers = pairTypes.flatMap((pairType) =>
    asArray(pairPools[pairType])
      .filter((pair) => !assignedPairIds.has(pair?.id))
      .flatMap((pair) => asArray(pair?.players))
  );
  const teamsWithLeftovers = attachLeftoversToTeams(
    builtTeams,
    [...initialPairBuild.leftovers, ...unassignedPairPlayers, ...overflowPairs.flatMap((pair) => asArray(pair?.players))]
  );
  const effectiveTeamCount = Math.max(1, teamsWithLeftovers.length);

  if (teamsWithLeftovers.length === 0) {
    return {
      teams: [
        {
          id: "team-1",
          name: "A팀",
          ageBand: getDominantAgeBand(normalizedPlayers),
          preferredPairType: "",
          targetMatchCount: Math.max(1, Number(targetMatchCount) || 1),
          players: [],
          pairs: [],
          leftovers: normalizedPlayers,
        },
      ],
      teamCount: 1,
      summary: `정기전 승리 기준 ${winningScore}점 · 팀 수 1개`,
    };
  }

  return {
    teams: teamsWithLeftovers.map((team, teamIndex) => ({
      ...team,
      id: team?.id || `team-${teamIndex + 1}`,
      name: team?.name || buildTeamName(teamIndex),
    })),
    teamCount: effectiveTeamCount,
    summary: `정기전 승리 기준 ${winningScore}점 · 팀 수 ${effectiveTeamCount}개`,
  };
}

function getTeamGenderPriority(team) {
  const players = asArray(team?.players);
  let maleCount = 0;
  let femaleCount = 0;

  players.forEach((player) => {
    const gender = normalizeGender(player?.gender);
    if (gender === "M") maleCount += 1;
    if (gender === "F") femaleCount += 1;
  });

  if (maleCount > femaleCount) return ["남복", "여복", "혼복"];
  if (femaleCount > maleCount) return ["여복", "남복", "혼복"];
  return ["남복", "여복", "혼복"];
}

function sanitizeLeagueTeamsByMatchDiff(teams, maxDiff = MAX_MATCH_SCORE_DIFF) {
  return asArray(teams).map((team, teamIndex) => {
    const sourcePairs = asArray(team?.pairs)
      .filter((pair) => asArray(pair?.players).length >= 2)
      .map((pair, pairIndex) => ({
        ...pair,
        pairIndex: pairIndex + 1,
        matchScore: getPairMatchScore(pair),
        resolvedPairType: detectPairType(pair),
      }));

    const manualPairs = sourcePairs.filter(
      (pair) => pair?.isManual || String(pair?.id || "").includes("-manual-pair-")
    );
    const manualPlayerIds = new Set(
      manualPairs.flatMap((pair) =>
        asArray(pair?.players).map((player, index) => getPlayerIdentity(player, index))
      )
    );

    const teamPool = dedupePlayers([...asArray(team?.players), ...asArray(team?.leftovers)]);
    const autoPlayerPool = teamPool.filter(
      (player, index) => !manualPlayerIds.has(getPlayerIdentity(player, index))
    );
    const autoPairBuildResult = buildAutoPairsByPriority(autoPlayerPool, team);
    const autoPairs = autoPairBuildResult.createdPairs.map((pair, pairIndex) => ({
      ...pair,
      pairIndex: pairIndex + 1,
      matchScore: getPairMatchScore(pair),
      resolvedPairType: detectPairType(pair),
    }));

    const nextPlayerMap = new Map();
    [...manualPairs, ...autoPairs]
      .flatMap((pair) => asArray(pair?.players))
      .forEach((player, index) => {
        const key = getPlayerIdentity(player, index);
        if (!nextPlayerMap.has(key)) nextPlayerMap.set(key, player);
      });

    const preferredPairType =
      autoPairs[0]?.resolvedPairType || manualPairs[0]?.resolvedPairType || "";

    return {
      ...team,
      preferredPairType,
      players: Array.from(nextPlayerMap.values()),
      pairs: [...manualPairs, ...autoPairs].map((pair, pairIndex) => ({
        ...pair,
        pairIndex: pairIndex + 1,
      })),
      leftovers: autoPairBuildResult.leftovers,
    };
  });
}

function sanitizeLeagueInfoByMatchDiff(leagueInfo, maxDiff = MAX_MATCH_SCORE_DIFF) {
  if (!leagueInfo) return leagueInfo;
  return {
    ...leagueInfo,
    teams: sanitizeLeagueTeamsByMatchDiff(leagueInfo?.teams, maxDiff),
  };
}

function normalizeExistingLeagueInfoForSchedule(leagueInfo) {
  if (!leagueInfo) return leagueInfo;

  const teams = asArray(leagueInfo?.teams)
    .map((team, teamIndex) => {
      const pairs = asArray(team?.pairs)
        .filter((pair) => asArray(pair?.players).length >= 2)
        .map((pair, pairIndex) => ({
          ...pair,
          pairIndex: pairIndex + 1,
          pairType: resolveLeaguePairType(team, pair),
        }));

      const leftovers = dedupePlayers(asArray(team?.leftovers));
      const players = dedupePlayers([
        ...asArray(team?.players),
        ...leftovers,
        ...pairs.flatMap((pair) => asArray(pair?.players)),
      ]);

      return {
        ...team,
        id: team?.id || `team-${teamIndex + 1}`,
        preferredPairType:
          String(team?.preferredPairType || "").trim() ||
          String(pairs[0]?.pairType || "").trim(),
        players,
        pairs,
        leftovers,
      };
    })
    .filter((team) => {
      const pairCount = asArray(team?.pairs).length;
      const playerCount = asArray(team?.players).length;
      const leftoverCount = asArray(team?.leftovers).length;
      return pairCount > 0 || playerCount > 0 || leftoverCount > 0;
    })
    .map((team, teamIndex) => ({
      ...team,
      id: `team-${teamIndex + 1}`,
      name: buildTeamName(teamIndex),
    }));

  return {
    ...leagueInfo,
    teams,
    teamCount: Math.max(1, teams.length || Number(leagueInfo?.teamCount) || 1),
  };
}

function resolveLeaguePairType(team, pair) {
  const directType = String(pair?.pairType || "").trim();
  if (directType) return directType;

  const detectedType = detectPairType(pair);
  if (detectedType && detectedType !== "일반복식") return detectedType;

  const preferredType = String(team?.preferredPairType || "").trim();
  if (preferredType) return preferredType;

  return detectedType || "일반복식";
}

function orderLeaguePairings(pairings) {
  const remaining = Array.isArray(pairings) ? [...pairings] : [];
  const ordered = [];
  let previousPairIds = new Set();

  const countRemainingUsage = (targetPairId) =>
    remaining.reduce((count, [pairA, pairB]) => {
      return count + (pairA?.id === targetPairId || pairB?.id === targetPairId ? 1 : 0);
    }, 0);

  while (remaining.length > 0) {
    let eligible = remaining.filter(
      ([pairA, pairB]) => !previousPairIds.has(pairA?.id) && !previousPairIds.has(pairB?.id)
    );

    if (eligible.length === 0) {
      eligible = [...remaining];
    }

    eligible.sort((a, b) => {
      const aUsage =
        countRemainingUsage(a[0]?.id) + countRemainingUsage(a[1]?.id);
      const bUsage =
        countRemainingUsage(b[0]?.id) + countRemainingUsage(b[1]?.id);
      if (aUsage !== bUsage) return bUsage - aUsage;

      const aDiff = Math.abs(getPairMatchScore(a[0]) - getPairMatchScore(a[1]));
      const bDiff = Math.abs(getPairMatchScore(b[0]) - getPairMatchScore(b[1]));
      if (aDiff !== bDiff) return aDiff - bDiff;

      const aName = `${a[0]?.id || ""}-${a[1]?.id || ""}`;
      const bName = `${b[0]?.id || ""}-${b[1]?.id || ""}`;
      return aName.localeCompare(bName, "ko");
    });

    const nextMatch = eligible[0];
    const nextIndex = remaining.findIndex(
      ([pairA, pairB]) => pairA?.id === nextMatch[0]?.id && pairB?.id === nextMatch[1]?.id
    );

    if (nextIndex < 0) break;

    ordered.push(remaining[nextIndex]);
    previousPairIds = new Set([remaining[nextIndex][0]?.id, remaining[nextIndex][1]?.id]);
    remaining.splice(nextIndex, 1);
  }

  return ordered;
}

function buildTeamMatchesFromPairs(team, targetMatchCount, winningScore) {
  const pairs = asArray(team?.pairs).filter((pair) => asArray(pair?.players).length >= 2);
  if (pairs.length < 2) return [];

  const pairings = [];

  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const pairA = pairs[i];
      const pairB = pairs[j];
      const typeA = resolveLeaguePairType(team, pairA);
      const typeB = resolveLeaguePairType(team, pairB);

      if (typeA !== typeB) continue;

      pairings.push([pairA, pairB]);
    }
  }

  pairings.sort((a, b) => {
    const aDiff = Math.abs(getPairMatchScore(a[0]) - getPairMatchScore(a[1]));
    const bDiff = Math.abs(getPairMatchScore(b[0]) - getPairMatchScore(b[1]));
    if (aDiff !== bDiff) return aDiff - bDiff;
    const aName = `${a[0]?.id || ""}-${a[1]?.id || ""}`;
    const bName = `${b[0]?.id || ""}-${b[1]?.id || ""}`;
    return aName.localeCompare(bName, "ko");
  });

  const orderedPairings = orderLeaguePairings(pairings);

  return orderedPairings.map(([pairA, pairB], matchIndex) => {
    const pairAType = resolveLeaguePairType(team, pairA);
    const pairBType = resolveLeaguePairType(team, pairB);
    return {
      id: `${team?.id || "team"}-manual-${matchIndex + 1}`,
      matchId: `${team?.id || "team"}-manual-${matchIndex + 1}`,
      type: "league",
      mode: "league",
      scope: "team-internal",
      teamId: team?.id,
      teamName: team?.name,
      ageBand: team?.ageBand || "",
      gameType: pairAType === pairBType ? pairAType : `${pairAType}/${pairBType}`,
      homeTeamId: team?.id,
      awayTeamId: team?.id,
      homeTeamName: team?.name,
      awayTeamName: team?.name,
      team1: {
        id: pairA?.id,
        name: asArray(pairA?.players).map(getPlayerName).join(" / "),
        pairType: pairAType,
        players: asArray(pairA?.players).map(getPlayerName),
        members: asArray(pairA?.players),
      },
      team2: {
        id: pairB?.id,
        name: asArray(pairB?.players).map(getPlayerName).join(" / "),
        pairType: pairBType,
        players: asArray(pairB?.players).map(getPlayerName),
        members: asArray(pairB?.players),
      },
      scoreA: null,
      scoreB: null,
      teamAScore: null,
      teamBScore: null,
      winningScore,
      status: "pending",
    };
  });
}

function buildScheduleFromLeagueInfo(
  leagueInfo,
  targetMatchCount,
  courtCount,
  winningScore,
  randomize = false,
  sanitizeTeams = true
) {
  const teams = asArray((sanitizeTeams ? sanitizeLeagueInfoByMatchDiff(leagueInfo) : leagueInfo)?.teams);
  const matches = teams.flatMap((team) =>
    buildTeamMatchesFromPairs(team, targetMatchCount, winningScore)
  );
  const rounds = arrangeLeagueScheduleByTeamCourt(
    [{ id: "manual-round", label: "ROUND 1", round: 1, matches }],
    teams,
    randomize
  );
  return rounds;
}

function hasManualLeaguePairs(leagueInfo) {
  return asArray(leagueInfo?.teams).some((team) =>
    asArray(team?.pairs).some(
      (pair) => pair?.isManual || String(pair?.id || "").includes("-manual-pair-")
    )
  );
}

function extractPlayersFromLeagueInfo(leagueInfo, fallbackPlayers = []) {
  const teams = asArray(leagueInfo?.teams);
  if (teams.length === 0) return asArray(fallbackPlayers);

  const byName = new Map();
  teams.forEach((team) => {
    [...asArray(team?.players), ...asArray(team?.leftovers)].forEach((player) => {
      const name = getPlayerName(player);
      if (!name) return;
      const prev = byName.get(name) || {};
      byName.set(name, {
        ...prev,
        ...player,
        name,
        gender: normalizeGender(player?.gender),
        baseScore: getBaseScoreByGenderAndGrade(player?.gender, player?.grade),
      });
    });
  });

  return Array.from(byName.values());
}

function buildLeagueTeamScheduleBoards(schedule, teams) {
  const orderedTeams = asArray(teams).map((team, index) => ({
    ...team,
    id: team?.id || `team-${index + 1}`,
  }));
  const matchesByTeam = new Map(
    orderedTeams.map((team, index) => [String(team?.id || `team-${index + 1}`), []])
  );

  asArray(schedule).forEach((round, roundIndex) => {
    asArray(round?.matches).forEach((match) => {
      const teamKey = resolveLeagueMatchTeamKey(match, orderedTeams);
      if (!teamKey) return;
      if (!matchesByTeam.has(teamKey)) {
        matchesByTeam.set(teamKey, []);
      }

      matchesByTeam.get(teamKey).push({
        roundLabel: round?.label || `ROUND ${roundIndex + 1}`,
        pairA: String(match?.team1?.name || "").trim(),
        pairB: String(match?.team2?.name || "").trim(),
        gameType: String(match?.gameType || "").trim(),
      });
    });
  });

  return orderedTeams.map((team, index) => {
    const teamKey = String(team?.id || `team-${index + 1}`);
    return {
      id: teamKey,
      name: team?.name || `팀 ${index + 1}`,
      ageBand: team?.ageBand || "",
      matches: matchesByTeam.get(teamKey) || [],
    };
  });
}

function buildTournamentCategoryBoards(schedule) {
  const categoryMap = new Map();

  asArray(schedule).forEach((round) => {
    asArray(round?.matches).forEach((match) => {
      const stage = String(match?.tournamentStage || "예선").trim() || "예선";
      const category = String(
        match?.tournamentCategoryLabel || match?.category || match?.teamName || "대회 경기"
      ).trim() || "대회 경기";
      const poolKey = String(match?.tournamentPoolKey || "").trim();
      const poolName = String(match?.tournamentPoolName || "").trim();
      const key = `${category}::${stage}::${poolKey || "none"}`;
      const current =
        categoryMap.get(key) || {
          id: key,
          name: category,
          stage,
          poolKey,
          poolName,
          pairs: new Map(),
        };

      if (stage === "예선") {
        [
          { team: match?.teamA, scored: readScoreA(match), allowed: readScoreB(match) },
          { team: match?.teamB, scored: readScoreB(match), allowed: readScoreA(match) },
        ].forEach(({ team, scored, allowed }) => {
          const members = asArray(team);
          const hasStructuredMembers = members.some(
            (member) => member && typeof member === "object" && !Array.isArray(member)
          );
          if (!hasStructuredMembers) return;

          const pairNames = members.map(getPlayerName).filter(Boolean);
          if (pairNames.length === 0) return;
          const pairKey = pairNames.join(" / ");
          if (!current.pairs.has(pairKey)) {
            current.pairs.set(pairKey, {
              id: pairKey,
              label: pairKey,
              pairType: match?.gameType || match?.matchLabel || "",
              score: Number(
                members
                  .reduce(
                    (sum, member) =>
                      sum +
                      (typeof member?.baseScore === "number" && Number.isFinite(member.baseScore)
                        ? member.baseScore
                        : getBaseScoreByGenderAndGrade(member?.gender, member?.grade)),
                    0
                  )
                  .toFixed(1)
              ),
              win: 0,
              lose: 0,
              draw: 0,
              scored: 0,
              allowed: 0,
            });
          }

          const pairEntry = current.pairs.get(pairKey);
          if (scored !== null && allowed !== null) {
            pairEntry.scored += scored;
            pairEntry.allowed += allowed;
            if (scored > allowed) pairEntry.win += 1;
            else if (scored < allowed) pairEntry.lose += 1;
            else pairEntry.draw += 1;
          }
        });
      }

      categoryMap.set(key, current);
    });
  });

  return Array.from(categoryMap.values())
    .map((category) => ({
      id: category.id,
      name: category.name,
      stage: category.stage,
      poolKey: category.poolKey,
      poolName: category.poolName,
      pairs: Array.from(category.pairs.values()).sort((a, b) => {
        if ((b.win || 0) !== (a.win || 0)) return (b.win || 0) - (a.win || 0);
        const diffA = (a.scored || 0) - (a.allowed || 0);
        const diffB = (b.scored || 0) - (b.allowed || 0);
        if (diffB !== diffA) return diffB - diffA;
        if ((b.scored || 0) !== (a.scored || 0)) return (b.scored || 0) - (a.scored || 0);
        return String(a.label).localeCompare(String(b.label), "ko");
      }),
    }))
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage === "예선" ? -1 : 1;
      const sortA = getTournamentCategorySortValue(a.name);
      const sortB = getTournamentCategorySortValue(b.name);
      const typeDiff = sortA.typeOrder - sortB.typeOrder;
      if (typeDiff !== 0) return typeDiff;
      if (sortA.baseName !== sortB.baseName) {
        return sortA.baseName.localeCompare(sortB.baseName, "ko");
      }
      if (a.poolName !== b.poolName) return String(a.poolName).localeCompare(String(b.poolName), "ko");
      return String(a.name).localeCompare(String(b.name), "ko");
    });
}

function buildTournamentStageSections(rounds, stage) {
  const sectionMap = new Map();

  asArray(rounds).forEach((round, roundIndex) => {
    const matches = asArray(round?.matches);
    if (matches.length === 0) return;

    const sampleMatch = matches[0];
    const matchStage = String(sampleMatch?.tournamentStage || "예선").trim() || "예선";
    if (matchStage !== stage) return;

    const categoryLabel = String(
      sampleMatch?.tournamentCategoryLabel || sampleMatch?.category || sampleMatch?.teamName || "대회 경기"
    ).trim() || "대회 경기";
    const section = sectionMap.get(categoryLabel) || {
      id: `${stage}-${categoryLabel}`,
      title: categoryLabel,
      rounds: [],
      matchCount: 0,
    };
    section.rounds.push(round);
    section.matchCount += matches.length;
    sectionMap.set(categoryLabel, section);
  });

  return Array.from(sectionMap.values()).sort((a, b) => {
    const sortA = getTournamentCategorySortValue(a.title);
    const sortB = getTournamentCategorySortValue(b.title);
    if (sortA.typeOrder !== sortB.typeOrder) return sortA.typeOrder - sortB.typeOrder;
    if (sortA.baseName !== sortB.baseName) {
      return sortA.baseName.localeCompare(sortB.baseName, "ko");
    }
    return sortA.text.localeCompare(sortB.text, "ko");
  });
}

function assignPlayersToLeagueTeams(players, requestedTeamCount, randomizePairing = false) {
  const safePlayers = asArray(players);
  if (safePlayers.length === 0) return { players: [], teamCount: 1 };

  const maxSupportedTeams = 6;
  const pairCount = Math.floor(safePlayers.length / 2);
  const cappedByPairCount = pairCount > 0 ? Math.min(pairCount, maxSupportedTeams) : 1;
  const teamCount = Math.max(
    1,
    Math.min(cappedByPairCount, safePlayers.length, Number(requestedTeamCount) || 1)
  );
  const bandBases = [20, 30, 40, 50, 60, 70];
  const source = randomizePairing ? shuffleArray(safePlayers) : [...safePlayers];
  const pairUnits = [];

  for (let i = 0; i + 1 < source.length; i += 2) {
    pairUnits.push([source[i], source[i + 1]]);
  }

  const singlePlayers = source.length % 2 === 1 ? [source[source.length - 1]] : [];
  const buckets = Array.from({ length: teamCount }, () => []);
  const pairsPerTeam = Array.from({ length: teamCount }, () => 0);

  // Pair-first distribution: keeps team-to-team pair count gap within 1 pair.
  pairUnits.forEach((pair) => {
    let targetIndex = 0;
    for (let i = 1; i < teamCount; i += 1) {
      if (pairsPerTeam[i] < pairsPerTeam[targetIndex]) targetIndex = i;
    }
    buckets[targetIndex].push(...pair);
    pairsPerTeam[targetIndex] += 1;
  });

  // Any odd leftover player goes to the currently smallest team.
  singlePlayers.forEach((player) => {
    let targetIndex = 0;
    for (let i = 1; i < teamCount; i += 1) {
      if (buckets[i].length < buckets[targetIndex].length) targetIndex = i;
    }
    buckets[targetIndex].push(player);
  });

  const adjustedPlayers = buckets.flatMap((bucket, bucketIndex) =>
    bucket.map((player, playerIndex) => {
      const base = bandBases[bucketIndex] || 70;
      const offset = randomizePairing
        ? Math.floor(Math.random() * 10)
        : (playerIndex + bucketIndex) % 10;
      const adjustedAge = base + offset;
      return {
        ...player,
        age: adjustedAge,
        ageGroup: base >= 70 ? "70대 이상" : `${base}대`,
      };
    })
  );

  return { players: adjustedPlayers, teamCount };
}

function getMatchIdentity(match, roundIndex, matchIndex) {
  return (
    match?.id ||
    match?.matchId ||
    match?.uuid ||
    `${match?.team1?.id || match?.teamA?.id || "a"}-${
      match?.team2?.id || match?.teamB?.id || "b"
    }-${roundIndex + 1}-${matchIndex + 1}`
  );
}

function enrichMatch(match, roundIndex, matchIndex) {
  const resolvedCourt =
    match?.court ??
    match?.courtId ??
    match?.courtNo ??
    match?.courtNumber ??
    null;
  return {
    ...match,
    id: getMatchIdentity(match, roundIndex, matchIndex),
    court: resolvedCourt,
    courtLabel:
      match?.courtLabel ||
      (resolvedCourt !== null && typeof resolvedCourt !== "undefined" ? `코트 ${resolvedCourt}` : undefined),
    scoreAInput:
      match?.scoreAInput ??
      (match?.scoreA ?? match?.teamAScore ?? match?.homeScore ?? match?.score1 ?? ""),
    scoreBInput:
      match?.scoreBInput ??
      (match?.scoreB ?? match?.teamBScore ?? match?.awayScore ?? match?.score2 ?? ""),
  };
}

function normalizeScheduleResult(result) {
  if (!result) return [];

  const wrapMatchesToRound = (matches, roundLabel = "ROUND 1") => [
    {
      id: "round-1",
      label: roundLabel,
      round: 1,
      matches: asArray(matches).map((match, index) => enrichMatch(match, 0, index)),
    },
  ];

  if (Array.isArray(result)) {
    if (result.length === 0) return [];
    if (result.every(isRoundLike)) {
      return result.map((round, roundIndex) => ({
        ...round,
        id: round?.id || `round-${roundIndex + 1}`,
        label:
          round?.label ||
          round?.title ||
          round?.name ||
          (typeof round?.round !== "undefined"
            ? `ROUND ${round.round}`
            : `ROUND ${roundIndex + 1}`),
        round: round?.round || roundIndex + 1,
        matches: asArray(round?.matches).map((match, matchIndex) =>
          enrichMatch(match, roundIndex, matchIndex)
        ),
      }));
    }
    if (result.every(isMatchLike)) {
      return wrapMatchesToRound(result);
    }
    return [];
  }

  if (Array.isArray(result.rounds)) {
    if (result.rounds.every(isRoundLike)) {
      return result.rounds.map((round, roundIndex) => ({
        ...round,
        id: round?.id || `round-${roundIndex + 1}`,
        label:
          round?.label ||
          round?.title ||
          round?.name ||
          (typeof round?.round !== "undefined"
            ? `ROUND ${round.round}`
            : `ROUND ${roundIndex + 1}`),
        round: round?.round || roundIndex + 1,
        matches: asArray(round?.matches).map((match, matchIndex) =>
          enrichMatch(match, roundIndex, matchIndex)
        ),
      }));
    }
    if (result.rounds.every(isMatchLike)) {
      return wrapMatchesToRound(result.rounds);
    }
  }

  if (Array.isArray(result.schedule)) {
    if (result.schedule.every(isRoundLike)) {
      return result.schedule.map((round, roundIndex) => ({
        ...round,
        id: round?.id || `round-${roundIndex + 1}`,
        label:
          round?.label ||
          round?.title ||
          round?.name ||
          (typeof round?.round !== "undefined"
            ? `ROUND ${round.round}`
            : `ROUND ${roundIndex + 1}`),
        round: round?.round || roundIndex + 1,
        matches: asArray(round?.matches).map((match, matchIndex) =>
          enrichMatch(match, roundIndex, matchIndex)
        ),
      }));
    }
    if (result.schedule.every(isMatchLike)) {
      return wrapMatchesToRound(result.schedule);
    }
  }

  if (Array.isArray(result.matches)) {
    return wrapMatchesToRound(result.matches);
  }

  return [];
}

function getLeagueStandingsFromResult(result) {
  if (!result) return [];
  if (Array.isArray(result?.standings)) return result.standings;
  if (Array.isArray(result?.leagueStandings)) return result.leagueStandings;
  return [];
}

function getLeagueSummaryFromResult(result) {
  if (!result) return null;
  return result.summary || result.leagueSummary || result.meta || null;
}

function getRoundItems(schedule) {
  return asArray(schedule).map((round, index) => ({
    id: round?.id || `round-${index + 1}`,
    label:
      round?.label ||
      round?.title ||
      round?.name ||
      (typeof round?.round !== "undefined" ? `ROUND ${round.round}` : `ROUND ${index + 1}`),
    matches: Array.isArray(round) ? round : asArray(round?.matches),
  }));
}

function invokeBuilder(builder, payload) {
  if (typeof builder !== "function") return null;

  const argsSignatureResult = (() => {
    try {
      return builder(payload.players, {
        targetMatchCount: payload.targetMatchCount,
        courtCount: payload.courtCount,
        winningScore: payload.winningScore,
      });
    } catch (error) {
      return null;
    }
  })();

  const normalizedArgsSignature = normalizeScheduleResult(argsSignatureResult);
  if (normalizedArgsSignature.length > 0) {
    return argsSignatureResult;
  }

  const objectSignatureResult = (() => {
    try {
      return builder(payload);
    } catch (error) {
      return null;
    }
  })();

  const normalizedObjectSignature = normalizeScheduleResult(objectSignatureResult);
  if (normalizedObjectSignature.length > 0) {
    return objectSignatureResult;
  }

  return argsSignatureResult ?? objectSignatureResult;
}

function updateMatchInSchedule(schedule, matchId, updater) {
  return asArray(schedule).map((round) => ({
    ...round,
    matches: asArray(round?.matches).map((match) =>
      match?.id === matchId || match?.matchId === matchId ? updater(match) : match
    ),
  }));
}

const ENGINE_BUILDERS = {
  friendly: buildFriendlySchedule,
  tournament: buildTournamentSchedule,
  rivalry: buildRivalrySchedule,
  league: buildLeagueSchedule,
};

export default function App() {
  const [selectedMode, setSelectedMode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [targetMatchCount, setTargetMatchCount] = useState(3);
  const [courtCount, setCourtCount] = useState(4);
  const [winningScore, setWinningScore] = useState(DEFAULT_WINNING_SCORE);
  const [schedule, setSchedule] = useState([]);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [leagueStandings, setLeagueStandings] = useState([]);
  const [leagueSummary, setLeagueSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("players");
  const [tournamentCollapsed, setTournamentCollapsed] = useState({});
  const [schedulePanelCollapsed, setSchedulePanelCollapsed] = useState(false);
  const [leagueBoardsCollapsed, setLeagueBoardsCollapsed] = useState(false);

  useEffect(() => {
    const savedState = loadAppState(STORAGE_KEY, {
      normalizeSchedule: normalizeScheduleResult,
    });
    if (!savedState) return;

    if (savedState.__storageStatus === "version_reset") {
      setMessage("저장 데이터 형식이 변경되어 이전 데이터를 초기화했습니다.");
    } else if (savedState.__storageStatus === "corrupted_reset") {
      setMessage("저장 데이터가 손상되어 초기화했습니다.");
    }

    if (savedState.selectedMode) setSelectedMode(savedState.selectedMode);
    if (Array.isArray(savedState.players)) setPlayers(savedState.players);

    if (typeof savedState.targetMatchCount !== "undefined") {
      const nextTarget = Number(savedState.targetMatchCount);
      setTargetMatchCount(Number.isFinite(nextTarget) && nextTarget > 0 ? nextTarget : 3);
    }

    if (typeof savedState.courtCount !== "undefined") {
      const nextCourt = Number(savedState.courtCount);
      setCourtCount(Number.isFinite(nextCourt) && nextCourt > 0 ? nextCourt : 4);
    }

    if (typeof savedState.winningScore !== "undefined") {
      const nextWinningScore = Number(savedState.winningScore);
      setWinningScore(
        Number.isFinite(nextWinningScore) && nextWinningScore > 0
          ? nextWinningScore
          : DEFAULT_WINNING_SCORE
      );
    }

    if (Array.isArray(savedState.schedule)) setSchedule(savedState.schedule);
    if (savedState.leagueInfo) setLeagueInfo(savedState.leagueInfo);
    if (Array.isArray(savedState.leagueStandings)) setLeagueStandings(savedState.leagueStandings);
    if (savedState.leagueSummary) setLeagueSummary(savedState.leagueSummary);
    if (savedState.activeTab) setActiveTab(savedState.activeTab);
  }, []);

  useEffect(() => {
    saveAppState(STORAGE_KEY, {
      selectedMode,
      players,
      targetMatchCount,
      courtCount,
      winningScore,
      schedule,
      leagueInfo,
      leagueStandings,
      leagueSummary,
      activeTab,
    });
  }, [
    selectedMode,
    players,
    targetMatchCount,
    courtCount,
    winningScore,
    schedule,
    leagueInfo,
    leagueStandings,
    leagueSummary,
    activeTab,
  ]);

  const modeValue = useMemo(() => normalizeModeValue(selectedMode), [selectedMode]);
  const modeLabel = useMemo(() => normalizeModeLabel(selectedMode), [selectedMode]);
  const safeTargetMatchCountValue = Math.max(1, Number(targetMatchCount) || 1);

  useEffect(() => {
    if (modeValue !== "league") return;
    if (players.length > 0) return;
    if (asArray(leagueInfo?.teams).length === 0) return;

    setPlayers(extractPlayersFromLeagueInfo(leagueInfo, players));
  }, [modeValue, leagueInfo, players]);

  const nextId = useMemo(() => {
    if (players.length === 0) return 1;
    return Math.max(...players.map((p) => Number(p.id) || 0)) + 1;
  }, [players]);

  const roundItems = useMemo(() => getRoundItems(schedule), [schedule]);
  const leagueSchedulePreview = useMemo(() => {
    if (modeValue !== "league") return [];
    const teams = asArray(leagueInfo?.teams);
    if (teams.length === 0) return [];
    if (roundItems.length > 0) return roundItems;

    return buildScheduleFromLeagueInfo(
      leagueInfo,
      Math.max(1, Number(targetMatchCount) || 1),
      teams.length,
      Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE),
      false
    );
  }, [modeValue, leagueInfo, roundItems, targetMatchCount, winningScore]);
  const leagueTeamScheduleBoards = useMemo(
    () => buildLeagueTeamScheduleBoards(leagueSchedulePreview, asArray(leagueInfo?.teams)),
    [leagueSchedulePreview, leagueInfo]
  );
  const teamPairRankings = useMemo(
    () => buildTeamPairRankings(leagueSchedulePreview, asArray(leagueInfo?.teams)),
    [leagueSchedulePreview, leagueInfo]
  );
  const leagueTeamBoards = useMemo(() => {
    if (modeValue !== "league") return [];

    const rankingMap = new Map(
      teamPairRankings.map((team) => [
        String(team?.id || team?.name || ""),
        asArray(team?.rankedPairs),
      ])
    );
    const scheduleMap = new Map(
      leagueTeamScheduleBoards.map((team) => [
        String(team?.id || team?.name || ""),
        asArray(team?.matches),
      ])
    );

    return asArray(leagueInfo?.teams).map((team, index) => {
      const teamId = String(team?.id || `team-${index + 1}`);
      return {
        id: teamId,
        name: team?.name || `팀 ${index + 1}`,
        ageBand: team?.ageBand || "",
        rankedPairs: rankingMap.get(teamId) || [],
        matches: scheduleMap.get(teamId) || [],
      };
    });
  }, [modeValue, leagueInfo, teamPairRankings, leagueTeamScheduleBoards]);
  const tournamentBoards = useMemo(
    () => (modeValue === "tournament" ? buildTournamentCategoryBoards(roundItems) : []),
    [modeValue, roundItems]
  );
  const tournamentPreliminarySections = useMemo(
    () => (modeValue === "tournament" ? buildTournamentStageSections(roundItems, "예선") : []),
    [modeValue, roundItems]
  );
  const tournamentFinalSections = useMemo(
    () => (modeValue === "tournament" ? buildTournamentStageSections(roundItems, "본선") : []),
    [modeValue, roundItems]
  );

  useEffect(() => {
    if (modeValue !== "tournament") return;

    setTournamentCollapsed((prev) => {
      const nextCollapsed = {};

      tournamentPreliminarySections.forEach((section, index) => {
        nextCollapsed[section.id] =
          typeof prev[section.id] === "boolean" ? prev[section.id] : index !== 0;
      });
      tournamentFinalSections.forEach((section, index) => {
        nextCollapsed[section.id] =
          typeof prev[section.id] === "boolean" ? prev[section.id] : index !== 0;
      });

      return nextCollapsed;
    });
  }, [modeValue, tournamentPreliminarySections, tournamentFinalSections]);

  const displayRoundItems = useMemo(() => {
    if (modeValue === "league" && roundItems.length === 0 && leagueSchedulePreview.length > 0) {
      return leagueSchedulePreview;
    }
    return roundItems;
  }, [modeValue, roundItems, leagueSchedulePreview]);

  const totalMatches = useMemo(() => {
    return displayRoundItems.reduce((sum, round) => sum + asArray(round.matches).length, 0);
  }, [displayRoundItems]);

  const friendlyPlayerProgress = useMemo(() => {
    if (modeValue !== "friendly") return [];

    const roster = asArray(players).map((player, index) => {
      const playerId = String(getPlayerIdentity(player, index));
      return {
        ...player,
        id: playerId,
        name: getPlayerName(player),
        gender: normalizeGender(player?.gender),
        baseScore:
          typeof player?.baseScore === "number" && Number.isFinite(player.baseScore)
            ? player.baseScore
            : getBaseScoreByGenderAndGrade(player?.gender, player?.grade),
      };
    });

    const assignedCounts = new Map(roster.map((player) => [player.id, 0]));

    asArray(schedule).forEach((round) => {
      asArray(round?.matches).forEach((match) => {
        [...asArray(match?.teamA), ...asArray(match?.teamB)].forEach((player, playerIndex) => {
          const playerId = String(getPlayerIdentity(player, playerIndex));
          assignedCounts.set(playerId, (assignedCounts.get(playerId) || 0) + 1);
        });
      });
    });

    return roster
      .filter((player) => player.name)
      .map((player) => {
        const assignedCount = assignedCounts.get(player.id) || 0;
        return {
          ...player,
          assignedCount,
          remainingCount: Math.max(0, safeTargetMatchCountValue - assignedCount),
        };
      })
      .sort((a, b) => {
        if (a.remainingCount !== b.remainingCount) return b.remainingCount - a.remainingCount;
        if (a.assignedCount !== b.assignedCount) return a.assignedCount - b.assignedCount;
        return String(a.name).localeCompare(String(b.name), "ko");
      });
  }, [modeValue, players, schedule, targetMatchCount]);

  const friendlyUnderTargetPlayers = useMemo(
    () =>
      friendlyPlayerProgress.filter((player) => player.assignedCount < safeTargetMatchCountValue),
    [friendlyPlayerProgress, safeTargetMatchCountValue]
  );
  const friendlyScoreboard = useMemo(() => {
    if (modeValue !== "friendly") return [];

    const playerMap = new Map();
    const ensurePlayer = (player, index = 0) => {
      const playerId = String(getPlayerIdentity(player, index));
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          id: playerId,
          name: getPlayerName(player),
          points: 0,
          win: 0,
          lose: 0,
          draw: 0,
          scored: 0,
          allowed: 0,
        });
      }
      return playerMap.get(playerId);
    };

    asArray(players).forEach((player, index) => {
      ensurePlayer(player, index);
    });

    asArray(schedule).forEach((round) => {
      asArray(round?.matches).forEach((match) => {
        const scoreA = Number(match?.scoreA);
        const scoreB = Number(match?.scoreB);
        if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

        const sideAPlayers = asArray(match?.teamA)
          .map((player, playerIndex) => ensurePlayer(player, playerIndex))
          .filter(Boolean);
        const sideBPlayers = asArray(match?.teamB)
          .map((player, playerIndex) => ensurePlayer(player, playerIndex + 2))
          .filter(Boolean);

        if (scoreA > scoreB) {
          sideAPlayers.forEach((player) => {
            player.points += 1;
            player.win += 1;
            player.scored += scoreA;
            player.allowed += scoreB;
          });
          sideBPlayers.forEach((player) => {
            player.lose += 1;
            player.scored += scoreB;
            player.allowed += scoreA;
          });
        } else if (scoreB > scoreA) {
          sideBPlayers.forEach((player) => {
            player.points += 1;
            player.win += 1;
            player.scored += scoreB;
            player.allowed += scoreA;
          });
          sideAPlayers.forEach((player) => {
            player.lose += 1;
            player.scored += scoreA;
            player.allowed += scoreB;
          });
        } else {
          sideAPlayers.forEach((player) => {
            player.draw += 1;
            player.scored += scoreA;
            player.allowed += scoreB;
          });
          sideBPlayers.forEach((player) => {
            player.draw += 1;
            player.scored += scoreB;
            player.allowed += scoreA;
          });
        }
      });
    });

    return Array.from(playerMap.values())
      .map((player) => ({
        ...player,
        diff: player.scored - player.allowed,
      }))
      .filter((player) => player.name)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.scored !== a.scored) return b.scored - a.scored;
        return String(a.name).localeCompare(String(b.name), "ko");
      });
  }, [modeValue, players, schedule]);
  const rivalryPlayerProgress = useMemo(() => {
    if (modeValue !== "rivalry") return [];

    const roster = asArray(players).map((player, index) => {
      const playerId = String(getPlayerIdentity(player, index));
      return {
        ...player,
        id: playerId,
        name: getPlayerName(player),
        rivalryTeam: String(player?.rivalryTeam || "").trim() || "A팀",
      };
    });

    const assignedCounts = new Map(roster.map((player) => [player.id, 0]));

    asArray(schedule).forEach((round) => {
      asArray(round?.matches).forEach((match) => {
        [...asArray(match?.teamA), ...asArray(match?.teamB)].forEach((player, playerIndex) => {
          const playerId = String(getPlayerIdentity(player, playerIndex));
          assignedCounts.set(playerId, (assignedCounts.get(playerId) || 0) + 1);
        });
      });
    });

    return roster
      .filter((player) => player.name)
      .map((player) => {
        const assignedCount = assignedCounts.get(player.id) || 0;
        return {
          ...player,
          assignedCount,
          remainingCount: Math.max(0, safeTargetMatchCountValue - assignedCount),
        };
      })
      .sort((a, b) => {
        if (a.rivalryTeam !== b.rivalryTeam) {
          return String(a.rivalryTeam).localeCompare(String(b.rivalryTeam), "ko");
        }
        if (a.remainingCount !== b.remainingCount) return b.remainingCount - a.remainingCount;
        if (a.assignedCount !== b.assignedCount) return a.assignedCount - b.assignedCount;
        return String(a.name).localeCompare(String(b.name), "ko");
      });
  }, [modeValue, players, schedule, safeTargetMatchCountValue]);

  const rivalryUnderTargetPlayers = useMemo(
    () =>
      rivalryPlayerProgress.filter((player) => player.assignedCount < safeTargetMatchCountValue),
    [rivalryPlayerProgress, safeTargetMatchCountValue]
  );
  const rivalryScoreboard = useMemo(() => {
    if (modeValue !== "rivalry") {
      return { teams: [], winnerTeamName: "", isTie: false };
    }

    const teamMap = new Map();
    const playerMap = new Map();

    const ensureTeam = (teamName) => {
      const safeTeamName = String(teamName || "").trim() || "A팀";
      const existing = teamMap.get(safeTeamName);
      if (existing) return existing;

      const next = {
        name: safeTeamName,
        points: 0,
        win: 0,
        lose: 0,
        draw: 0,
        scored: 0,
        allowed: 0,
        players: new Map(),
      };
      teamMap.set(safeTeamName, next);
      return next;
    };

    const ensurePlayer = (player, fallbackTeamName = "A팀", playerIndex = 0) => {
      const id = String(getPlayerIdentity(player, playerIndex));
      const name = getPlayerName(player);
      if (!name) return null;

      const teamName = String(player?.rivalryTeam || fallbackTeamName).trim() || fallbackTeamName;
      const team = ensureTeam(teamName);
      const existing = playerMap.get(id);
      if (existing) {
        return existing;
      }

      const next = {
        id,
        name,
        points: 0,
        win: 0,
        lose: 0,
        draw: 0,
        scored: 0,
        allowed: 0,
        teamName,
      };
      playerMap.set(id, next);
      team.players.set(id, next);
      return next;
    };

    asArray(players).forEach((player, index) => {
      ensurePlayer(player, String(player?.rivalryTeam || "").trim() || "A팀", index);
    });

    asArray(schedule).forEach((round) => {
      asArray(round?.matches).forEach((match, matchIndex) => {
        const teamAName = String(match?.teamAName || "").trim() || "A팀";
        const teamBName = String(match?.teamBName || "").trim() || "B팀";
        const teamAPlayers = asArray(match?.teamA);
        const teamBPlayers = asArray(match?.teamB);

        const teamA = ensureTeam(teamAName);
        const teamB = ensureTeam(teamBName);
        const sideAPlayers = teamAPlayers
          .map((player, playerIndex) => ensurePlayer(player, teamAName, playerIndex))
          .filter(Boolean);
        const sideBPlayers = teamBPlayers
          .map((player, playerIndex) => ensurePlayer(player, teamBName, playerIndex))
          .filter(Boolean);

        const scoreA = Number(match?.scoreA);
        const scoreB = Number(match?.scoreB);
        const completed = Number.isFinite(scoreA) && Number.isFinite(scoreB);
        if (!completed) return;

        if (scoreA > scoreB) {
          sideAPlayers.forEach((player) => {
            player.points += 1;
            player.win += 1;
            player.scored += scoreA;
            player.allowed += scoreB;
          });
          sideBPlayers.forEach((player) => {
            player.lose += 1;
            player.scored += scoreB;
            player.allowed += scoreA;
          });
        } else if (scoreB > scoreA) {
          sideBPlayers.forEach((player) => {
            player.points += 1;
            player.win += 1;
            player.scored += scoreB;
            player.allowed += scoreA;
          });
          sideAPlayers.forEach((player) => {
            player.lose += 1;
            player.scored += scoreA;
            player.allowed += scoreB;
          });
        } else {
          sideAPlayers.forEach((player) => {
            player.draw += 1;
            player.scored += scoreA;
            player.allowed += scoreB;
          });
          sideBPlayers.forEach((player) => {
            player.draw += 1;
            player.scored += scoreB;
            player.allowed += scoreA;
          });
        }
      });
    });

    const teams = Array.from(teamMap.values())
      .map((team) => {
        const rankedPlayers = Array.from(team.players.values())
          .map((player) => ({
            ...player,
            diff: player.scored - player.allowed,
          }))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.scored !== a.scored) return b.scored - a.scored;
            return String(a.name).localeCompare(String(b.name), "ko");
          });

        const totals = rankedPlayers.reduce(
          (acc, player) => ({
            points: acc.points + (player.points || 0),
            win: acc.win + (player.win || 0),
            lose: acc.lose + (player.lose || 0),
            draw: acc.draw + (player.draw || 0),
            scored: acc.scored + (player.scored || 0),
            allowed: acc.allowed + (player.allowed || 0),
          }),
          { points: 0, win: 0, lose: 0, draw: 0, scored: 0, allowed: 0 }
        );

        return {
          ...team,
          ...totals,
          diff: totals.scored - totals.allowed,
          players: rankedPlayers,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.scored !== a.scored) return b.scored - a.scored;
        return String(a.name).localeCompare(String(b.name), "ko");
      });

    const top = teams[0];
    const next = teams[1];
    const isTie =
      Boolean(top && next) &&
      top.points === next.points &&
      top.diff === next.diff &&
      top.scored === next.scored;

    return {
      teams,
      winnerTeamName: !isTie && top ? top.name : "",
      isTie,
    };
  }, [modeValue, players, schedule]);

  const onBack = () => {
    setSelectedMode(null);
    setSchedule([]);
    setLeagueInfo(null);
    setLeagueStandings([]);
    setLeagueSummary(null);
    setMessage("");
    setActiveTab("players");
  };

  const handleResetAll = () => {
    setPlayers([]);
    setSchedule([]);
    setLeagueInfo(null);
    setLeagueStandings([]);
    setLeagueSummary(null);
    setMessage("선수 명단과 대진표를 전체 초기화했습니다.");
    setActiveTab("players");
  };

  const toggleTournamentSection = (sectionId) => {
    setTournamentCollapsed((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSelectMode = (mode) => {
    setSelectedMode(mode);
    setSchedule([]);
    setLeagueInfo(null);
    setLeagueStandings([]);
    setLeagueSummary(null);
    setMessage("");
    setActiveTab("players");
  };

  const handleUpdateLeagueInfo = (nextLeagueInfo) => {
    const normalizedNextLeagueInfo = normalizeExistingLeagueInfoForSchedule(nextLeagueInfo);
    setLeagueInfo(normalizedNextLeagueInfo);
    if (modeValue !== "league") return;

    setPlayers(extractPlayersFromLeagueInfo(normalizedNextLeagueInfo, players));

    const safeTargetMatchCount = Math.max(1, Number(targetMatchCount) || 1);
    const safeCourtCount = Math.max(1, Number(courtCount) || 1);
    const safeWinningScore = Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE);
    const nextSchedule = buildScheduleFromLeagueInfo(
      normalizedNextLeagueInfo,
      safeTargetMatchCount,
      safeCourtCount,
      safeWinningScore,
      false,
      false
    );

    setSchedule(nextSchedule);
    const nextStandings = buildLeagueStandings(nextSchedule, asArray(normalizedNextLeagueInfo?.teams), {
      winningScore: safeWinningScore,
    });
    setLeagueStandings(nextStandings);
    setLeagueSummary("팀 구성 변경이 대진표에 반영되었습니다.");
    setActiveTab("schedule");
    setMessage("조 추가 내용이 대진표에 즉시 반영되었습니다.");
  };

  const handleAddFriendlyManualMatch = ({ teamA = [], teamB = [] }) => {
    if (modeValue !== "friendly") return false;

    const namesA = asArray(teamA).map(normalizeManualName).filter(Boolean);
    const namesB = asArray(teamB).map(normalizeManualName).filter(Boolean);

    if (namesA.length !== 2 || namesB.length !== 2) {
      setMessage("친선전 수동 대진은 2명 vs 2명으로 입력해야 합니다.");
      return false;
    }

    const allNames = [...namesA, ...namesB];
    if (new Set(allNames).size !== 4) {
      setMessage("같은 선수를 중복 입력할 수 없습니다.");
      return false;
    }

    const normalizedRoster = asArray(players).map((player, index) => ({
      ...player,
      id: String(getPlayerIdentity(player, index)),
      name: getPlayerName(player),
      gender: normalizeGender(player?.gender),
      baseScore:
        typeof player?.baseScore === "number" && Number.isFinite(player.baseScore)
          ? player.baseScore
          : getBaseScoreByGenderAndGrade(player?.gender, player?.grade),
    }));
    const rosterByName = new Map(
      normalizedRoster.map((player) => [String(player.name || "").trim(), player])
    );

    const resolvedTeamA = resolveManualPlayersByName(namesA, rosterByName, {
      mode: "friendly",
      side: "A",
    });
    const resolvedTeamB = resolveManualPlayersByName(namesB, rosterByName, {
      mode: "friendly",
      side: "B",
    });

    const manualMatch = buildFriendlyManualMatch(
      resolvedTeamA,
      resolvedTeamB,
      asArray(schedule).flatMap((round) => asArray(round?.matches)).length
    );
    const appendedSchedule = [
      ...asArray(schedule),
      {
        id: `round-manual-${Date.now()}`,
        label: "ROUND 수동",
        round: asArray(schedule).length + 1,
        matches: [manualMatch],
      },
    ];

    setSchedule(reflowScheduleByCourt(appendedSchedule, Math.max(1, Number(courtCount) || 1)));
    setActiveTab("schedule");
    setMessage("친선전 수동 대진을 추가했습니다.");
    return true;
  };

  const handleAddRivalryManualMatch = ({ teamA = [], teamB = [] }) => {
    if (modeValue !== "rivalry") return false;

    const namesA = asArray(teamA).map(normalizeManualName).filter(Boolean);
    const namesB = asArray(teamB).map(normalizeManualName).filter(Boolean);

    if (namesA.length !== 2 || namesB.length !== 2) {
      setMessage("대항전 수동 대진은 2명 vs 2명으로 입력해야 합니다.");
      return false;
    }

    const allNames = [...namesA, ...namesB];
    if (new Set(allNames).size !== 4) {
      setMessage("같은 선수를 중복 입력할 수 없습니다.");
      return false;
    }

    const roster = asArray(players).map((player, index) => ({
      ...player,
      id: String(getPlayerIdentity(player, index)),
      name: getPlayerName(player),
      rivalryTeam: String(player?.rivalryTeam || "").trim() || "A팀",
    }));
    const rosterByName = new Map(roster.map((player) => [String(player.name || "").trim(), player]));

    const resolvedTeamA = resolveManualPlayersByName(namesA, rosterByName, {
      mode: "rivalry",
      side: "A",
      rivalryTeam: "A팀",
    });
    const resolvedTeamB = resolveManualPlayersByName(namesB, rosterByName, {
      mode: "rivalry",
      side: "B",
      rivalryTeam: "B팀",
    });

    const teamNameA = String(resolvedTeamA[0]?.rivalryTeam || "");
    const teamNameB = String(resolvedTeamB[0]?.rivalryTeam || "");
    const validTeamA = resolvedTeamA.every((player) => String(player?.rivalryTeam || "") === teamNameA);
    const validTeamB = resolvedTeamB.every((player) => String(player?.rivalryTeam || "") === teamNameB);

    if (!validTeamA || !validTeamB || !teamNameA || !teamNameB || teamNameA === teamNameB) {
      setMessage("대항전 수동 대진은 서로 다른 팀의 2인조끼리만 추가할 수 있습니다.");
      return false;
    }

    const manualMatch = buildRivalryManualMatch(
      resolvedTeamA,
      resolvedTeamB,
      asArray(schedule).flatMap((round) => asArray(round?.matches)).length
    );
    const appendedSchedule = [
      ...asArray(schedule),
      {
        id: `rivalry-round-manual-${Date.now()}`,
        label: "ROUND 수동",
        round: asArray(schedule).length + 1,
        matches: [manualMatch],
      },
    ];

    setSchedule(reflowScheduleByCourt(appendedSchedule, Math.max(1, Number(courtCount) || 1)));
    setActiveTab("schedule");
    setMessage("대항전 수동 대진을 추가했습니다.");
    return true;
  };

  const generateSchedule = (options = {}) => {
    const safeTargetMatchCount =
      modeValue === "tournament"
        ? 1
        : Math.max(1, Number(options?.targetMatchCount ?? targetMatchCount) || 1);
    const safeCourtCount = Math.max(1, Number(options?.courtCount ?? courtCount) || 1);
    const safeWinningScore = Math.max(
      1,
      Number(options?.winningScore ?? winningScore) || DEFAULT_WINNING_SCORE
    );
    const hasExistingLeagueTeams = modeValue === "league" && asArray(leagueInfo?.teams).length > 0;
    const leagueSourcePlayers =
      modeValue === "league" && (!Array.isArray(players) || players.length === 0) && hasExistingLeagueTeams
        ? extractPlayersFromLeagueInfo(leagueInfo, players)
        : players;
    const hasLeagueSourcePlayers = Array.isArray(leagueSourcePlayers) && leagueSourcePlayers.length > 0;
    const normalizedLeaguePlayers =
      modeValue === "league" ? normalizePlayersForLeague(leagueSourcePlayers) : players;
    const previousState = {
      schedule,
      leagueInfo,
      leagueStandings,
      leagueSummary,
      players,
      courtCount,
    };

    try {

      if (!modeValue) {
        setMessage("모드를 먼저 선택해주세요.");
        setActiveTab("players");
        return;
      }

      if ((!Array.isArray(players) || players.length === 0) && hasExistingLeagueTeams && !options?.isRegenerate) {
        const sanitizedLeagueInfo = sanitizeLeagueInfoByMatchDiff(leagueInfo);
        const syncedPlayers = extractPlayersFromLeagueInfo(sanitizedLeagueInfo, players);
        const lockedTeamCount = Math.max(
          1,
          asArray(sanitizedLeagueInfo?.teams).length || safeCourtCount
        );
        const nextSchedule = buildScheduleFromLeagueInfo(
          sanitizedLeagueInfo,
          safeTargetMatchCount,
          lockedTeamCount,
          safeWinningScore,
          Boolean(options?.isRegenerate)
        );
        const nextStandings = buildLeagueStandings(nextSchedule, asArray(sanitizedLeagueInfo?.teams), {
          winningScore: safeWinningScore,
        });

        setLeagueInfo(sanitizedLeagueInfo);
        setPlayers(syncedPlayers);
        setSchedule(nextSchedule);
        setLeagueStandings(nextStandings);
        setLeagueSummary("저장된 팀 구성을 기준으로 대진표를 구성했습니다.");
        setCourtCount(lockedTeamCount);
        setMessage(
          `저장된 팀 구성으로 정기전 대진표를 생성했습니다. 팀 수와 코트 수는 ${lockedTeamCount}개입니다.`
        );
        setActiveTab("schedule");
        return;
      }

      if ((modeValue === "league" && !hasLeagueSourcePlayers) || (modeValue !== "league" && (!Array.isArray(players) || players.length === 0))) {
        setMessage("선수를 먼저 등록해주세요.");
        setActiveTab("players");
        return;
      }

      const builder = ENGINE_BUILDERS[modeValue];

      if (modeValue !== "league" && typeof builder !== "function") {
        setSchedule([]);
        setLeagueInfo(null);
        setLeagueStandings([]);
        setLeagueSummary(null);
        setMessage("현재 모드의 대진표 생성기를 찾을 수 없습니다.");
        setActiveTab("players");
        return;
      }

    const leagueBuildResult =
      modeValue === "league"
        ? options?.isRegenerate && asArray(leagueInfo?.teams).length > 0
          ? normalizeExistingLeagueInfoForSchedule(leagueInfo)
          : buildLeagueInfoFromPlayers(
              normalizedLeaguePlayers,
              safeCourtCount,
              safeTargetMatchCount,
              safeWinningScore
            )
        : null;
    const effectiveCourtCount =
      modeValue === "league"
        ? Math.max(1, Number(leagueBuildResult?.teamCount) || safeCourtCount)
        : safeCourtCount;
    const payload = {
      players,
      targetMatchCount: safeTargetMatchCount,
      courtCount: effectiveCourtCount,
      winningScore: safeWinningScore,
    };

      const result = modeValue === "league" ? leagueBuildResult : invokeBuilder(builder, payload);
      const normalizedLeagueResult =
      modeValue === "league"
        ? options?.isRegenerate
          ? normalizeExistingLeagueInfoForSchedule(result)
          : sanitizeLeagueInfoByMatchDiff(result)
        : null;
      let nextSchedule =
      modeValue === "league"
        ? buildScheduleFromLeagueInfo(
            normalizedLeagueResult,
            safeTargetMatchCount,
            effectiveCourtCount,
            safeWinningScore,
            Boolean(options?.isRegenerate),
            !Boolean(options?.isRegenerate)
          )
        : normalizeScheduleResult(result);

      if (
      modeValue === "league" &&
      (!Array.isArray(nextSchedule) || nextSchedule.length === 0) &&
      asArray(normalizedLeagueResult?.teams).length > 0
      ) {
        nextSchedule = buildScheduleFromLeagueInfo(
        normalizedLeagueResult,
        safeTargetMatchCount,
        effectiveCourtCount,
        safeWinningScore,
        false,
        false
      );
      }

      if (!Array.isArray(nextSchedule) || nextSchedule.length === 0) {
      if (modeValue === "league" && options?.isRegenerate) {
        setLeagueInfo(normalizedLeagueResult || leagueInfo || null);
        setLeagueStandings(
          buildLeagueStandings(schedule, asArray((normalizedLeagueResult || leagueInfo)?.teams), {
            winningScore: safeWinningScore,
          })
        );
        setLeagueSummary(getLeagueSummaryFromResult(normalizedLeagueResult || leagueInfo));
        setMessage(
          "재생성 실패: 현재 팀 구성으로 경기 카드를 만들 수 없습니다. 수동 조 정보 또는 팀 종목을 확인해주세요."
        );
        setActiveTab("schedule");
        return;
      }

      setSchedule([]);
      setLeagueInfo(modeValue === "league" ? normalizedLeagueResult || null : null);
      setLeagueStandings(
        modeValue === "league"
          ? buildLeagueStandings([], asArray(normalizedLeagueResult?.teams), {
              winningScore: safeWinningScore,
            })
          : []
      );
      setLeagueSummary(
        modeValue === "league" ? getLeagueSummaryFromResult(normalizedLeagueResult) : null
      );
      setMessage(
        options?.isRegenerate
          ? "재생성 실패: 조건에 맞는 경기표를 만들지 못했습니다."
          : "생성 실패: 선수 구성과 조건을 확인해주세요."
      );
      setActiveTab("schedule");
      return;
      }

      if (modeValue === "league") {
        nextSchedule = arrangeLeagueScheduleByTeamCourt(
        nextSchedule,
        asArray(normalizedLeagueResult?.teams),
        Boolean(options?.isRegenerate)
        );
      } else if (modeValue === "tournament") {
        nextSchedule = applyTournamentProgression(nextSchedule);
      } else if (options?.isRegenerate) {
        nextSchedule = reflowScheduleByCourt(nextSchedule, effectiveCourtCount);
      }

      if (Number(courtCount) !== effectiveCourtCount) {
        setCourtCount(effectiveCourtCount);
      }

      setSchedule(nextSchedule);

      if (modeValue === "league") {
        setLeagueInfo(normalizedLeagueResult || null);
        setPlayers(extractPlayersFromLeagueInfo(normalizedLeagueResult, leagueSourcePlayers));
        setLeagueStandings(
        buildLeagueStandings(nextSchedule, asArray(normalizedLeagueResult?.teams), {
          winningScore: safeWinningScore,
        })
        );
        setLeagueSummary(getLeagueSummaryFromResult(normalizedLeagueResult));
      } else {
        setLeagueInfo(null);
        setLeagueStandings([]);
        setLeagueSummary(null);
      }

      const baseMessage = `${modeLabel || "선택한 모드"} 대진표가 ${
        options?.isRegenerate ? "재생성" : "생성"
      }되었습니다.`;
      const warnings = buildGenerationWarnings({
        modeValue,
        players: modeValue === "league" ? extractPlayersFromLeagueInfo(normalizedLeagueResult, leagueSourcePlayers) : players,
        schedule: nextSchedule,
        targetMatchCount: safeTargetMatchCount,
        courtCount: effectiveCourtCount,
      });

      if (modeValue === "league") {
        setMessage(
        options?.isRegenerate
          ? `${baseMessage} 기존 팀 구성을 유지한 채 경기만 다시 배치했습니다.${warnings.length ? ` 경고: ${warnings.join(" ")}` : ""}`
          : `${baseMessage} 팀 구성과 경기표를 새로 만들었습니다.${warnings.length ? ` 경고: ${warnings.join(" ")}` : ""}`
        );
      } else {
        setMessage(`${baseMessage}${warnings.length ? ` 경고: ${warnings.join(" ")}` : ""}`);
      }
      setActiveTab("schedule");
    } catch (error) {
      console.error("generateSchedule failed", error);
      setSchedule(previousState.schedule);
      setLeagueInfo(previousState.leagueInfo);
      setLeagueStandings(previousState.leagueStandings);
      setLeagueSummary(previousState.leagueSummary);
      setPlayers(previousState.players);
      setCourtCount(previousState.courtCount);
      setMessage(
        `${options?.isRegenerate ? "재생성" : "생성"} 실패: ${error?.message || "알 수 없는 오류가 발생했습니다."}`
      );
      setActiveTab("schedule");
    }
  };

  const handleRegenerateSchedule = () => {
    generateSchedule({
      isRegenerate: true,
      targetMatchCount,
      courtCount,
      winningScore,
    });
  };

  const updateLeagueStandingsFromSchedule = (nextSchedule) => {
    if (modeValue !== "league") return;
    const standings = buildLeagueStandings(nextSchedule, asArray(leagueInfo?.teams), {
      winningScore: Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE),
    });
    setLeagueStandings(standings);
  };

  const handleScoreInputChange = (matchId, side, value) => {
    const safeValue = String(value).replace(/[^\d]/g, "");
    let invalidMessage = "";

    setSchedule((prev) => {
      const nextSchedule = updateMatchInSchedule(prev, matchId, (match) => {
        const scoreAInput = side === "A" ? safeValue : String(match?.scoreAInput ?? "");
        const scoreBInput = side === "B" ? safeValue : String(match?.scoreBInput ?? "");
        const scoreA = toNumber(scoreAInput, NaN);
        const scoreB = toNumber(scoreBInput, NaN);
        const hasBothScores = Number.isFinite(scoreA) && Number.isFinite(scoreB);
        const appliedWinningScore = Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE);

        if (!hasBothScores) {
          return {
            ...match,
            scoreAInput,
            scoreBInput,
            scoreA: null,
            scoreB: null,
            score1: null,
            score2: null,
            homeScore: null,
            awayScore: null,
            teamAScore: null,
            teamBScore: null,
            leftScore: null,
            rightScore: null,
            scoreText: null,
            status: "pending",
            result: null,
          };
        }

        if (modeValue === "league") {
          if (scoreA === scoreB) {
            invalidMessage = "정기전은 동점 입력이 불가합니다.";
            return {
              ...match,
              scoreAInput,
              scoreBInput,
              scoreA: null,
              scoreB: null,
              score1: null,
              score2: null,
              homeScore: null,
              awayScore: null,
              teamAScore: null,
              teamBScore: null,
              leftScore: null,
              rightScore: null,
              scoreText: null,
              status: "pending",
              result: null,
            };
          }

          const winnerScore = Math.max(scoreA, scoreB);
          if (winnerScore < appliedWinningScore) {
            invalidMessage = `정기전은 승자 점수가 최소 ${appliedWinningScore}점 이상이어야 반영됩니다.`;
            return {
              ...match,
              scoreAInput,
              scoreBInput,
              scoreA: null,
              scoreB: null,
              score1: null,
              score2: null,
              homeScore: null,
              awayScore: null,
              teamAScore: null,
              teamBScore: null,
              leftScore: null,
              rightScore: null,
              scoreText: null,
              status: "pending",
              result: null,
            };
          }
        }

        if (modeValue === "tournament" && scoreA === scoreB) {
          invalidMessage = "대회 모드는 동점 입력이 불가합니다.";
          return {
            ...match,
            scoreAInput,
            scoreBInput,
            scoreA: null,
            scoreB: null,
            score1: null,
            score2: null,
            homeScore: null,
            awayScore: null,
            teamAScore: null,
            teamBScore: null,
            leftScore: null,
            rightScore: null,
            scoreText: null,
            status: "pending",
            result: null,
          };
        }

        return {
          ...match,
          scoreAInput,
          scoreBInput,
          scoreA: hasBothScores ? scoreA : null,
          scoreB: hasBothScores ? scoreB : null,
          score1: hasBothScores ? scoreA : null,
          score2: hasBothScores ? scoreB : null,
          homeScore: hasBothScores ? scoreA : null,
          awayScore: hasBothScores ? scoreB : null,
          teamAScore: hasBothScores ? scoreA : null,
          teamBScore: hasBothScores ? scoreB : null,
          leftScore: hasBothScores ? scoreA : null,
          rightScore: hasBothScores ? scoreB : null,
          scoreText: hasBothScores ? `${scoreA} : ${scoreB}` : null,
          status: hasBothScores ? "completed" : "pending",
          result: scoreA > scoreB ? "team1" : scoreB > scoreA ? "team2" : "draw",
        };
      });

      const resolvedSchedule =
        modeValue === "tournament" ? applyTournamentProgression(nextSchedule) : nextSchedule;
      updateLeagueStandingsFromSchedule(resolvedSchedule);
      return resolvedSchedule;
    });

    if (invalidMessage) {
      setMessage(invalidMessage);
    }
  };

  const handleScoreReset = (matchId) => {
    const updatedSchedule = updateMatchInSchedule(schedule, matchId, (match) => ({
      ...match,
      scoreAInput: "",
      scoreBInput: "",
      scoreA: null,
      scoreB: null,
      score1: null,
      score2: null,
      homeScore: null,
      awayScore: null,
      teamAScore: null,
      teamBScore: null,
      leftScore: null,
      rightScore: null,
      scoreText: null,
      status: "pending",
      result: null,
    }));

    const resolvedSchedule =
      modeValue === "tournament" ? applyTournamentProgression(updatedSchedule) : updatedSchedule;

    setSchedule(resolvedSchedule);
    updateLeagueStandingsFromSchedule(resolvedSchedule);
    setMessage("경기 점수를 초기화했습니다.");
  };

  const handleDownloadExcel = async () => {
    if (!Array.isArray(displayRoundItems) || displayRoundItems.length === 0) {
      setMessage("먼저 대진표를 생성한 뒤 엑셀 다운로드를 해주세요.");
      return;
    }

    try {
      await exportScheduleWorkbook({
        modeLabel,
        players,
        targetMatchCount,
        courtCount,
        roundItems: displayRoundItems,
        groupByCourt: modeValue === "league" || modeValue === "friendly",
        leagueStandings,
        leagueSummary,
        leagueTeams: asArray(leagueInfo?.teams),
        winningScore: Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE),
      });
      setMessage("엑셀 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage("엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  if (!selectedMode) {
    return (
      <div style={styles.app}>
        <style>{responsiveCss}</style>
        <HomePage
          modes={MODES}
          onSelectMode={handleSelectMode}
          onModeSelect={handleSelectMode}
          setSelectedMode={handleSelectMode}
        />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{responsiveCss}</style>

      <div style={styles.page}>
        {message ? (
          <div style={styles.messageWrap}>
            <div style={styles.message}>{message}</div>
          </div>
        ) : null}

        <div style={styles.layout} className="app-layout">
          <div style={styles.leftPane}>
            <PlayerManager
              mode={modeValue}
              modeLabel={modeLabel}
              players={players}
              setPlayers={setPlayers}
              nextId={nextId}
              onBack={onBack}
              onResetAll={handleResetAll}
              onMessage={setMessage}
              onGenerate={generateSchedule}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              targetMatchCount={targetMatchCount}
              setTargetMatchCount={setTargetMatchCount}
              courtCount={courtCount}
              setCourtCount={setCourtCount}
              schedule={schedule}
              setSchedule={setSchedule}
              leagueInfo={leagueInfo}
              onUpdateLeagueInfo={handleUpdateLeagueInfo}
              friendlyUnderTargetPlayers={friendlyUnderTargetPlayers}
              friendlyScoreboard={friendlyScoreboard}
              onAddFriendlyManualMatch={handleAddFriendlyManualMatch}
              rivalryUnderTargetPlayers={rivalryUnderTargetPlayers}
              rivalryScoreboard={rivalryScoreboard}
              onAddRivalryManualMatch={handleAddRivalryManualMatch}
              tournamentBoards={tournamentBoards}
              winningScore={Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE)}
            />
          </div>

          <div style={styles.rightPane}>
            <div style={styles.scheduleBoard}>
              <div style={styles.scheduleHeader}>
                <div style={styles.scheduleTitleWrap}>
                  <div style={styles.scheduleEyebrow}>Schedule Board</div>
                  <h2 style={styles.scheduleTitle}>{modeLabel} 대진표</h2>
                  <p style={styles.scheduleSub}>
                    ROUND, 코트, VS, 점수 표시를 운영 화면 기준으로 정리했습니다.
                  </p>
                </div>

                <div style={styles.scheduleActions}>
                  <button
                    type="button"
                    style={styles.collapseButton}
                    onClick={() => setSchedulePanelCollapsed((prev) => !prev)}
                  >
                    {schedulePanelCollapsed ? "대진표 펼치기" : "대진표 접기"}
                  </button>
                  <button
                    type="button"
                    style={styles.primaryActionButton}
                    onClick={handleRegenerateSchedule}
                  >
                    대진표 재생성
                  </button>
                  <button
                    type="button"
                    style={styles.excelActionButton}
                    onClick={handleDownloadExcel}
                  >
                    엑셀 다운로드
                  </button>
                </div>

                <div style={styles.headerStats}>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>선수 수</div>
                    <div style={styles.statValue}>{players.length}명</div>
                  </div>
                  {modeValue !== "tournament" && modeValue !== "league" ? (
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>목표 경기</div>
                      <input
                        type="number"
                        min="1"
                        style={styles.statInput}
                        value={Math.max(1, Number(targetMatchCount) || 1)}
                        onChange={(e) =>
                          setTargetMatchCount(Math.max(1, Number(e.target.value) || 1))
                        }
                      />
                    </div>
                  ) : null}
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>코트 수</div>
                    <input
                      type="number"
                      min="1"
                      style={styles.statInput}
                      value={Math.max(1, Number(courtCount) || 1)}
                      onChange={(e) => setCourtCount(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>생성 경기</div>
                    <div style={styles.statValue}>{totalMatches}경기</div>
                  </div>
                  {modeValue === "league" ? (
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>승리 기준</div>
                      <input
                        type="number"
                        min="1"
                        style={styles.statInput}
                        value={Math.max(1, Number(winningScore) || DEFAULT_WINNING_SCORE)}
                        onChange={(e) =>
                          setWinningScore(
                            Math.max(1, Number(e.target.value) || DEFAULT_WINNING_SCORE)
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {!schedulePanelCollapsed ? (
                <div style={styles.scheduleBody}>
                {modeValue === "tournament" ? (
                  <>
                    <section style={styles.pairRankBoard}>
                      <div style={styles.pairRankHeader}>예선전</div>
                      <div style={styles.pairRankBody}>
                        {tournamentPreliminarySections.length > 0 ? (
                          tournamentPreliminarySections.map((section) => {
                            const collapsed = Boolean(tournamentCollapsed[section.id]);
                            return (
                              <section key={section.id} style={styles.tournamentSectionBlock}>
                                <button
                                  type="button"
                                  style={styles.tournamentSectionToggle}
                                  onClick={() => toggleTournamentSection(section.id)}
                                >
                                  <span>{section.title}</span>
                                  <span style={styles.tournamentSectionMeta}>
                                    {section.matchCount}경기 · {collapsed ? "펼치기" : "접기"}
                                  </span>
                                </button>
                                {!collapsed ? (
                                  <div style={styles.tournamentSectionBody}>
                                    <ScheduleBoard
                                      roundItems={section.rounds}
                                      modeLabel={modeLabel}
                                      groupByCourt={false}
                                      compact
                                      onChangeScoreA={(matchId, value) =>
                                        handleScoreInputChange(matchId, "A", value)
                                      }
                                      onChangeScoreB={(matchId, value) =>
                                        handleScoreInputChange(matchId, "B", value)
                                      }
                                      onResetScore={handleScoreReset}
                                    />
                                  </div>
                                ) : null}
                              </section>
                            );
                          })
                        ) : (
                          <div style={styles.pairRankLine}>표시할 예선전 경기가 없습니다.</div>
                        )}
                      </div>
                    </section>

                    <section style={styles.pairRankBoard}>
                      <div style={styles.pairRankHeader}>본선전</div>
                      <div style={styles.pairRankBody}>
                        {tournamentFinalSections.length > 0 ? (
                          tournamentFinalSections.map((section) => {
                            const collapsed = Boolean(tournamentCollapsed[section.id]);
                            return (
                              <section key={section.id} style={styles.tournamentSectionBlock}>
                                <button
                                  type="button"
                                  style={styles.tournamentSectionToggle}
                                  onClick={() => toggleTournamentSection(section.id)}
                                >
                                  <span>{section.title}</span>
                                  <span style={styles.tournamentSectionMeta}>
                                    {section.matchCount}경기 · {collapsed ? "펼치기" : "접기"}
                                  </span>
                                </button>
                                {!collapsed ? (
                                  <div style={styles.tournamentSectionBody}>
                                    <ScheduleBoard
                                      roundItems={section.rounds}
                                      modeLabel={modeLabel}
                                      groupByCourt={false}
                                      compact
                                      onChangeScoreA={(matchId, value) =>
                                        handleScoreInputChange(matchId, "A", value)
                                      }
                                      onChangeScoreB={(matchId, value) =>
                                        handleScoreInputChange(matchId, "B", value)
                                      }
                                      onResetScore={handleScoreReset}
                                    />
                                  </div>
                                ) : null}
                              </section>
                            );
                          })
                        ) : (
                          <div style={styles.pairRankLine}>예선 결과가 확정되면 본선전이 표시됩니다.</div>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <ScheduleBoard
                      roundItems={displayRoundItems}
                      modeLabel={modeLabel}
                      groupByCourt={
                        modeValue === "league" ||
                        modeValue === "friendly" ||
                        modeValue === "rivalry"
                      }
                      compact={
                        modeValue === "league" ||
                        modeValue === "friendly" ||
                        modeValue === "rivalry"
                      }
                      onChangeScoreA={(matchId, value) =>
                        handleScoreInputChange(matchId, "A", value)
                      }
                    onChangeScoreB={(matchId, value) =>
                      handleScoreInputChange(matchId, "B", value)
                    }
                    onResetScore={handleScoreReset}
                  />
                )}

                {modeValue !== "league" ? (
                  <StandingsBoard
                    standings={leagueStandings}
                    summary={leagueSummary}
                    title="순위 요약"
                  />
                ) : null}
                </div>
              ) : (
                <div style={styles.collapsedBodyNotice}>대진표가 접혀 있습니다.</div>
              )}
            </div>

            {modeValue === "league" && leagueTeamBoards.length > 0 ? (
              <section style={styles.pairRankBoard}>
                <div style={styles.pairRankHeader}>
                  <span>팀별 순위 및 대진표</span>
                  <div style={styles.pairRankHeaderActions}>
                    <button
                      type="button"
                      style={styles.pairRankHeaderButton}
                      onClick={() => setLeagueBoardsCollapsed((prev) => !prev)}
                    >
                      {leagueBoardsCollapsed ? "펼치기" : "접기"}
                    </button>
                    <button
                      type="button"
                      style={styles.pairRankHeaderButton}
                      onClick={handleRegenerateSchedule}
                    >
                      대진표 재생성
                    </button>
                  </div>
                </div>
                {!leagueBoardsCollapsed ? (
                  <div style={styles.pairRankBody}>
                    {leagueTeamBoards.map((team, teamIndex) => {
                      const pairs = asArray(team?.rankedPairs);
                      const matches = asArray(team?.matches);
                      return (
                        <article
                          key={team?.id || `team-board-${teamIndex}`}
                          style={styles.pairRankTeam}
                        >
                          <div style={styles.pairRankTeamHead}>
                            <div style={styles.pairRankTeamName}>
                              {team?.name || `팀 ${teamIndex + 1}`}
                            </div>
                            <div>{team?.ageBand || ""}</div>
                          </div>
                          <div style={styles.pairRankSubhead}>팀별 순위</div>
                          {pairs.length === 0 ? (
                            <div style={styles.pairRankLine}>표시할 순위가 없습니다.</div>
                          ) : (
                            pairs.map((pair, pairIndex) => (
                              <div
                                key={pair?.id || `pair-rank-${teamIndex}-${pairIndex}`}
                                style={styles.pairRankLine}
                              >
                                {pairIndex + 1}위 {pair?.names || "-"} (승 {pair?.win || 0} / 패{" "}
                                {pair?.lose || 0} / 득실 {pair?.diff || 0})
                              </div>
                            ))
                          )}

                          <div style={styles.pairRankSubhead}>팀별 대진표</div>
                          {matches.length === 0 ? (
                            <div style={styles.pairRankLine}>표시할 대진표가 없습니다.</div>
                          ) : (
                            matches.map((match, matchIndex) => (
                              <div
                                key={`team-match-${teamIndex}-${matchIndex}`}
                                style={styles.pairRankLine}
                              >
                                {match?.roundLabel || `ROUND ${matchIndex + 1}`} :{" "}
                                {match?.pairA || "-"} VS {match?.pairB || "-"}
                                {match?.gameType ? ` (${match.gameType})` : ""}
                              </div>
                            ))
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div style={styles.collapsedBodyNotice}>
                    팀별 순위 및 대진표가 접혀 있습니다.
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

