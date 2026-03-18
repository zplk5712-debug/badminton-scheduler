import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대", "60대", "70대 이상"];
const GRADE_OPTIONS = ["A", "B", "C", "D", "E"];
const RIVALRY_TEAM_OPTIONS = ["A팀", "B팀"];

const MALE_SCORE_BY_GRADE = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

const FEMALE_SCORE_BY_GRADE = {
  A: 3.8,
  B: 2.5,
  C: 1.8,
  D: 0.9,
  E: 0.5,
};

const styles = {
  wrap: {
    display: "grid",
    gap: 20,
  },

  topCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },

  backButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "10px 14px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: 900,
    margin: 0,
    color: "#0f172a",
  },

  headerSub: {
    marginTop: 4,
    fontSize: 14,
    color: "#64748b",
    fontWeight: 700,
  },

  tabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  tabButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  tabButtonActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #2563eb",
  },

  generateButton: {
    border: "none",
    background: "#22c55e",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: 10,
    fontWeight: 900,
    cursor: "pointer",
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },

  cardHeader: {
    padding: "14px 18px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },

  headerButtons: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  subButtonGreen: {
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },

  subButtonWhite: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "8px 14px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },

  cardBody: {
    padding: 18,
  },

  formRow1: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.7fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr)",
    gap: 12,
    marginBottom: 12,
    alignItems: "end",
  },

  formRow2: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) 132px",
    gap: 12,
    alignItems: "end",
  },

  formRow3: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 0.9fr) 132px",
    gap: 12,
    alignItems: "end",
    marginTop: 12,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
  },

  input: {
    width: "100%",
    minWidth: 0,
    height: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 700,
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
    color: "#0f172a",
  },

  select: {
    width: "100%",
    minWidth: 88,
    height: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 34px 0 12px",
    fontSize: 14,
    fontWeight: 700,
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
    color: "#0f172a",
    appearance: "auto",
  },

  addButtonWrap: {
    minWidth: 0,
  },

  addButton: {
    width: "100%",
    height: 42,
    border: "none",
    borderRadius: 10,
    background: "#22c55e",
    color: "#fff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },

  listHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  miniLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },

  miniInput: {
    width: 88,
    height: 36,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    padding: "0 8px",
    boxSizing: "border-box",
    fontWeight: 700,
    fontSize: 14,
  },

  resetButton: {
    border: "none",
    background: "#ef4444",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 8,
    fontWeight: 900,
    cursor: "pointer",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 640,
  },

  th: {
    textAlign: "left",
    padding: 12,
    fontSize: 13,
    fontWeight: 900,
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
    whiteSpace: "nowrap",
  },

  td: {
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    whiteSpace: "nowrap",
  },

  deleteButton: {
    border: "none",
    background: "transparent",
    color: "#ef4444",
    fontSize: 18,
    cursor: "pointer",
  },

  emptyBox: {
    padding: 30,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },

  scheduleGuide: {
    padding: 20,
    fontSize: 16,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.6,
  },

  teamPanel: {
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: 18,
    overflow: "hidden",
  },

  teamPanelHeader: {
    padding: "14px 18px",
    borderBottom: "1px solid #dbeafe",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.05) 100%)",
  },

  teamPanelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },

  teamPanelSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },

  teamPanelBody: {
    padding: 16,
    display: "grid",
    gap: 12,
  },

  teamCard: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
    padding: 14,
  },

  teamCardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },

  teamName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#1d4ed8",
  },

  teamMeta: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
  },

  teamSettingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },

  teamSettingLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
  },

  teamSettingInput: {
    width: 88,
    height: 34,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    boxSizing: "border-box",
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    outline: "none",
    background: "#fff",
  },

  pairBlock: {
    display: "grid",
    gap: 6,
    marginBottom: 10,
  },

  pairLine: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.5,
  },

  pairLineRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  pairDeleteButton: {
    height: 28,
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "0 8px",
    background: "#fff1f2",
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },

  playerList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },

  playerChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: 800,
  },

  reserveText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 800,
    color: "#dc2626",
    lineHeight: 1.5,
  },

  reservePanel: {
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: 18,
    overflow: "hidden",
  },

  reservePanelBody: {
    padding: 16,
    display: "grid",
    gap: 12,
  },

  reserveGroupCard: {
    border: "1px solid #dbeafe",
    borderRadius: 14,
    background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
    padding: 14,
  },

  reserveGroupTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 10,
  },

  reserveChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  reserveChip: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    minWidth: 180,
    minHeight: 30,
    padding: "10px 12px",
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
  },

  reserveChipMeta: {
    color: "#2563eb",
    fontWeight: 900,
  },

  reserveAssignRow: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
  },

  reserveAssignSelect: {
    width: "100%",
    height: 32,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    boxSizing: "border-box",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
    background: "#fff",
  },

  reserveAssignButton: {
    height: 32,
    border: "none",
    borderRadius: 8,
    padding: "0 10px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  pairEditor: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px dashed #bfdbfe",
    display: "grid",
    gap: 8,
  },

  pairEditorRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 8,
    alignItems: "center",
  },

  pairEditorInput: {
    width: "100%",
    height: 36,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    boxSizing: "border-box",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
  },

  pairEditorButton: {
    height: 36,
    border: "none",
    borderRadius: 8,
    padding: "0 12px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  pasteBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px dashed #cbd5e1",
    display: "grid",
    gap: 10,
  },

  pasteTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },

  pasteGuide: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "#64748b",
    fontWeight: 700,
    whiteSpace: "pre-line",
  },

  textarea: {
    width: "100%",
    minHeight: 120,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: 12,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
    color: "#0f172a",
  },

  pasteActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },

  pairEditorSubButton: {
    height: 32,
    border: "1px solid #93c5fd",
    borderRadius: 8,
    padding: "0 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 800,
    cursor: "pointer",
    justifySelf: "start",
  },

  friendlyStatusText: {
    fontSize: 14,
    fontWeight: 800,
    color: "#475569",
    lineHeight: 1.6,
  },

  friendlyProgressList: {
    display: "grid",
    gap: 8,
  },

  friendlyProgressRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #dbeafe",
    flexWrap: "wrap",
  },

  friendlyProgressName: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },

  friendlyProgressMeta: {
    fontSize: 13,
    fontWeight: 800,
    color: "#2563eb",
  },

  friendlyMatchEditor: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px dashed #bfdbfe",
    display: "grid",
    gap: 10,
  },

  friendlyMatchTeamTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#1e3a8a",
  },

  friendlyMatchEditorGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  scheduleLayout: {
    display: "flex",
    justifyContent: "flex-start",
  },

  scheduleColumn: {
    width: "100%",
    maxWidth: 760,
    display: "grid",
    gap: 14,
  },
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || player.fullName || "";
}

function getPlayerKey(player, index = 0) {
  if (!player) return `player-${index}`;
  if (typeof player === "string") return `${player}-${index}`;
  return player.id || player.__id || player.playerId || `${getPlayerName(player)}-${index}`;
}

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toLowerCase();
  if (["m", "male", "man", "남", "남자"].includes(raw)) return "M";
  if (["f", "female", "woman", "여", "여자"].includes(raw)) return "F";
  return "U";
}

function normalizeRivalryTeamLabel(team, fallback = "A팀") {
  const raw = String(team || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["a", "a팀", "ateam", "teama", "1", "1팀", "홈", "home"].includes(raw)) return "A팀";
  if (["b", "b팀", "bteam", "teamb", "2", "2팀", "원정", "away"].includes(raw)) return "B팀";
  return String(team || "").trim() || fallback;
}

function getGenderGroupLabel(gender) {
  const normalized = normalizeGender(gender);
  if (normalized === "M") return "남성 예비";
  if (normalized === "F") return "여성 예비";
  return "미분류 예비";
}

function getBaseScoreByGenderAndGrade(gender, grade) {
  const normalizedGender = normalizeGender(gender);
  const normalizedGrade = String(grade || "").trim().toUpperCase();
  const scoreTable =
    normalizedGender === "F" ? FEMALE_SCORE_BY_GRADE : MALE_SCORE_BY_GRADE;
  return scoreTable[normalizedGrade] ?? 0;
}

function resolvePairType(pair) {
  const players = safeArray(pair?.players);
  const genders = players.map((player) => normalizeGender(player?.gender)).filter(Boolean);

  if (genders.length >= 2) {
    const unique = new Set(genders);
    if (unique.size === 1 && unique.has("M")) return "남복";
    if (unique.size === 1 && unique.has("F")) return "여복";
    if (unique.has("M") && unique.has("F")) return "혼복";
  }

  const rawType = String(pair?.pairType || "").trim();
  const genericTypes = new Set(["일반복식", "복식", "doubles", "일반"]);
  if (!rawType || genericTypes.has(rawType.toLowerCase())) return "";
  return rawType;
}

function getPairLabel(pair, index) {
  const names = safeArray(pair?.players).map(getPlayerName).filter(Boolean);
  const type = resolvePairType(pair);
  if (names.length > 0) {
    return `${index + 1}조 ${names.join(", ")}${type ? ` (${type})` : ""}`;
  }
  return `${index + 1}조`;
}

