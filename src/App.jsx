import React, { useEffect, useMemo, useState } from "react";
import HomePage from "./components/HomePage";
import PlayerManager from "./components/PlayerManager";
import ScheduleBoard from "./components/ScheduleBoard";
import StandingsBoard from "./components/StandingsBoard";
import { MODES, STORAGE_KEY } from "./constants";

import { buildFriendlySchedule } from "./engines/friendlyEngine";
import { buildTournamentSchedule } from "./engines/tournamentEngine";
import { buildRivalrySchedule } from "./engines/rivalryEngine";
import { buildLeagueSchedule, buildLeagueStandings } from "./league/leagueEngine";
import { asArray, exportScheduleWorkbook } from "./utils/exportScheduleExcel";

const DEFAULT_WINNING_SCORE = 25;

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
    marginTop: 24,
    border: "1px solid #dbeafe",
    borderRadius: 20,
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(30,41,59,0.04)",
  },

  pairRankHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
  },

  pairRankBody: {
    padding: 16,
    display: "grid",
    gap: 14,
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
  if (["m", "male", "man", "boy"].includes(raw)) return "M";
  if (["f", "female", "woman", "girl"].includes(raw)) return "F";
  return "U";
}

function normalizePlayersForLeague(players) {
  return asArray(players).map((player) => ({
    ...player,
    age: inferAge(player),
    gender: normalizeGender(player?.gender),
  }));
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || player.fullName || "";
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

function shuffleArray(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function reflowScheduleByCourt(schedule, courtCount) {
  const safeCourtCount = Math.max(1, Number(courtCount) || 1);
  const flatMatches = asArray(schedule).flatMap((round) =>
    asArray(round?.matches).map((match) => ({ ...match }))
  );
  const shuffledMatches = shuffleArray(flatMatches);
  const rounds = [];

  for (let i = 0; i < shuffledMatches.length; i += safeCourtCount) {
    const roundNo = rounds.length + 1;
    const chunk = shuffledMatches.slice(i, i + safeCourtCount).map((match, idx) => ({
      ...match,
      round: roundNo,
      court: idx + 1,
      courtLabel: `코트 ${idx + 1}`,
      id: `${match?.id || "match"}-r${roundNo}-c${idx + 1}`,
    }));

    rounds.push({
      id: `round-${roundNo}`,
      label: `ROUND ${roundNo}`,
      round: roundNo,
      matches: chunk,
    });
  }

  return rounds;
}

function getLeagueAgeBand(age) {
  const decade = Math.floor((Number(age) || 30) / 10) * 10;
  const clamped = Math.max(20, Math.min(decade, 70));
  return clamped >= 70 ? "70대" : `${clamped}대`;
}

function inferLeagueTeamCount(players) {
  const bands = new Set();
  asArray(players).forEach((player) => {
    bands.add(getLeagueAgeBand(player?.age));
  });
  return Math.max(1, bands.size);
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
  return {
    ...match,
    id: getMatchIdentity(match, roundIndex, matchIndex),
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (parsed?.selectedMode) setSelectedMode(parsed.selectedMode);
      if (Array.isArray(parsed?.players)) setPlayers(parsed.players);

      if (typeof parsed?.targetMatchCount !== "undefined") {
        const nextTarget = Number(parsed.targetMatchCount);
        setTargetMatchCount(Number.isFinite(nextTarget) && nextTarget > 0 ? nextTarget : 3);
      }

      if (typeof parsed?.courtCount !== "undefined") {
        const nextCourt = Number(parsed.courtCount);
        setCourtCount(Number.isFinite(nextCourt) && nextCourt > 0 ? nextCourt : 4);
      }

      if (typeof parsed?.winningScore !== "undefined") {
        const nextWinningScore = Number(parsed.winningScore);
        setWinningScore(
          Number.isFinite(nextWinningScore) && nextWinningScore > 0
            ? nextWinningScore
            : DEFAULT_WINNING_SCORE
        );
      }

      if (Array.isArray(parsed?.schedule)) setSchedule(normalizeScheduleResult(parsed.schedule));
      if (parsed?.leagueInfo) setLeagueInfo(parsed.leagueInfo);
      if (Array.isArray(parsed?.leagueStandings)) setLeagueStandings(parsed.leagueStandings);
      if (parsed?.leagueSummary) setLeagueSummary(parsed.leagueSummary);
      setMessage("");
      if (parsed?.activeTab) setActiveTab(parsed.activeTab);
    } catch (error) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedMode,
          players,
          targetMatchCount,
          courtCount,
          winningScore,
          schedule,
          leagueInfo,
          leagueStandings,
          leagueSummary,
          message,
          activeTab,
        })
      );
    } catch (error) {}
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
    message,
    activeTab,
  ]);

  const modeValue = useMemo(() => normalizeModeValue(selectedMode), [selectedMode]);
  const modeLabel = useMemo(() => normalizeModeLabel(selectedMode), [selectedMode]);

  const nextId = useMemo(() => {
    if (players.length === 0) return 1;
    return Math.max(...players.map((p) => Number(p.id) || 0)) + 1;
  }, [players]);

  const roundItems = useMemo(() => getRoundItems(schedule), [schedule]);
  const teamPairRankings = useMemo(
    () => buildTeamPairRankings(schedule, asArray(leagueInfo?.teams)),
    [schedule, leagueInfo]
  );

  const totalMatches = useMemo(() => {
    return roundItems.reduce((sum, round) => sum + asArray(round.matches).length, 0);
  }, [roundItems]);

  const onBack = () => {
    setSelectedMode(null);
    setSchedule([]);
    setLeagueInfo(null);
    setLeagueStandings([]);
    setLeagueSummary(null);
    setMessage("");
    setActiveTab("players");
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

  const generateSchedule = (options = {}) => {
    const safeTargetMatchCount = Math.max(
      1,
      Number(options?.targetMatchCount ?? targetMatchCount) || 1
    );
    const safeCourtCount = Math.max(1, Number(options?.courtCount ?? courtCount) || 1);
    const safeWinningScore = Math.max(
      1,
      Number(options?.winningScore ?? winningScore) || DEFAULT_WINNING_SCORE
    );
    const normalizedLeaguePlayers =
      modeValue === "league" ? normalizePlayersForLeague(players) : players;
    const leagueTeamCount =
      modeValue === "league" ? inferLeagueTeamCount(normalizedLeaguePlayers) : safeCourtCount;
    const effectiveCourtCount = modeValue === "league" ? leagueTeamCount : safeCourtCount;

    if (!modeValue) {
      setMessage("모드를 먼저 선택해주세요.");
      setActiveTab("players");
      return;
    }

    if (!Array.isArray(players) || players.length === 0) {
      setMessage("선수를 먼저 등록해주세요.");
      setActiveTab("players");
      return;
    }

    const builder = ENGINE_BUILDERS[modeValue];

    if (typeof builder !== "function") {
      setSchedule([]);
      setLeagueInfo(null);
      setLeagueStandings([]);
      setLeagueSummary(null);
      setMessage("현재 모드의 대진표 생성기를 찾을 수 없습니다.");
      setActiveTab("players");
      return;
    }

    const payload = {
      players: normalizedLeaguePlayers,
      targetMatchCount: safeTargetMatchCount,
      courtCount: effectiveCourtCount,
      winningScore: safeWinningScore,
    };

    const result = invokeBuilder(builder, payload);
    let nextSchedule = normalizeScheduleResult(result);

    if (!Array.isArray(nextSchedule) || nextSchedule.length === 0) {
      setSchedule([]);
      setLeagueInfo(modeValue === "league" ? result || null : null);
      setLeagueStandings(modeValue === "league" ? getLeagueStandingsFromResult(result) : []);
      setLeagueSummary(modeValue === "league" ? getLeagueSummaryFromResult(result) : null);
      setMessage("대진표를 생성하지 못했습니다. 선수 구성과 조건을 확인해주세요.");
      setActiveTab("schedule");
      return;
    }

    if (options?.isRegenerate) {
      nextSchedule = reflowScheduleByCourt(nextSchedule, effectiveCourtCount);
    }

    if (modeValue === "league" && Number(courtCount) !== effectiveCourtCount) {
      setCourtCount(effectiveCourtCount);
    }

    setSchedule(nextSchedule);

    if (modeValue === "league") {
      setLeagueInfo(result || null);
      setLeagueStandings(getLeagueStandingsFromResult(result));
      setLeagueSummary(getLeagueSummaryFromResult(result));
    } else {
      setLeagueInfo(null);
      setLeagueStandings([]);
      setLeagueSummary(null);
    }

    const baseMessage = `${modeLabel || "선택한 모드"} 대진표가 ${
      options?.isRegenerate ? "재생성" : "생성"
    }되었습니다.`;
    if (modeValue === "league") {
      setMessage(
        `${baseMessage} 정기전은 코트 수를 팀 수(${effectiveCourtCount})로 맞춰 ${
          options?.isRegenerate ? "재배치" : "생성"
        }했습니다.`
      );
    } else {
      setMessage(baseMessage);
    }
    setActiveTab("schedule");
  };

  const handleRegenerateSchedule = () => {
    setSchedule([]);
    setLeagueStandings([]);
    setLeagueSummary(null);
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
    setSchedule((prev) => {
      const nextSchedule = updateMatchInSchedule(prev, matchId, (match) => {
        const scoreAInput = side === "A" ? safeValue : String(match?.scoreAInput ?? "");
        const scoreBInput = side === "B" ? safeValue : String(match?.scoreBInput ?? "");
        const scoreA = toNumber(scoreAInput, NaN);
        const scoreB = toNumber(scoreBInput, NaN);
        const hasBothScores = Number.isFinite(scoreA) && Number.isFinite(scoreB);

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
        };
      });

      updateLeagueStandingsFromSchedule(nextSchedule);
      return nextSchedule;
    });
  };

  const handleScoreSave = (matchId) => {
    let saved = false;
    let invalid = false;
    let updatedSchedule = schedule;
    let invalidMessage = "";

    updatedSchedule = updateMatchInSchedule(schedule, matchId, (match) => {
      const nextScoreA = toNumber(match?.scoreAInput, NaN);
      const nextScoreB = toNumber(match?.scoreBInput, NaN);

      if (!Number.isFinite(nextScoreA) || !Number.isFinite(nextScoreB)) {
        invalid = true;
        invalidMessage = "점수를 모두 입력한 뒤 저장해주세요.";
        return match;
      }

      if (modeValue === "league") {
        if (nextScoreA === nextScoreB) {
          invalid = true;
          invalidMessage = "정기전은 동점 입력이 불가합니다.";
          return match;
        }

        const appliedWinningScore = Math.max(
          1,
          Number(winningScore) || DEFAULT_WINNING_SCORE
        );
        const winnerScore = Math.max(nextScoreA, nextScoreB);
        if (winnerScore < appliedWinningScore) {
          invalid = true;
          invalidMessage = `정기전은 승자 점수가 최소 ${appliedWinningScore}점 이상이어야 반영됩니다.`;
          return match;
        }
      }

      saved = true;

      return {
        ...match,
        scoreA: nextScoreA,
        scoreB: nextScoreB,
        score1: nextScoreA,
        score2: nextScoreB,
        homeScore: nextScoreA,
        awayScore: nextScoreB,
        teamAScore: nextScoreA,
        teamBScore: nextScoreB,
        leftScore: nextScoreA,
        rightScore: nextScoreB,
        scoreText: `${nextScoreA} : ${nextScoreB}`,
        status: "completed",
        result:
          nextScoreA > nextScoreB
            ? "team1"
            : nextScoreB > nextScoreA
            ? "team2"
            : "draw",
      };
    });

    if (invalid) {
      setMessage(invalidMessage || "점수를 확인해주세요.");
      return;
    }

    if (!saved) {
      setMessage("저장할 경기 점수를 찾지 못했습니다.");
      return;
    }

    setSchedule(updatedSchedule);
    updateLeagueStandingsFromSchedule(updatedSchedule);
    setMessage(
      modeValue === "league"
        ? `경기 점수가 저장되었습니다. 정기전 승리 기준은 ${Math.max(
            1,
            Number(winningScore) || DEFAULT_WINNING_SCORE
          )}점입니다.`
        : "경기 점수가 저장되었습니다."
    );
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

    setSchedule(updatedSchedule);
    updateLeagueStandingsFromSchedule(updatedSchedule);
    setMessage("경기 점수를 초기화했습니다.");
  };

  const handleDownloadExcel = async () => {
    if (!Array.isArray(roundItems) || roundItems.length === 0) {
      setMessage("먼저 대진표를 생성한 뒤 엑셀 다운로드를 해주세요.");
      return;
    }

    try {
      await exportScheduleWorkbook({
        modeLabel,
        players,
        targetMatchCount,
        courtCount,
        roundItems,
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

              <div style={styles.scheduleBody}>
                <ScheduleBoard
                  roundItems={roundItems}
                  modeLabel={modeLabel}
                  onChangeScoreA={(matchId, value) =>
                    handleScoreInputChange(matchId, "A", value)
                  }
                  onChangeScoreB={(matchId, value) =>
                    handleScoreInputChange(matchId, "B", value)
                  }
                  onSaveScore={handleScoreSave}
                  onResetScore={handleScoreReset}
                />

                {modeValue !== "league" ? (
                  <StandingsBoard
                    standings={leagueStandings}
                    summary={leagueSummary}
                    title="순위 요약"
                  />
                ) : null}

                {modeValue === "league" && teamPairRankings.length > 0 ? (
                  <section style={styles.pairRankBoard}>
                    <div style={styles.pairRankHeader}>대진표 하단 팀 내부 고정파트너 순위</div>
                    <div style={styles.pairRankBody}>
                      {teamPairRankings.map((team, teamIndex) => {
                        const pairs = asArray(team?.rankedPairs);
                        return (
                          <article
                            key={team?.id || `rank-team-${teamIndex}`}
                            style={styles.pairRankTeam}
                          >
                            <div style={styles.pairRankTeamHead}>
                              <div style={styles.pairRankTeamName}>
                                {team?.name || `팀 ${teamIndex + 1}`}
                              </div>
                              <div>{team?.ageBand || ""}</div>
                            </div>
                            {pairs.length === 0 ? (
                              <div style={styles.pairRankLine}>표시할 페어가 없습니다.</div>
                            ) : (
                              pairs.map((pair, pairIndex) => {
                                return (
                                  <div
                                    key={pair?.id || `pair-rank-${teamIndex}-${pairIndex}`}
                                    style={styles.pairRankLine}
                                  >
                                    {pairIndex + 1}등 {pair?.names || "-"} (승 {pair?.win || 0} / 패{" "}
                                    {pair?.lose || 0} / 득실 {pair?.diff || 0})
                                  </div>
                                );
                              })
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