function parseAgeFromAgeGroup(ageGroup) {
  const matched = String(ageGroup || "").match(/\d+/);
  if (!matched) return 30;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function getTeamDefaultGrade(team) {
  const gradeCounts = new Map();
  safeArray(team?.players).forEach((player) => {
    const grade = String(player?.grade || "").trim().toUpperCase();
    if (!grade) return;
    gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
  });

  return Array.from(gradeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "C";
}

function inferManualGenderForTeam(team, slotIndex, partnerGender = "") {
  const preferredType = String(team?.preferredPairType || "").trim();
  if (preferredType === "남복") return "M";
  if (preferredType === "여복") return "F";
  if (preferredType === "혼복") {
    const normalizedPartner = normalizeGender(partnerGender);
    if (normalizedPartner === "M") return "F";
    if (normalizedPartner === "F") return "M";
    return slotIndex % 2 === 0 ? "M" : "F";
  }
  return "U";
}

function createLeagueManualPlayer(name, team, slotIndex, partnerGender = "") {
  const gender = inferManualGenderForTeam(team, slotIndex, partnerGender);
  const grade = getTeamDefaultGrade(team);
  const ageGroup = String(team?.ageBand || "").trim() || "40대";

  return {
    id: `league-manual-${name}-${Date.now()}-${slotIndex + 1}`,
    name,
    gender,
    grade,
    ageGroup,
    age: parseAgeFromAgeGroup(ageGroup),
    baseScore: getBaseScoreByGenderAndGrade(gender, grade),
    isManualEntry: true,
  };
}

export default function PlayerManager({
  mode,
  modeLabel,
  players,
  setPlayers,
  nextId,
  onBack,
  onResetAll,
  onMessage,
  onGenerate,
  activeTab,
  setActiveTab,
  targetMatchCount,
  setTargetMatchCount,
  courtCount,
  setCourtCount,
  schedule,
  setSchedule,
  leagueInfo,
  onUpdateLeagueInfo,
  friendlyUnderTargetPlayers = [],
  friendlyScoreboard = [],
  onAddFriendlyManualMatch,
  rivalryUnderTargetPlayers = [],
  rivalryScoreboard = { teams: [], winnerTeamName: "", isTie: false },
  onAddRivalryManualMatch,
  tournamentBoards = [],
  winningScore = 25,
}) {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    secondName: "",
    gender: "M",
    secondGender: "M",
    grade: "C",
    ageGroup: "40대",
    rivalryTeam: "A팀",
  });

  const safePlayers = useMemo(() => players || [], [players]);
  const rivalryTeamBoards = useMemo(() => {
    if (mode !== "rivalry") return [];

    const teamMap = new Map();
    safePlayers.forEach((player, index) => {
      const teamName = String(player?.rivalryTeam || "").trim() || "A팀";
      const pairId = String(player?.pairId || player?.pairName || `${teamName}-single-${index}`);
      const pairName = String(player?.pairName || "").trim() || getPlayerName(player);
      const teamEntry = teamMap.get(teamName) || { name: teamName, pairs: new Map(), players: [] };
      const pairEntry = teamEntry.pairs.get(pairId) || {
        id: pairId,
        label: pairName,
        players: [],
        pairType: resolvePairType({ players: [player] }),
      };

      pairEntry.players.push(player);
      pairEntry.pairType = resolvePairType({ players: pairEntry.players });
      teamEntry.pairs.set(pairId, pairEntry);
      teamEntry.players.push(player);
      teamMap.set(teamName, teamEntry);
    });

    return Array.from(teamMap.values())
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"))
      .map((team) => ({
        ...team,
        pairs: Array.from(team.pairs.values()).sort((a, b) =>
          String(a.label || "").localeCompare(String(b.label || ""), "ko")
        ),
      }));
  }, [mode, safePlayers]);
  const leagueTeams = useMemo(() => safeArray(leagueInfo?.teams), [leagueInfo]);
  const leagueReserveGroups = useMemo(() => {
    const grouped = { M: [], F: [], U: [] };

    leagueTeams.forEach((team, teamIndex) => {
      const teamId = team?.id || `team-${teamIndex}`;
      const teamName = team?.name || `팀 ${teamIndex + 1}`;

      safeArray(team?.leftovers).forEach((player, playerIndex) => {
        const name = getPlayerName(player);
        if (!name) return;

        const normalizedGender = normalizeGender(player?.gender);
        grouped[normalizedGender] = grouped[normalizedGender] || [];
        grouped[normalizedGender].push({
          id: getPlayerKey(player, playerIndex) || `${teamId}-reserve-${playerIndex}`,
          name,
          teamName,
          sourceTeamId: teamId,
          player,
        });
      });
    });

    return [
      { key: "M", label: getGenderGroupLabel("M"), players: grouped.M },
      { key: "F", label: getGenderGroupLabel("F"), players: grouped.F },
      { key: "U", label: getGenderGroupLabel("U"), players: grouped.U },
    ].filter((group) => group.players.length > 0);
  }, [leagueTeams]);
  const [pairForms, setPairForms] = useState({});
  const [reserveAssignments, setReserveAssignments] = useState({});
  const [friendlyMatchForm, setFriendlyMatchForm] = useState({
    a1: "",
    a2: "",
    b1: "",
    b2: "",
  });
  const [pasteText, setPasteText] = useState("");
  const [isNarrowScreen, setIsNarrowScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth <= 640);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getTeamForm = (teamId) => pairForms[teamId] || { first: "", second: "" };
  const setTeamForm = (teamId, next) => {
    setPairForms((prev) => ({
      ...prev,
      [teamId]: { ...getTeamForm(teamId), ...next },
    }));
  };
  const getReserveAssignKey = (player) =>
    `${player?.sourceTeamId || "team"}:${player?.id || player?.name || "reserve"}`;
  const getReserveTargetTeamId = (player) => reserveAssignments[getReserveAssignKey(player)] || "";
  const setReserveTargetTeamId = (player, teamId) => {
    const key = getReserveAssignKey(player);
    setReserveAssignments((prev) => ({
      ...prev,
      [key]: teamId,
    }));
  };
  const setFriendlyMatchField = (key, value) => {
    setFriendlyMatchForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const findPlayerByNameInTeam = (team, name) => {
    const target = String(name || "").trim();
    if (!target) return null;
    return [...safeArray(team?.players), ...safeArray(team?.leftovers)].find(
      (player) => getPlayerName(player) === target
    );
  };

  const findPlayerInLeague = (targetTeamId, name) => {
    const target = String(name || "").trim();
    if (!target) return null;

    for (let teamIndex = 0; teamIndex < leagueTeams.length; teamIndex += 1) {
      const team = leagueTeams[teamIndex];
      const sourceTeamId = team?.id || `team-${teamIndex}`;
      if (sourceTeamId === targetTeamId) continue;

      const player = [...safeArray(team?.players), ...safeArray(team?.leftovers)].find(
        (item) => getPlayerName(item) === target
      );
      if (player) {
        const sourcePair = safeArray(team?.pairs).find((pair) =>
          safeArray(pair?.players).some((member) => getPlayerName(member) === target)
        );
        return { player, sourceTeamId, sourcePairId: sourcePair?.id || null };
      }
    }

    return null;
  };

  const getTeamTargetMatchCount = (team) =>
    Math.max(1, Number(team?.targetMatchCount ?? targetMatchCount) || 1);

  const pruneTeamForMovedNames = (targetTeam, namesToMove) => {
    const movedNames = new Set(
      safeArray(namesToMove)
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    );
    if (movedNames.size === 0) return targetTeam;

    const sourcePlayers = safeArray(targetTeam?.players);
    const sourceLeftovers = safeArray(targetTeam?.leftovers);
    const sourcePairs = safeArray(targetTeam?.pairs);
    const remainingPairPartners = [];

    const prunedPairs = sourcePairs.filter((pair) => {
      const pairPlayers = safeArray(pair?.players);
      const hasMovedPlayer = pairPlayers.some((member) => movedNames.has(getPlayerName(member)));
      if (!hasMovedPlayer) return true;

      pairPlayers.forEach((member) => {
        const memberName = getPlayerName(member);
        if (memberName && !movedNames.has(memberName)) {
          remainingPairPartners.push(member);
        }
      });

      return false;
    });

    const remainingPartnerNames = new Set(remainingPairPartners.map(getPlayerName).filter(Boolean));
    const prunedPlayers = sourcePlayers.filter((player) => {
      const name = getPlayerName(player);
      return name && !movedNames.has(name) && !remainingPartnerNames.has(name);
    });
    const prunedLeftovers = sourceLeftovers.filter((player) => {
      const name = getPlayerName(player);
      return name && !movedNames.has(name);
    });
    const leftoverNames = new Set(prunedLeftovers.map(getPlayerName).filter(Boolean));

    remainingPairPartners.forEach((player) => {
      const name = getPlayerName(player);
      if (!name || leftoverNames.has(name)) return;
      prunedLeftovers.push(player);
      leftoverNames.add(name);
    });

    return {
      ...targetTeam,
      players: prunedPlayers,
      pairs: prunedPairs,
      leftovers: prunedLeftovers,
    };
  };

  const updateLeagueTeam = (teamId, updater) => {
    if (!onUpdateLeagueInfo || !leagueInfo?.teams) return;

    const nextLeagueInfo = {
      ...leagueInfo,
      teams: safeArray(leagueInfo?.teams).map((targetTeam) => {
        if (targetTeam?.id !== teamId) return targetTeam;
        return updater(targetTeam);
      }),
    };

    onUpdateLeagueInfo(nextLeagueInfo);
  };

  const handleTeamTargetMatchCountChange = (team, value) => {
    if (!team?.id) return;
    const nextTarget = Math.max(1, Number(value) || 1);
    updateLeagueTeam(team.id, (targetTeam) => ({
      ...targetTeam,
      targetMatchCount: nextTarget,
    }));
  };

  const addManualPairToTeam = (team) => {
    if (!onUpdateLeagueInfo || !team?.id) return;

    const teamId = team.id;
    const form = getTeamForm(teamId);
    const firstName = String(form.first || "").trim();
    const secondName = String(form.second || "").trim();
    if (!firstName || !secondName || firstName === secondName) return;

    const firstLeaguePlayer = findPlayerInLeague(teamId, firstName);
    const secondLeaguePlayer = findPlayerInLeague(teamId, secondName);
    const firstPlayer =
      findPlayerByNameInTeam(team, firstName) ||
      firstLeaguePlayer?.player ||
      createLeagueManualPlayer(firstName, team, 0);
    const secondPlayer =
      findPlayerByNameInTeam(team, secondName) ||
      secondLeaguePlayer?.player ||
      createLeagueManualPlayer(secondName, team, 1, firstPlayer?.gender);
    const nextPair = {
      id: `${teamId}-manual-pair-${Date.now()}`,
      players: [firstPlayer, secondPlayer],
      pairType: String(team?.preferredPairType || "").trim(),
      isManual: true,
    };

    const nextLeagueInfo = {
      ...leagueInfo,
      teams: safeArray(leagueInfo?.teams).map((targetTeam, targetIndex) => {
        const targetTeamId = targetTeam?.id || `team-${targetIndex}`;
        const namesToMove = [];
        if (targetTeamId === teamId) {
          namesToMove.push(firstName, secondName);
        }
        if (firstLeaguePlayer?.sourceTeamId === targetTeamId) {
          namesToMove.push(firstName);
        }
        if (secondLeaguePlayer?.sourceTeamId === targetTeamId) {
          namesToMove.push(secondName);
        }

        const prunedTeam = pruneTeamForMovedNames(targetTeam, namesToMove);
        const prunedPlayers = safeArray(prunedTeam?.players);
        const prunedLeftovers = safeArray(prunedTeam?.leftovers);
        const prunedPairs = safeArray(prunedTeam?.pairs);

        if (targetTeamId !== teamId) {
          return prunedTeam;
        }

        const existingNames = new Set(prunedPlayers.map(getPlayerName));
        const nextPlayers = [...prunedPlayers];
        if (!existingNames.has(getPlayerName(firstPlayer))) nextPlayers.push(firstPlayer);
        if (!existingNames.has(getPlayerName(secondPlayer))) nextPlayers.push(secondPlayer);

        return {
          ...targetTeam,
          players: nextPlayers,
          pairs: [...prunedPairs, nextPair],
          leftovers: prunedLeftovers,
        };
      }),
    };

    onUpdateLeagueInfo(nextLeagueInfo);
    setTeamForm(teamId, { first: "", second: "" });
  };

  const removeManualPairFromTeam = (team, pair) => {
    if (!onUpdateLeagueInfo || !team?.id || !pair?.id) return;

    const removablePlayers = safeArray(pair?.players).filter(
      (player) => player?.isManualEntry || player?.isManualAssigned
    );
    const removablePlayerNames = new Set(removablePlayers.map(getPlayerName).filter(Boolean));

    const nextLeagueInfo = {
      ...leagueInfo,
      teams: safeArray(leagueInfo?.teams).map((targetTeam, targetIndex) => {
        const targetTeamId = targetTeam?.id || `team-${targetIndex}`;
        if (targetTeamId !== team.id) return targetTeam;

        const nextPairs = safeArray(targetTeam?.pairs).filter((item) => item?.id !== pair.id);
        const remainingReferencedNames = new Set(
          nextPairs.flatMap((item) => safeArray(item?.players).map(getPlayerName).filter(Boolean))
        );
        const nextPlayers = safeArray(targetTeam?.players).filter((player) => {
          const name = getPlayerName(player);
          if (!name) return false;
          if (!removablePlayerNames.has(name)) return true;
          return remainingReferencedNames.has(name);
        });
        const nextLeftovers = safeArray(targetTeam?.leftovers).filter((player) => {
          const name = getPlayerName(player);
          if (!name) return false;
          if (!removablePlayerNames.has(name)) return true;
          return remainingReferencedNames.has(name);
        });
        const leftoverNames = new Set(nextLeftovers.map(getPlayerName).filter(Boolean));
        removablePlayers.forEach((player) => {
          const name = getPlayerName(player);
          if (!name || remainingReferencedNames.has(name) || leftoverNames.has(name)) return;
          nextLeftovers.push({
            ...player,
            sourceTeamId: player?.sourceTeamId || targetTeamId,
            isManualAssigned: true,
          });
          leftoverNames.add(name);
        });

        return {
          ...targetTeam,
          players: nextPlayers,
          pairs: nextPairs,
          leftovers: nextLeftovers,
        };
      }),
    };

    onUpdateLeagueInfo(nextLeagueInfo);
  };

  const assignReservePlayerToTeam = (reservePlayer) => {
    if (!onUpdateLeagueInfo || !reservePlayer?.name) return;

    const targetTeamId = getReserveTargetTeamId(reservePlayer);
    if (!targetTeamId) return;
    const nextReservePlayer = {
      ...(reservePlayer.player || { name: reservePlayer.name, gender: "U" }),
      name: reservePlayer.name,
      isManualAssigned: true,
    };

    const nextLeagueInfo = {
      ...leagueInfo,
      teams: safeArray(leagueInfo?.teams).map((team, teamIndex) => {
        const currentTeamId = team?.id || `team-${teamIndex}`;
        const prunedTeam =
          currentTeamId === reservePlayer.sourceTeamId
            ? pruneTeamForMovedNames(team, [reservePlayer.name])
            : team;

        if (currentTeamId !== targetTeamId) {
          return prunedTeam;
        }

        const nextPlayers = [...safeArray(prunedTeam?.players)];
        const nextLeftovers = safeArray(prunedTeam?.leftovers).filter(
          (player) => getPlayerName(player) !== reservePlayer.name
        );
        const nextPairs = [...safeArray(prunedTeam?.pairs)];
        const existingNames = new Set(nextPlayers.map(getPlayerName));
        if (!existingNames.has(reservePlayer.name)) {
          nextPlayers.push(nextReservePlayer);
        }

        const pairedNames = new Set(
          nextPairs.flatMap((pair) => safeArray(pair?.players).map(getPlayerName).filter(Boolean))
        );
        const partnerCandidate = nextPlayers.find((player) => {
          const name = getPlayerName(player);
          if (!name || name === reservePlayer.name) return false;
          if (pairedNames.has(name)) return false;
          return Boolean(player?.isManualAssigned);
        });

        if (partnerCandidate && !pairedNames.has(reservePlayer.name)) {
          nextPairs.push({
            id: `${currentTeamId}-manual-reserve-pair-${Date.now()}`,
            players: [partnerCandidate, nextReservePlayer],
            pairType: String(prunedTeam?.preferredPairType || "").trim(),
            isManual: true,
          });
        }

        return {
          ...prunedTeam,
          players: nextPlayers,
          pairs: nextPairs,
          leftovers: nextLeftovers,
        };
      }),
    };

    onUpdateLeagueInfo(nextLeagueInfo);
    setReserveAssignments((prev) => {
      const next = { ...prev };
      delete next[getReserveAssignKey(reservePlayer)];
      return next;
    });
  };

  const handleAddFriendlyManualMatch = () => {
    if (mode !== "friendly" || typeof onAddFriendlyManualMatch !== "function") return;

    const didAdd = onAddFriendlyManualMatch({
      teamA: [friendlyMatchForm.a1, friendlyMatchForm.a2],
      teamB: [friendlyMatchForm.b1, friendlyMatchForm.b2],
    });

    if (!didAdd) return;

    setFriendlyMatchForm({
      a1: "",
      a2: "",
      b1: "",
      b2: "",
    });
    onMessage?.("친선전 수동 대진을 추가했습니다.");
  };

  const renderLeagueReservePanel = () => {
    if (mode !== "league" || leagueReserveGroups.length === 0) return null;

    return (
      <div style={styles.reservePanel}>
        <div style={styles.teamPanelHeader}>
          <h2 style={styles.teamPanelTitle}>예비 선수</h2>
          <div style={styles.teamPanelSub}>팀 미배치 선수를 성별 기준으로 모았습니다.</div>
        </div>

        <div style={styles.reservePanelBody}>
          {leagueReserveGroups.map((group) => (
            <div key={group.key} style={styles.reserveGroupCard}>
              <div style={styles.reserveGroupTitle}>{group.label}</div>
              <div style={styles.reserveChipWrap}>
                {group.players.map((player) => (
                  <div key={`${group.key}-${player.id}-${player.name}`} style={styles.reserveChip}>
                    <span>{player.name}</span>
                    <span style={styles.reserveChipMeta}>{player.teamName}</span>
                    <div style={styles.reserveAssignRow}>
                      <select
                        style={styles.reserveAssignSelect}
                        value={getReserveTargetTeamId(player)}
                        onChange={(e) => setReserveTargetTeamId(player, e.target.value)}
                      >
                        <option value="">팀 선택</option>
                        {leagueTeams.map((team, teamIndex) => {
                          const teamId = team?.id || `team-${teamIndex}`;
                          return (
                            <option key={`${player.id}-${teamId}`} value={teamId}>
                              {team?.name || `팀 ${teamIndex + 1}`}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        style={styles.reserveAssignButton}
                        onClick={() => assignReservePlayerToTeam(player)}
                        disabled={!getReserveTargetTeamId(player)}
                      >
                        팀 배정
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFriendlyAssistPanel = () => {
    if (mode !== "friendly") return null;

    return (
      <>
        <div style={styles.teamPanel}>
          <div style={styles.teamPanelHeader}>
            <h2 style={styles.teamPanelTitle}>친선전 개인 순위</h2>
            <div style={styles.teamPanelSub}>개인 승점 기준으로 순위를 집계합니다.</div>
          </div>

          <div style={styles.teamPanelBody}>
            {friendlyScoreboard.length === 0 ? (
              <div style={styles.friendlyStatusText}>점수를 입력하면 개인 순위가 집계됩니다.</div>
            ) : (
              <div style={styles.pairBlock}>
                {friendlyScoreboard.map((player, playerIndex) => (
                  <div
                    key={player?.id || `${player?.name || "friendly-score"}-${playerIndex}`}
                    style={styles.pairLine}
                  >
                    {playerIndex + 1}위 {player?.name || "-"}
                    {` · 승점 ${player?.points || 0} · 승 ${player?.win || 0} / 패 ${player?.lose || 0}`}
                    {player?.draw ? ` / 무 ${player.draw}` : ""}
                    {` · 득실 ${player?.diff || 0}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.teamPanel}>
          <div style={styles.teamPanelHeader}>
            <h2 style={styles.teamPanelTitle}>목표 경기 미달 선수</h2>
            <div style={styles.teamPanelSub}>
              개인 목표 경기 {safeTargetMatchCount}회에 못 미친 선수를 표시합니다.
            </div>
          </div>

          <div style={styles.teamPanelBody}>
            {friendlyUnderTargetPlayers.length === 0 ? (
              <div style={styles.friendlyStatusText}>모든 선수가 목표 경기 수를 채웠습니다.</div>
            ) : (
              <div style={styles.friendlyProgressList}>
                {friendlyUnderTargetPlayers.map((player, playerIndex) => (
                  <div
                    key={`${player?.id || player?.name || "friendly"}-${playerIndex}`}
                    style={styles.friendlyProgressRow}
                  >
                    <div style={styles.friendlyProgressName}>{player?.name || "-"}</div>
                    <div style={styles.friendlyProgressMeta}>
                      {player?.assignedCount || 0}/{safeTargetMatchCount}경기
                      {player?.remainingCount > 0 ? ` · ${player.remainingCount}경기 부족` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.friendlyMatchEditor}>
              <div style={styles.teamPanelTitle}>직접 대진 추가</div>
              <div style={styles.teamPanelSub}>
                등록된 선수 이름 4명을 직접 입력하면 친선전 대진표에 바로 추가합니다.
              </div>

              <div style={styles.friendlyMatchTeamTitle}>팀 A</div>
              <div style={styles.friendlyMatchEditorGrid}>
                <input
                  style={styles.pairEditorInput}
                  placeholder="선수 1"
                  value={friendlyMatchForm.a1}
                  onChange={(e) => setFriendlyMatchField("a1", e.target.value)}
                />
                <input
                  style={styles.pairEditorInput}
                  placeholder="선수 2"
                  value={friendlyMatchForm.a2}
                  onChange={(e) => setFriendlyMatchField("a2", e.target.value)}
                />
              </div>

              <div style={styles.friendlyMatchTeamTitle}>팀 B</div>
              <div style={styles.friendlyMatchEditorGrid}>
                <input
                  style={styles.pairEditorInput}
                  placeholder="선수 3"
                  value={friendlyMatchForm.b1}
                  onChange={(e) => setFriendlyMatchField("b1", e.target.value)}
                />
                <input
                  style={styles.pairEditorInput}
                  placeholder="선수 4"
                  value={friendlyMatchForm.b2}
                  onChange={(e) => setFriendlyMatchField("b2", e.target.value)}
                />
              </div>

              <button
                type="button"
                style={styles.pairEditorButton}
                onClick={handleAddFriendlyManualMatch}
              >
                대진 추가
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderFriendlyPlayerListPanel = () => {
    if (mode !== "friendly") return null;

    return (
      <div style={styles.teamPanel}>
        <div style={styles.teamPanelHeader}>
          <h2 style={styles.teamPanelTitle}>선수 목록</h2>
          <div style={styles.teamPanelSub}>친선전 등록 선수 {safePlayers.length}명</div>
        </div>

        <div style={styles.teamPanelBody}>
          {safePlayers.length === 0 ? (
            <div style={styles.friendlyStatusText}>등록된 선수가 없습니다.</div>
          ) : (
            <div style={styles.playerList}>
              {safePlayers.map((player, playerIndex) => (
                <div
                  key={`${player?.id || player?.name || "friendly-player"}-${playerIndex}`}
                  style={styles.playerChip}
                >
                  {getPlayerName(player)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleAddRivalryManualMatch = () => {
    if (mode !== "rivalry" || typeof onAddRivalryManualMatch !== "function") return;

    const added = onAddRivalryManualMatch({
      teamA: [friendlyMatchForm.a1, friendlyMatchForm.a2],
      teamB: [friendlyMatchForm.b1, friendlyMatchForm.b2],
    });

    if (added) {
      setFriendlyMatchForm({
        a1: "",
        a2: "",
        b1: "",
        b2: "",
      });
    }
  };

  const renderRivalryTeamPanel = () => {
    if (mode !== "rivalry") return null;

    return (
      <>
        <div style={styles.teamPanel}>
          <div style={styles.teamPanelHeader}>
            <h2 style={styles.teamPanelTitle}>대항전 점수판</h2>
            <div style={styles.teamPanelSub}>
              {rivalryScoreboard?.isTie
                ? "현재 두 팀이 동률입니다."
                : rivalryScoreboard?.winnerTeamName
                ? `현재 승리 팀: ${rivalryScoreboard.winnerTeamName}`
                : "점수 입력 후 승리 팀이 표시됩니다."}
            </div>
          </div>

          <div style={styles.teamPanelBody}>
            {safeArray(rivalryScoreboard?.teams).length === 0 ? (
              <div style={styles.friendlyStatusText}>대항전 점수를 입력하면 팀 승점이 집계됩니다.</div>
            ) : (
              safeArray(rivalryScoreboard?.teams).map((team, teamIndex) => (
                <div key={team?.name || `rivalry-score-${teamIndex}`} style={styles.teamCard}>
                  <div style={styles.teamCardHead}>
                    <div style={styles.teamName}>{team?.name || `팀 ${teamIndex + 1}`}</div>
                    <div style={styles.teamMeta}>
                      승점 {team?.points || 0} · 승 {team?.win || 0} / 패 {team?.lose || 0}
                      {team?.draw ? ` / 무 ${team.draw}` : ""} · 득실 {team?.diff || 0}
                    </div>
                  </div>

                  {safeArray(team?.players).length === 0 ? (
                    <div style={styles.friendlyStatusText}>집계된 개인 승점이 없습니다.</div>
                  ) : (
                    <div style={styles.pairBlock}>
                      {safeArray(team?.players).map((player, playerIndex) => (
                        <div key={player?.id || `${team?.name}-score-player-${playerIndex}`} style={styles.pairLine}>
                          {playerIndex + 1}번 {player?.name || "-"}
                          {` · 승점 ${player?.points || 0} · 승 ${player?.win || 0} / 패 ${player?.lose || 0}`}
                          {player?.draw ? ` / 무 ${player.draw}` : ""}
                          {` · 득실 ${player?.diff || 0}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.teamPanel}>
          <div style={styles.teamPanelHeader}>
            <h2 style={styles.teamPanelTitle}>팀별 선수</h2>
            <div style={styles.teamPanelSub}>A팀과 B팀의 자동 조와 선수 목록입니다.</div>
          </div>

          <div style={styles.teamPanelBody}>
            {rivalryTeamBoards.length === 0 ? (
              <div style={styles.friendlyStatusText}>등록된 대항전 조가 없습니다.</div>
            ) : (
              rivalryTeamBoards.map((team, teamIndex) => (
                <div key={team.name || `rivalry-team-${teamIndex}`} style={styles.teamCard}>
                  <div style={styles.teamCardHead}>
                    <div style={styles.teamName}>{team.name}</div>
                    <div style={styles.teamMeta}>
                      {team.pairs.length}조 · {team.players.length}명
                    </div>
                  </div>

                  {team.pairs.length > 0 ? (
                    <div style={styles.pairBlock}>
                      {team.pairs.map((pair, pairIndex) => (
                        <div key={pair.id || `${team.name}-pair-${pairIndex}`} style={styles.pairLine}>
                          {pairIndex + 1}조 {pair.label}
                          {pair.pairType ? ` (${pair.pairType})` : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div style={styles.playerList}>
                    {team.players.map((player, playerIndex) => (
                      <div
                        key={`${team.name}-player-${player?.id || playerIndex}`}
                        style={styles.playerChip}
                      >
                        {getPlayerName(player)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  const renderRivalryAssistPanel = () => {
    if (mode !== "rivalry") return null;

    return (
      <div style={styles.teamPanel}>
        <div style={styles.teamPanelHeader}>
          <h2 style={styles.teamPanelTitle}>목표 경기 미달 선수</h2>
          <div style={styles.teamPanelSub}>
            개인 목표 경기 {safeTargetMatchCount}회에 못 미친 선수를 표시합니다.
          </div>
        </div>

        <div style={styles.teamPanelBody}>
          {rivalryUnderTargetPlayers.length === 0 ? (
            <div style={styles.friendlyStatusText}>모든 선수가 목표 경기 수를 채웠습니다.</div>
          ) : (
            <div style={styles.friendlyProgressList}>
              {rivalryUnderTargetPlayers.map((player, playerIndex) => (
                <div
                  key={`${player?.id || player?.name || "rivalry"}-${playerIndex}`}
                  style={styles.friendlyProgressRow}
                >
                  <div style={styles.friendlyProgressName}>
                    {player?.name || "-"}{" "}
                    <span style={styles.reserveChipMeta}>{player?.rivalryTeam || ""}</span>
                  </div>
                  <div style={styles.friendlyProgressMeta}>
                    {player?.assignedCount || 0}/{safeTargetMatchCount}경기
                    {player?.remainingCount > 0 ? ` · ${player.remainingCount}경기 부족` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.friendlyMatchEditor}>
            <div style={styles.teamPanelTitle}>직접 대진 추가</div>
            <div style={styles.teamPanelSub}>
              목표 경기 수를 초과한 선수도 포함해서 수동으로 대항전 경기를 추가할 수 있습니다.
            </div>

            <div style={styles.friendlyMatchTeamTitle}>A팀 조</div>
            <div style={styles.friendlyMatchEditorGrid}>
              <input
                style={styles.pairEditorInput}
                placeholder="A팀 선수 1"
                value={friendlyMatchForm.a1}
                onChange={(e) => setFriendlyMatchField("a1", e.target.value)}
              />
              <input
                style={styles.pairEditorInput}
                placeholder="A팀 선수 2"
                value={friendlyMatchForm.a2}
                onChange={(e) => setFriendlyMatchField("a2", e.target.value)}
              />
            </div>

            <div style={styles.friendlyMatchTeamTitle}>B팀 조</div>
            <div style={styles.friendlyMatchEditorGrid}>
              <input
                style={styles.pairEditorInput}
                placeholder="B팀 선수 1"
                value={friendlyMatchForm.b1}
                onChange={(e) => setFriendlyMatchField("b1", e.target.value)}
              />
              <input
                style={styles.pairEditorInput}
                placeholder="B팀 선수 2"
                value={friendlyMatchForm.b2}
                onChange={(e) => setFriendlyMatchField("b2", e.target.value)}
              />
            </div>

            <button
              type="button"
              style={styles.pairEditorButton}
              onClick={handleAddRivalryManualMatch}
            >
              대진 추가
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTournamentBoardPanel = () => {
    if (mode !== "tournament") return null;

    return (
      <div style={styles.teamPanel}>
        <div style={styles.teamPanelHeader}>
          <h2 style={styles.teamPanelTitle}>대회 참가조</h2>
          <div style={styles.teamPanelSub}>종목 · 연령대 · 급수 기준으로 생성된 고정조 목록입니다.</div>
        </div>

        <div style={styles.teamPanelBody}>
          {tournamentBoards.length === 0 ? (
            <div style={styles.friendlyStatusText}>대회 대진표를 생성하면 참가조가 표시됩니다.</div>
          ) : (
            tournamentBoards.map((board, boardIndex) => (
              <div key={board?.id || `tournament-board-${boardIndex}`} style={styles.teamCard}>
                <div style={styles.teamCardHead}>
                  <div style={styles.teamName}>{board?.name || `대회 분류 ${boardIndex + 1}`}</div>
                  <div style={styles.teamMeta}>
                    {board?.stage || ""}{board?.poolName ? ` · ${board.poolName}` : ""}
                  </div>
                </div>

                {board?.stage === "예선" ? (
                  <>
                    {safeArray(board?.pairs).length > 0 ? (
                        <div style={styles.pairBlock}>
                          {safeArray(board?.pairs).map((pair, pairIndex) => (
                            <div key={pair?.id || `${board?.id}-pair-${pairIndex}`} style={styles.pairLine}>
                              {pairIndex + 1}팀 {pair?.label || "-"}
                              {pair?.pairType ? ` (${pair.pairType})` : ""}
                              {typeof pair?.score !== "undefined" ? ` · ${pair.score}점` : ""}
                              {typeof pair?.win !== "undefined"
                              ? ` · 승 ${pair.win || 0} / 패 ${pair.lose || 0} / 득실 ${(pair.scored || 0) - (pair.allowed || 0)}`
                              : ""}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.friendlyStatusText}>표시할 예선 참가조가 없습니다.</div>
                    )}
                  </>
                ) : (
                  <div style={styles.friendlyStatusText}>
                    본선 브래킷은 오른쪽 대진표에서 확인하세요.
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const handleAddPlayer = () => {
    const firstName = String(form.name || "").trim();
    const secondName = String(form.secondName || "").trim();

    if (mode === "tournament") {
      if (!firstName || !secondName || firstName === secondName) return;

      const nextBaseId = nextId;
      const pairId = `${mode}-pair-manual-${Date.now()}-${nextBaseId}`;
      const pairName = `${firstName} / ${secondName}`;
      const nextPlayers = [
        {
          id: nextBaseId,
          name: firstName,
          gender: form.gender,
          grade: form.grade,
          ageGroup: form.ageGroup,
          age: parseAgeFromAgeGroup(form.ageGroup),
          baseScore: getBaseScoreByGenderAndGrade(form.gender, form.grade),
          pairId,
          pairName,
          rivalryTeam: form.rivalryTeam,
        },
        {
          id: nextBaseId + 1,
          name: secondName,
          gender: form.secondGender,
          grade: form.grade,
          ageGroup: form.ageGroup,
          age: parseAgeFromAgeGroup(form.ageGroup),
          baseScore: getBaseScoreByGenderAndGrade(form.secondGender, form.grade),
          pairId,
          pairName,
          rivalryTeam: form.rivalryTeam,
        },
      ];

      setPlayers([...safePlayers, ...nextPlayers]);
      setForm({
        name: "",
        secondName: "",
        gender: "M",
        secondGender: "M",
        grade: "C",
        ageGroup: "40대",
        rivalryTeam: "A팀",
      });
      return;
    }

    if (mode === "rivalry") {
      if (!firstName) return;

      const newPlayer = {
        id: nextId,
        name: firstName,
        gender: form.gender,
        grade: form.grade,
        ageGroup: form.ageGroup,
        age: parseAgeFromAgeGroup(form.ageGroup),
        baseScore: getBaseScoreByGenderAndGrade(form.gender, form.grade),
        rivalryTeam: form.rivalryTeam,
      };

      setPlayers([...safePlayers, newPlayer]);
      setForm({
        name: "",
        secondName: "",
        gender: "M",
        secondGender: "M",
        grade: "C",
        ageGroup: "40대",
        rivalryTeam: form.rivalryTeam,
      });
      return;
    }

    if (!firstName) return;

    const newPlayer = {
      id: nextId,
      name: firstName,
      gender: form.gender,
      grade: form.grade,
      ageGroup: form.ageGroup,
      age: parseAgeFromAgeGroup(form.ageGroup),
      baseScore: getBaseScoreByGenderAndGrade(form.gender, form.grade),
    };

    setPlayers([...safePlayers, newPlayer]);

    setForm({
      name: "",
      secondName: "",
      gender: "M",
      secondGender: "M",
      grade: "C",
      ageGroup: "40대",
      rivalryTeam: "A팀",
    });
  };

  const handleDeletePlayer = (id) => {
    const targetPlayer = safePlayers.find((player) => player.id === id);
    if (mode === "tournament" && targetPlayer?.pairId) {
      setPlayers(safePlayers.filter((player) => player.pairId !== targetPlayer.pairId));
      return;
    }
    setPlayers(safePlayers.filter((p) => p.id !== id));
  };

  const splitPasteLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return [];
    if (trimmed.includes("\t")) {
      return trimmed.split("\t").map((part) => part.trim()).filter(Boolean);
    }
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    }
    if (trimmed.includes("|")) {
      return trimmed.split("|").map((part) => part.trim()).filter(Boolean);
    }
    return trimmed.split(/\s+/).map((part) => part.trim()).filter(Boolean);
  };

  const handlePasteRegister = () => {
    const lines = String(pasteText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      onMessage?.("붙여넣을 명단이 없습니다.");
      return;
    }

    const nextPlayers = [];
    let nextIdValue = nextId;

    const pushSinglePlayer = ({
      name,
      gender = form.gender,
      grade = form.grade,
      ageGroup = form.ageGroup,
      rivalryTeam = form.rivalryTeam,
    }) => {
      const safeName = String(name || "").trim();
      if (!safeName) return;
      const safeGender = normalizeGender(gender) || "U";
      const safeGrade = String(grade || form.grade || "C").trim().toUpperCase() || "C";
      const safeAgeGroup = String(ageGroup || form.ageGroup || "40대").trim() || "40대";

      nextPlayers.push({
        id: nextIdValue++,
        name: safeName,
        gender: safeGender,
        grade: safeGrade,
        ageGroup: safeAgeGroup,
        age: parseAgeFromAgeGroup(safeAgeGroup),
        baseScore: getBaseScoreByGenderAndGrade(safeGender, safeGrade),
        ...(mode === "rivalry"
          ? { rivalryTeam: normalizeRivalryTeamLabel(rivalryTeam, form.rivalryTeam) }
          : {}),
      });
    };

    const pushPairPlayers = ({
      firstName,
      firstGender,
      secondName,
      secondGender,
      grade = form.grade,
      ageGroup = form.ageGroup,
      rivalryTeam = form.rivalryTeam,
      pairName = "",
    }) => {
      const aName = String(firstName || "").trim();
      const bName = String(secondName || "").trim();
      if (!aName || !bName || aName === bName) return;
      const safeGrade = String(grade || form.grade || "C").trim().toUpperCase() || "C";
      const safeAgeGroup = String(ageGroup || form.ageGroup || "40대").trim() || "40대";
      const pairId = `${mode}-pair-paste-${Date.now()}-${nextIdValue}`;
      const safePairName = String(pairName || `${aName} / ${bName}`).trim();

      const commonFields = {
        grade: safeGrade,
        ageGroup: safeAgeGroup,
        age: parseAgeFromAgeGroup(safeAgeGroup),
        pairId,
        pairName: safePairName,
        ...(mode === "tournament"
          ? {}
          : { rivalryTeam: normalizeRivalryTeamLabel(rivalryTeam, form.rivalryTeam) }),
      };

      nextPlayers.push({
        id: nextIdValue++,
        name: aName,
        gender: normalizeGender(firstGender),
        baseScore: getBaseScoreByGenderAndGrade(firstGender, safeGrade),
        ...commonFields,
      });
      nextPlayers.push({
        id: nextIdValue++,
        name: bName,
        gender: normalizeGender(secondGender),
        baseScore: getBaseScoreByGenderAndGrade(secondGender, safeGrade),
        ...commonFields,
      });
    };

    lines.forEach((line, index) => {
      const columns = splitPasteLine(line);
      if (columns.length === 0) return;

      if (mode === "tournament") {
        if (columns.length >= 7) {
          pushPairPlayers({
            pairName: columns[0],
            firstName: columns[1],
            firstGender: columns[2],
            secondName: columns[3],
            secondGender: columns[4],
            grade: columns[5],
            ageGroup: columns[6],
          });
          return;
        }
        if (columns.length >= 6) {
          pushPairPlayers({
            firstName: columns[0],
            firstGender: columns[1],
            secondName: columns[2],
            secondGender: columns[3],
            grade: columns[4],
            ageGroup: columns[5],
          });
        }
        return;
      }

      if (mode === "rivalry") {
        if (columns.length >= 5) {
          pushSinglePlayer({
            rivalryTeam: columns[0],
            name: columns[1],
            gender: columns[2],
            grade: columns[3],
            ageGroup: columns[4],
          });
          return;
        }
        if (columns.length >= 4) {
          pushSinglePlayer({
            name: columns[0],
            gender: columns[1],
            grade: columns[2],
            ageGroup: columns[3],
            rivalryTeam: index % 2 === 0 ? "A팀" : "B팀",
          });
          return;
        }
      }

      if (columns.length >= 4) {
        pushSinglePlayer({
          name: columns[0],
          gender: columns[1],
          grade: columns[2],
          ageGroup: columns[3],
        });
        return;
      }

      pushSinglePlayer({
        name: columns[0],
        gender: columns[1] || form.gender,
        grade: columns[2] || form.grade,
        ageGroup: columns[3] || form.ageGroup,
      });
    });

    if (nextPlayers.length === 0) {
      onMessage?.(
        mode === "tournament"
          ? "붙여넣기 형식을 확인해주세요. 예: 선수1,남,선수2,여,C,40대"
          : mode === "rivalry"
            ? "붙여넣기 형식을 확인해주세요. 예: A팀,홍길동,남,C,40대"
            : "붙여넣기 형식을 확인해주세요. 예: 홍길동,남,C,40대"
      );
      return;
    }

    setPlayers([...safePlayers, ...nextPlayers]);
    setPasteText("");
    onMessage?.(
      `${mode === "tournament" ? "대회 조" : mode === "rivalry" ? "대항전 선수" : "선수"} ${
        nextPlayers.length
      }명이 붙여넣기로 등록되었습니다.`
    );
  };

  const handleTemplateDownload = () => {
    const rows =
      mode === "tournament"
        ? [
            {
              PairName: "A조",
              Player1: "선수1",
              Gender1: "M",
              Player2: "선수2",
              Gender2: "M",
              Grade: "C",
              AgeGroup: "40대",
            },
            {
              PairName: "B조",
              Player1: "선수3",
              Gender1: "F",
              Player2: "선수4",
              Gender2: "F",
              Grade: "C",
              AgeGroup: "40대",
            },
          ]
        : mode === "rivalry"
          ? [
              { Team: "A팀", Name: "선수1", Gender: "M", Grade: "C", AgeGroup: "40대" },
              { Team: "A팀", Name: "선수2", Gender: "M", Grade: "C", AgeGroup: "40대" },
              { Team: "B팀", Name: "선수3", Gender: "F", Grade: "C", AgeGroup: "40대" },
              { Team: "B팀", Name: "선수4", Gender: "F", Grade: "C", AgeGroup: "40대" },
            ]
        : [
            { Name: "Player A", Gender: "M", Grade: "C", AgeGroup: "40대" },
            { Name: "Player B", Gender: "F", Grade: "D", AgeGroup: "30대" },
          ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      mode === "tournament" ? "대회조" : mode === "rivalry" ? "대항전조" : "선수"
    );
    XLSX.writeFile(
      wb,
      mode === "tournament"
        ? "대회조등록템플릿.xlsx"
        : mode === "rivalry"
          ? "대항전조등록템플릿.xlsx"
          : "선수등록템플릿.xlsx"
    );
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const list =
        mode === "tournament"
          ? (() => {
              const pairRows = rows.flatMap((row, i) => {
                const grade = String(row["급수"] || row.Grade || row["등급"] || "").trim() || "C";
                const ageGroup =
                  String(row["연령대"] || row.AgeGroup || row["연령"] || "").trim() || "40대";
                const rivalryTeam =
                  mode === "rivalry"
                    ? normalizeRivalryTeamLabel(
                        row["팀"] || row.Team || row["소속팀"] || row["대항팀"] || row["팀명"] || "",
                        i % 2 === 0 ? "A팀" : "B팀"
                      )
                    : normalizeRivalryTeamLabel(
                        row["팀"] || row.Team || row["소속팀"] || row["대항팀"] || row["팀명"] || "",
                        "A팀"
                      );
                const firstName = String(
                  row["선수1"] ||
                    row["선수 1"] ||
                    row["선수A"] ||
                    row["참가자1"] ||
                    row.Player1 ||
                    row.FirstPlayer ||
                    ""
                ).trim();
                const secondName = String(
                  row["선수2"] ||
                    row["선수 2"] ||
                    row["선수B"] ||
                    row["참가자2"] ||
                    row.Player2 ||
                    row.SecondPlayer ||
                    ""
                ).trim();
                const firstGender = String(
                  row["선수1 성별"] ||
                    row["성별1"] ||
                    row["성별A"] ||
                    row.Gender1 ||
                    row.FirstGender ||
                    ""
                ).trim() || "M";
                const secondGender = String(
                  row["선수2 성별"] ||
                    row["성별2"] ||
                    row["성별B"] ||
                    row.Gender2 ||
                    row.SecondGender ||
                    ""
                ).trim() || "M";
                const pairName = String(
                  row["조이름"] ||
                    row["조 이름"] ||
                    row["조명"] ||
                    row["팀명"] ||
                    row.PairName ||
                    row.Pair ||
                    ""
                ).trim() || `${firstName} / ${secondName}`;

                if (!firstName || !secondName) return [];

                const pairId = `pair-xlsx-${i + 1}-${pairName}`;
                return [
                  {
                    id: i * 2 + 1,
                    name: firstName,
                    gender: firstGender,
                    grade,
                    ageGroup,
                    age: Number(row["나이"] || row.Age || 0) || parseAgeFromAgeGroup(ageGroup),
                    baseScore: getBaseScoreByGenderAndGrade(firstGender, grade),
                    pairId,
                    pairName,
                    rivalryTeam,
                  },
                  {
                    id: i * 2 + 2,
                    name: secondName,
                    gender: secondGender,
                    grade,
                    ageGroup,
                    age: Number(row["나이"] || row.Age || 0) || parseAgeFromAgeGroup(ageGroup),
                    baseScore: getBaseScoreByGenderAndGrade(secondGender, grade),
                    pairId,
                    pairName,
                    rivalryTeam,
                  },
                ];
              });

              if (pairRows.length > 0) return pairRows;

              const pairBuckets = new Map();
              rows.forEach((row, i) => {
                const pairName = String(
                  row["조이름"] ||
                    row["조 이름"] ||
                    row["조명"] ||
                    row["팀명"] ||
                    row.PairName ||
                    row.Pair ||
                    ""
                ).trim();
                const playerName = String(row["이름"] || row.Name || row["선수명"] || "").trim();
                if (!pairName || !playerName) return;

                const bucket = pairBuckets.get(pairName) || [];
                bucket.push({
                  id: i + 1,
                  name: playerName,
                  gender: String(row["성별"] || row.Gender || "").trim() || "M",
                  grade: String(row["급수"] || row.Grade || row["등급"] || "").trim() || "C",
                  ageGroup:
                    String(row["연령대"] || row.AgeGroup || row["연령"] || "").trim() || "40대",
                  pairId: `pair-xlsx-bucket-${pairName}`,
                  pairName,
                  rivalryTeam:
                    mode === "rivalry"
                      ? normalizeRivalryTeamLabel(
                          row["팀"] || row.Team || row["소속팀"] || row["대항팀"] || row["팀명"] || "",
                          pairBuckets.size % 2 === 0 ? "A팀" : "B팀"
                        )
                      : normalizeRivalryTeamLabel(
                          row["팀"] || row.Team || row["소속팀"] || row["대항팀"] || row["팀명"] || "",
                          "A팀"
                        ),
                });
                pairBuckets.set(pairName, bucket);
              });

              return Array.from(pairBuckets.values()).flatMap((bucket) => {
                if (bucket.length !== 2) return [];
                return bucket.map((player) => ({
                  ...player,
                  age: parseAgeFromAgeGroup(player.ageGroup),
                  baseScore: getBaseScoreByGenderAndGrade(player.gender, player.grade),
                }));
              });
            })()
          : mode === "rivalry"
            ? rows
                .map((row, i) => {
                  const teamValue = normalizeRivalryTeamLabel(
                    row["팀"] || row.Team || row["소속팀"] || row["대항팀"] || row["팀명"] || "",
                    i % 2 === 0 ? "A팀" : "B팀"
                  );
                  const name = String(
                    row["이름"] || row.Name || row["선수명"] || row["선수"] || ""
                  ).trim();
                  const gender = String(row["성별"] || row.Gender || "").trim() || "M";
                  const grade = String(row["급수"] || row.Grade || row["등급"] || "").trim() || "C";
                  const ageGroup =
                    String(row["연령대"] || row.AgeGroup || row["연령"] || "").trim() || "40대";
                  if (!name) return null;

                  return {
                    id: i + 1,
                    name,
                    gender,
                    grade,
                    ageGroup,
                    age: Number(row["나이"] || row.Age || 0) || parseAgeFromAgeGroup(ageGroup),
                    baseScore: getBaseScoreByGenderAndGrade(gender, grade),
                    rivalryTeam: teamValue,
                  };
                })
                .filter((player) => player && player.name)
          : rows
              .map((row, i) => ({
                id: i + 1,
                name: String(row["이름"] || row.Name || "").trim(),
                gender: String(row["성별"] || row.Gender || "").trim() || "M",
                grade: String(row["급수"] || row.Grade || "").trim() || "C",
                ageGroup: String(row["연령대"] || row.AgeGroup || "").trim() || "40대",
                age:
                  Number(row["나이"] || row.Age || 0) ||
                  parseAgeFromAgeGroup(String(row["연령대"] || row.AgeGroup || "").trim() || "40대"),
                baseScore: getBaseScoreByGenderAndGrade(
                  String(row["성별"] || row.Gender || "").trim() || "M",
                  String(row["급수"] || row.Grade || "").trim() || "C"
                ),
              }))
              .filter((player) => player.name);

      if (!Array.isArray(list) || list.length === 0) {
        onMessage?.(
          mode === "tournament" || mode === "rivalry"
            ? `${mode === "tournament" ? "대회" : "대항전"} 엑셀 형식을 확인해주세요. 2인 1조 컬럼 또는 조명 기준 2행 묶음이 필요합니다.`
            : "엑셀에서 읽을 선수 데이터가 없습니다."
        );
        return;
      }

      setPlayers(list);
      onMessage?.(
        `${
          mode === "tournament" ? "대회 조" : mode === "rivalry" ? "대항전 조" : "선수"
        } ${list.length}${
          mode === "tournament" || mode === "rivalry" ? "명(2인 1조 기준)" : "명"
        } 업로드를 반영했습니다.`
      );
    } catch (error) {
      console.error(error);
      onMessage?.("엑셀 업로드 중 오류가 발생했습니다. 템플릿 형식을 확인해주세요.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const safeTargetMatchCount = Math.max(1, Number(targetMatchCount) || 1);
  const safeCourtCount = Math.max(1, Number(courtCount) || 1);
  const formRow1Style = isNarrowScreen
    ? { ...styles.formRow1, gridTemplateColumns: "1fr" }
    : styles.formRow1;
  const formRow2Style = isNarrowScreen
    ? { ...styles.formRow2, gridTemplateColumns: "1fr 1fr" }
    : styles.formRow2;
  const formRow3Style = isNarrowScreen
    ? { ...styles.formRow3, gridTemplateColumns: "1fr" }
    : styles.formRow3;
  const pasteGuideText =
    mode === "tournament"
      ? "기본 형식: 선수1,성별1,선수2,성별2,급수,연령대\n예: 김철수,남,이영희,여,C,40대"
      : mode === "rivalry"
        ? "권장 형식: 팀,이름,성별,급수,연령대\n예: A팀,홍길동,남,C,40대\n팀을 빼면 A팀/B팀으로 번갈아 등록합니다."
        : "기본 형식: 이름,성별,급수,연령대\n예: 홍길동,남,C,40대\n급수나 연령대가 없으면 현재 선택값을 기본값으로 씁니다.";
  const pastePlaceholder =
    mode === "tournament"
      ? "김철수,남,이영희,여,C,40대\n박민수,남,최수진,여,D,30대"
      : mode === "rivalry"
        ? "A팀,홍길동,남,C,40대\nB팀,이영희,여,B,30대"
        : "홍길동,남,C,40대\n이영희,여,B,30대";

  return (
    <div style={styles.wrap}>
      <div style={styles.topCard}>
        <div style={styles.topRow}>
          <button style={styles.backButton} onClick={onBack}>
            HOME
          </button>
        </div>

        <h1 style={styles.headerTitle}>{modeLabel || mode || "경기 운영"}</h1>
        <div style={styles.headerSub}>현재 선수 {safePlayers.length}명</div>

        <div style={styles.topRow}>
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === "players" ? styles.tabButtonActive : {}),
              }}
              onClick={() => setActiveTab("players")}
            >
              선수 관리
            </button>

            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === "schedule" ? styles.tabButtonActive : {}),
              }}
              onClick={() => setActiveTab("schedule")}
            >
              대진표
            </button>
          </div>

          <button style={styles.generateButton} onClick={onGenerate}>
            대진표 생성
          </button>
        </div>
      </div>

      {activeTab === "players" && (
        <>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>선수 등록</h2>

              <div style={styles.headerButtons}>
                <button style={styles.subButtonGreen} onClick={handleTemplateDownload}>
                  엑셀 템플릿
                </button>

                <button
                  style={styles.subButtonWhite}
                  onClick={() => fileInputRef.current?.click()}
                >
                  엑셀 파일 업로드
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                />
              </div>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.pasteBlock}>
                <div style={styles.pasteTitle}>붙여넣기 등록</div>
                <div style={styles.pasteGuide}>{pasteGuideText}</div>
                <textarea
                  style={styles.textarea}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={pastePlaceholder}
                />
                <div style={styles.pasteActions}>
                  <button style={styles.subButtonWhite} onClick={() => setPasteText("")}>
                    비우기
                  </button>
                  <button style={styles.subButtonGreen} onClick={handlePasteRegister}>
                    붙여넣기 등록
                  </button>
                </div>
              </div>

              {mode === "tournament" ? (
                <>
                  <div style={formRow1Style}>
                    <div style={styles.field}>
                      <label style={styles.label}>선수 1</label>
                      <input
                        style={styles.input}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>선수 1 성별</label>
                      <select
                        style={styles.select}
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      >
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>급수</label>
                      <select
                        style={styles.select}
                        value={form.grade}
                        onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      >
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={formRow2Style}>
                    <div style={styles.field}>
                      <label style={styles.label}>선수 2</label>
                      <input
                        style={styles.input}
                        value={form.secondName}
                        onChange={(e) => setForm({ ...form, secondName: e.target.value })}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>선수 2 성별</label>
                      <select
                        style={styles.select}
                        value={form.secondGender}
                        onChange={(e) => setForm({ ...form, secondGender: e.target.value })}
                      >
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>연령대</label>
                      <select
                        style={styles.select}
                        value={form.ageGroup}
                        onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                      >
                        {AGE_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.addButtonWrap}>
                      <label style={styles.label}>&nbsp;</label>
                      <button style={styles.addButton} onClick={handleAddPlayer}>
                        조 추가
                      </button>
                    </div>
                  </div>

                </>
              ) : mode === "rivalry" ? (
                <>
                  <div style={formRow1Style}>
                    <div style={styles.field}>
                      <label style={styles.label}>이름</label>
                      <input
                        style={styles.input}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>선수 1 성별</label>
                      <select
                        style={styles.select}
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      >
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>급수</label>
                      <select
                        style={styles.select}
                        value={form.grade}
                        onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      >
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={formRow2Style}>
                    <div style={styles.field}>
                      <label style={styles.label}>연령대</label>
                      <select
                        style={styles.select}
                        value={form.ageGroup}
                        onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                      >
                        {AGE_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>팀</label>
                      <select
                        style={styles.select}
                        value={form.rivalryTeam}
                        onChange={(e) => setForm({ ...form, rivalryTeam: e.target.value })}
                      >
                        {RIVALRY_TEAM_OPTIONS.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div />
                  </div>

                  <div style={formRow3Style}>
                    <div />
                    <div style={styles.addButtonWrap}>
                      <button style={styles.addButton} onClick={handleAddPlayer}>
                        조 추가
                      </button>
                    </div>
                  </div>

                </>
              ) : (
                <>
                  <div style={formRow1Style}>
                    <div style={styles.field}>
                      <label style={styles.label}>이름</label>
                      <input
                        style={styles.input}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>성별</label>
                      <select
                        style={styles.select}
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      >
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>급수</label>
                      <select
                        style={styles.select}
                        value={form.grade}
                        onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      >
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={formRow2Style}>
                    <div style={styles.field}>
                      <label style={styles.label}>연령대</label>
                      <select
                        style={styles.select}
                        value={form.ageGroup}
                        onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                      >
                        {AGE_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>코트 수</label>
                      <input
                        type="number"
                        min="1"
                        style={styles.input}
                        value={safeCourtCount}
                        onChange={(e) =>
                          setCourtCount(Math.max(1, Number(e.target.value) || 1))
                        }
                      />
                    </div>

                    <div style={styles.addButtonWrap}>
                      <label style={styles.label}>&nbsp;</label>
                      <button style={styles.addButton} onClick={handleAddPlayer}>
                        선수 추가
                      </button>
                    </div>
                  </div>

                </>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>선수 목록 ({safePlayers.length})</h2>

              <div style={styles.listHeaderRight}>
                {mode !== "tournament" && mode !== "league" ? (
                  <>
                    <span style={styles.miniLabel}>목표경기</span>
                    <input
                      style={styles.miniInput}
                      type="number"
                      min="1"
                      value={safeTargetMatchCount}
                      onChange={(e) =>
                        setTargetMatchCount(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </>
                ) : null}

                <span style={styles.miniLabel}>코트수</span>
                <input
                  style={styles.miniInput}
                  type="number"
                  min="1"
                  value={safeCourtCount}
                  onChange={(e) => setCourtCount(Math.max(1, Number(e.target.value) || 1))}
                />

                <button style={styles.resetButton} onClick={() => onResetAll?.()}>
                  전체 초기화
                </button>
              </div>
            </div>

            <div style={styles.cardBody}>
              {safePlayers.length === 0 ? (
                <div style={styles.emptyBox}>등록된 선수가 없습니다.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>이름</th>
                        {mode === "rivalry" ? <th style={styles.th}>팀</th> : null}
                        {mode === "rivalry" ? <th style={styles.th}>조</th> : null}
                        <th style={styles.th}>성별</th>
                        <th style={styles.th}>급수</th>
                        <th style={styles.th}>연령대</th>
                        <th style={styles.th}>기본점수</th>
                        <th style={styles.th}>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safePlayers.map((p) => (
                        <tr key={p.id}>
                          <td style={styles.td}>{p.name}</td>
                          {mode === "rivalry" ? <td style={styles.td}>{p.rivalryTeam || "-"}</td> : null}
                          {mode === "rivalry" ? <td style={styles.td}>{p.pairName || "-"}</td> : null}
                          <td style={styles.td}>{p.gender}</td>
                          <td style={styles.td}>{p.grade}</td>
                          <td style={styles.td}>{p.ageGroup}</td>
                          <td style={styles.td}>{p.baseScore}</td>
                          <td style={styles.td}>
                            <button
                              style={styles.deleteButton}
                              onClick={() => handleDeletePlayer(p.id)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {mode === "league" && leagueTeams.length > 0 ? (
            <div style={styles.teamPanel}>
              <div style={styles.teamPanelHeader}>
                <h2 style={styles.teamPanelTitle}>팀 구성표</h2>
                <div style={styles.teamPanelSub}>
                  각 팀의 선수 명단과 조 편성을 확인하세요. 승리 기준 {winningScore}점
                </div>
              </div>

              <div style={styles.teamPanelBody}>
                {leagueTeams.map((team, teamIndex) => {
                  const teamPlayers = safeArray(team?.players)
                    .map(getPlayerName)
                    .filter(Boolean);
                  const teamPairs = safeArray(team?.pairs);
                  const teamId = team?.id || `team-${teamIndex}`;
                  const teamForm = getTeamForm(teamId);

                  return (
                    <div key={teamId} style={styles.teamCard}>
                      <div style={styles.teamCardHead}>
                        <div style={styles.teamName}>{team?.name || `팀 ${teamIndex + 1}`}</div>
                        <div style={styles.teamMeta}>{teamPlayers.length}명</div>
                      </div>

                      {teamPairs.length > 0 ? (
                        <div style={styles.pairBlock}>
                          {teamPairs.map((pair, pairIndex) => (
                            <div key={pair?.id || `${team?.id}-pair-${pairIndex}`} style={styles.pairLineRow}>
                              <div style={styles.pairLine}>{getPairLabel(pair, pairIndex)}</div>
                              {pair?.isManual || String(pair?.id || "").includes("-manual-") ? (
                                <button
                                  type="button"
                                  style={styles.pairDeleteButton}
                                  onClick={() => removeManualPairFromTeam(team, pair)}
                                >
                                  삭제
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div style={styles.playerList}>
                        {teamPlayers.map((name, playerIndex) => (
                          <div
                            key={`${team?.id || teamIndex}-player-${playerIndex}`}
                            style={styles.playerChip}
                          >
                            {name}
                          </div>
                        ))}
                      </div>

                      <div style={styles.pairEditor}>
                        <div style={styles.pairEditorRow}>
                          <input
                            style={styles.pairEditorInput}
                            placeholder="선수 1"
                            value={teamForm.first}
                            onChange={(e) => setTeamForm(teamId, { first: e.target.value })}
                          />
                          <input
                            style={styles.pairEditorInput}
                            placeholder="선수 2(파트너)"
                            value={teamForm.second}
                            onChange={(e) => setTeamForm(teamId, { second: e.target.value })}
                          />
                          <button
                            type="button"
                            style={styles.pairEditorButton}
                            onClick={() => addManualPairToTeam(team)}
                          >
                            조 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {renderLeagueReservePanel()}
        </>
      )}

      {activeTab === "schedule" && (
        <div style={styles.scheduleLayout}>
          <div style={styles.scheduleColumn}>
            <div style={styles.card}>
              <div style={styles.scheduleGuide}>
                설정 정보
                <br />
                선수 수: {safePlayers.length}
                {mode !== "tournament" && mode !== "league" ? (
                  <>
                    <br />
                    목표 경기: {safeTargetMatchCount}
                  </>
                ) : null}
                <br />
                코트 수: {safeCourtCount}
                {mode === "league" ? (
                  <>
                    <br />
                    승리 기준: {winningScore}점
                  </>
                ) : null}
              </div>
            </div>

            {mode === "tournament" ? renderTournamentBoardPanel() : null}
            {mode === "friendly" ? renderFriendlyPlayerListPanel() : null}
            {mode === "friendly" ? renderFriendlyAssistPanel() : null}
            {mode === "rivalry" ? renderRivalryTeamPanel() : null}
            {mode === "rivalry" ? renderRivalryAssistPanel() : null}

            {mode === "league" && leagueTeams.length > 0 ? (
              <div style={styles.teamPanel}>
                <div style={styles.teamPanelHeader}>
                  <h2 style={styles.teamPanelTitle}>팀 구성표</h2>
                  <div style={styles.teamPanelSub}>
                    각 팀의 선수 명단과 조 편성을 확인하세요. 승리 기준 {winningScore}점
                  </div>
                </div>

                <div style={styles.teamPanelBody}>
                  {leagueTeams.map((team, teamIndex) => {
                    const teamPlayers = safeArray(team?.players)
                      .map(getPlayerName)
                      .filter(Boolean);
                    const teamPairs = safeArray(team?.pairs);
                    const teamId = team?.id || `team-${teamIndex}`;
                    const teamForm = getTeamForm(teamId);

                    return (
                      <div key={teamId} style={styles.teamCard}>
                        <div style={styles.teamCardHead}>
                          <div style={styles.teamName}>{team?.name || `팀 ${teamIndex + 1}`}</div>
                          <div style={styles.teamMeta}>{teamPlayers.length}명</div>
                        </div>

                        {teamPairs.length > 0 ? (
                          <div style={styles.pairBlock}>
                            {teamPairs.map((pair, pairIndex) => (
                              <div key={pair?.id || `${team?.id}-pair-${pairIndex}`} style={styles.pairLineRow}>
                                <div style={styles.pairLine}>{getPairLabel(pair, pairIndex)}</div>
                                {pair?.isManual || String(pair?.id || "").includes("-manual-") ? (
                                  <button
                                    type="button"
                                    style={styles.pairDeleteButton}
                                    onClick={() => removeManualPairFromTeam(team, pair)}
                                  >
                                    삭제
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div style={styles.playerList}>
                          {teamPlayers.map((name, playerIndex) => (
                            <div
                              key={`${team?.id || teamIndex}-player-${playerIndex}`}
                              style={styles.playerChip}
                            >
                              {name}
                            </div>
                          ))}
                        </div>

                        <div style={styles.pairEditor}>
                          <div style={styles.pairEditorRow}>
                            <input
                              style={styles.pairEditorInput}
                              placeholder="선수 1"
                              value={teamForm.first}
                              onChange={(e) => setTeamForm(teamId, { first: e.target.value })}
                            />
                            <input
                              style={styles.pairEditorInput}
                              placeholder="선수 2(파트너)"
                              value={teamForm.second}
                              onChange={(e) => setTeamForm(teamId, { second: e.target.value })}
                            />
                            <button
                              type="button"
                              style={styles.pairEditorButton}
                              onClick={() => addManualPairToTeam(team)}
                            >
                              조 추가
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {renderLeagueReservePanel()}
          </div>
        </div>
      )}
    </div>
  );
}




