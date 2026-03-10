import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";

const GRADES = ["A", "B", "C", "D", "초심"];
const GENDERS = ["남", "여"];
const AGE_BANDS = ["20대", "30대", "40대", "50대", "60대+"];
const MODES = [
  { value: "friendly", label: "친선전", icon: "🏸" },
  { value: "tournament", label: "대회", icon: "🏆" },
  { value: "rivalry", label: "대항전", icon: "⚔️" },
  { value: "league", label: "정기전", icon: "👥" },
];
const RIVALRY_TEAMS = ["홈팀", "원정팀"];
const STORAGE_KEY = "badmonkeyz_all_in_one_v31";
const TOTAL_COURTS = 4;
const DEFAULT_MAX_GAMES = 3;

const GRADE_POINTS_MALE = { A: 5, B: 4, C: 3, D: 2, 초심: 1 };
const GRADE_POINTS_FEMALE = { A: 3.8, B: 2.5, C: 2.0, D: 1.5, 초심: 0.5 };
const GRADE_LEVEL = { 초심: 1, D: 2, C: 3, B: 4, A: 5 };
const LEVEL_TO_GRADE = { 1: "초심", 2: "D", 3: "C", 4: "B", 5: "A" };
const AGE_INDEX = { "20대": 0, "30대": 1, "40대": 2, "50대": 3, "60대+": 4 };

const emptyForm = {
  name: "",
  gender: "남",
  grade: "C",
  ageBand: "40대",
  maxGames: DEFAULT_MAX_GAMES,
  customScore: "",
  rivalryTeam: "홈팀",
  events: { nam: true, yeo: false, hon: false },
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#f8fafc 0%,#eef2ff 40%,#f8fafc 100%)",
    color: "#0f172a",
    fontFamily: "Inter, Pretendard, system-ui, sans-serif",
    padding: 16,
  },
  shell: { maxWidth: 1280, margin: "0 auto" },
  card: {
    background: "rgba(255,255,255,0.95)",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    boxShadow: "0 14px 34px rgba(15,23,42,.06)",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    border: "none",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  th: { textAlign: "left", padding: "10px 8px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" },
  td: { padding: "10px 8px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
};

const cn = (...items) => items.filter(Boolean).join(" ");
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : min));
const deepCopy = (v) => JSON.parse(JSON.stringify(v));
const dateStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join("_");
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const typeLabel = (type) => ({ NAM: "남복", YEO: "여복", HON: "혼복", MIX: "복식" }[type] || type);

function getBaseScore(grade, gender) {
  return gender === "남" ? GRADE_POINTS_MALE[grade] : GRADE_POINTS_FEMALE[grade];
}
function getPlayerScore(player) {
  return player.customScore === null || player.customScore === "" || player.customScore === undefined
    ? getBaseScore(player.grade, player.gender)
    : Number(player.customScore);
}
function normalizeEventsByGender(gender, events) {
  if (gender === "남") return { nam: !!events?.nam, yeo: false, hon: !!events?.hon };
  return { nam: false, yeo: !!events?.yeo, hon: !!events?.hon };
}
function makePlayer(id, raw) {
  const gender = raw.gender === "여" ? "여" : "남";
  const grade = GRADES.includes(raw.grade) ? raw.grade : "C";
  const ageBand = AGE_BANDS.includes(raw.ageBand) ? raw.ageBand : "40대";
  const maxGames = clamp(raw.maxGames || DEFAULT_MAX_GAMES, 1, 20);
  const parsed = raw.customScore === "" || raw.customScore === null || raw.customScore === undefined ? null : Number(raw.customScore);
  return {
    id,
    name: String(raw.name || "").trim(),
    gender,
    grade,
    ageBand,
    maxGames,
    customScore: Number.isFinite(parsed) ? parsed : null,
    rivalryTeam: RIVALRY_TEAMS.includes(raw.rivalryTeam) ? raw.rivalryTeam : "홈팀",
    events: normalizeEventsByGender(gender, raw.events || (gender === "남" ? { nam: true, hon: false } : { yeo: true, hon: false })),
    leagueManualPool: !!raw.leagueManualPool,
    leagueTargetTeam: raw.leagueTargetTeam || "",
    fixedPartnerId: raw.fixedPartnerId || null,
  };
}
function getTeamType(team) {
  const maleCount = team.filter((p) => p.gender === "남").length;
  if (maleCount === 2) return "NAM";
  if (maleCount === 1) return "HON";
  return "YEO";
}
function parseTruthy(v) {
  return ["y", "yes", "1", "true", "o", "예", "참가", "ㅇ", "on"].includes(String(v ?? "").trim().toLowerCase());
}
function normalizeHeaderKey(v) {
  return String(v ?? "").replace(/\s+/g, "").trim().toLowerCase();
}
function gradeShiftByAge(sourceAge, targetAge, grade) {
  const baseLevel = GRADE_LEVEL[grade] ?? 3;
  const source = AGE_INDEX[sourceAge] ?? 2;
  const target = AGE_INDEX[targetAge] ?? 2;
  const shifted = clamp(baseLevel + (target - source), 1, 5);
  return LEVEL_TO_GRADE[shifted];
}
function adjustedScoreForTargetAge(player, targetAge) {
  const shiftedGrade = gradeShiftByAge(player.ageBand, targetAge, player.grade);
  return player.gender === "남" ? GRADE_POINTS_MALE[shiftedGrade] : GRADE_POINTS_FEMALE[shiftedGrade];
}
function eventAllowed(player, type) {
  if (type === "NAM") return player.gender === "남" && player.events.nam;
  if (type === "YEO") return player.gender === "여" && player.events.yeo;
  if (type === "HON") return player.events.hon;
  return true;
}

function buildCandidateMatches(pool, mode) {
  const matches = [];
  const usedPairs = new Set();
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      for (let k = 0; k < pool.length; k += 1) {
        if (k === i || k === j) continue;
        for (let l = k + 1; l < pool.length; l += 1) {
          if ([i, j].includes(l)) continue;
          const ids = [pool[i].id, pool[j].id, pool[k].id, pool[l].id].sort((a, b) => a - b).join("_");
          if (usedPairs.has(ids)) continue;
          usedPairs.add(ids);
          const teamA = [pool[i], pool[j]];
          const teamB = [pool[k], pool[l]];
          const typeA = getTeamType(teamA);
          const typeB = getTeamType(teamB);
          if (mode === "tournament") {
            if (typeA !== typeB) continue;
            const sameGrade = [...teamA, ...teamB].every((p) => p.grade === teamA[0].grade);
            if (!sameGrade) continue;
            if (typeA === "NAM" && !teamA.concat(teamB).every((p) => p.events.nam)) continue;
            if (typeA === "YEO" && !teamA.concat(teamB).every((p) => p.events.yeo)) continue;
            if (typeA === "HON" && !teamA.concat(teamB).every((p) => p.events.hon)) continue;
          }
          if (mode === "rivalry") {
            const teamNameA = new Set(teamA.map((p) => p.rivalryTeam));
            const teamNameB = new Set(teamB.map((p) => p.rivalryTeam));
            if (teamNameA.size !== 1 || teamNameB.size !== 1) continue;
            if (teamA[0].rivalryTeam === teamB[0].rivalryTeam) continue;
          }
          const scoreA = teamA.reduce((s, p) => s + getPlayerScore(p), 0);
          const scoreB = teamB.reduce((s, p) => s + getPlayerScore(p), 0);
          const diff = Math.abs(scoreA - scoreB);
          if (typeA === typeB && diff > 1.0) continue;
          if (typeA !== typeB && mode !== "friendly") continue;
          matches.push({
            teamA,
            teamB,
            typeA,
            typeB,
            scoreA,
            scoreB,
            diff,
            label:
              mode === "tournament"
                ? `${teamA[0].grade}급 ${typeLabel(typeA)}`
                : mode === "rivalry"
                ? `${typeLabel(typeA)} ${teamA[0].rivalryTeam} vs ${teamB[0].rivalryTeam}`
                : `${typeLabel(typeA)} vs ${typeLabel(typeB)}`,
            penalty: diff * 10,
          });
        }
      }
    }
  }
  return matches.sort((a, b) => a.penalty - b.penalty);
}
function generateGeneralSchedule(players, mode) {
  const rounds = [];
  const stats = {};
  players.forEach((p) => {
    stats[p.id] = { count: 0 };
  });

  for (let roundId = 1; roundId <= 60; roundId += 1) {
    const available = players.filter((p) => stats[p.id].count < p.maxGames);
    if (available.length < 4) break;
    const candidates = buildCandidateMatches(shuffle(available), mode);
    const selected = [];
    const used = new Set();

    for (const c of candidates) {
      const ids = [...c.teamA, ...c.teamB].map((p) => p.id);
      if (ids.some((id) => used.has(id))) continue;
      ids.forEach((id) => used.add(id));
      selected.push({ ...c, courtId: selected.length + 1 });
      if (selected.length >= TOTAL_COURTS) break;
    }

    if (!selected.length) break;
    selected.forEach((m) => {
      [...m.teamA, ...m.teamB].forEach((p) => {
        stats[p.id].count += 1;
      });
    });
    rounds.push({ id: roundId, matches: selected });
    if (players.every((p) => stats[p.id].count >= p.maxGames)) break;
  }
  return { rounds };
}

function buildAgeTeams(players) {
  const grouped = Object.fromEntries(AGE_BANDS.map((age) => [age, []]));
  players.forEach((p) => grouped[p.ageBand].push(p));

  const mainTeams = [];
  const minorPools = { 남: [], 여: [] };

  AGE_BANDS.forEach((age) => {
    const members = grouped[age];
    if (!members.length) return;
    const males = members.filter((p) => p.gender === "남");
    const females = members.filter((p) => p.gender === "여");
    let mode = "HON";
    let active = members;
    if (males.length > females.length) {
      mode = "NAM";
      active = males;
      minorPools.여.push(...females);
    } else if (females.length > males.length) {
      mode = "YEO";
      active = females;
      minorPools.남.push(...males);
    } else {
      mode = "HON";
      active = members;
    }
    mainTeams.push({
      id: `${age}-main`,
      name: `${age}팀`,
      baseAge: age,
      source: "age",
      matchMode: mode,
      players: [...active],
    });
  });

  const extraTeams = [];
  if (minorPools.남.length >= 4) {
    extraTeams.push({ id: "minor-male", name: "소수남성팀", baseAge: "40대", source: "minor", matchMode: "NAM", players: [...minorPools.남] });
    minorPools.남 = [];
  }
  if (minorPools.여.length >= 4) {
    extraTeams.push({ id: "minor-female", name: "소수여성팀", baseAge: "40대", source: "minor", matchMode: "YEO", players: [...minorPools.여] });
    minorPools.여 = [];
  }
  const mixPool = [...minorPools.남, ...minorPools.여];
  if (mixPool.length >= 4) {
    const male = mixPool.filter((p) => p.gender === "남").length;
    const female = mixPool.filter((p) => p.gender === "여").length;
    extraTeams.push({
      id: "minor-mix",
      name: male === female ? "소수혼합팀" : male > female ? "소수남성팀" : "소수여성팀",
      baseAge: "40대",
      source: "minor",
      matchMode: male === female ? "HON" : male > female ? "NAM" : "YEO",
      players: mixPool,
    });
  }

  return [...mainTeams, ...extraTeams].filter((t) => t.players.length > 0);
}

function fillTeamShortage(teams, allPlayers) {
  const assigned = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
  const manualExtras = allPlayers.filter((p) => p.leagueTargetTeam && !assigned.has(p.id));
  manualExtras.forEach((p) => {
    const team = teams.find((t) => t.name === p.leagueTargetTeam);
    if (team) team.players.push(p);
  });

  const availableElsewhere = () =>
    teams.flatMap((t) =>
      t.players.map((p) => ({ ...p, _fromTeam: t.name, _fromBaseAge: t.baseAge, _source: t.source }))
    );

  teams.forEach((team) => {
    const minNeeded = team.matchMode === "HON" ? 4 : 4;
    while (team.players.length < minNeeded) {
      const pool = availableElsewhere()
        .filter((p) => p._fromTeam !== team.name)
        .filter((p) => !team.players.some((tp) => tp.id === p.id))
        .filter((p) => {
          if (team.matchMode === "NAM") return p.gender === "남";
          if (team.matchMode === "YEO") return p.gender === "여";
          return true;
        })
        .sort((a, b) => {
          const aAgeGap = Math.abs((AGE_INDEX[a.ageBand] ?? 2) - (AGE_INDEX[team.baseAge] ?? 2));
          const bAgeGap = Math.abs((AGE_INDEX[b.ageBand] ?? 2) - (AGE_INDEX[team.baseAge] ?? 2));
          if (aAgeGap !== bAgeGap) return aAgeGap - bAgeGap;
          const aScore = Math.abs(adjustedScoreForTargetAge(a, team.baseAge) - team.players.reduce((s, p) => s + adjustedScoreForTargetAge(p, team.baseAge), 0) / Math.max(team.players.length, 1));
          const bScore = Math.abs(adjustedScoreForTargetAge(b, team.baseAge) - team.players.reduce((s, p) => s + adjustedScoreForTargetAge(p, team.baseAge), 0) / Math.max(team.players.length, 1));
          return aScore - bScore;
        });
      if (!pool.length) break;
      const picked = pool[0];
      team.players.push({ ...picked, leagueBorrowedFrom: picked._fromTeam });
      const donor = teams.find((t) => t.name === picked._fromTeam);
      if (donor) donor.players = donor.players.filter((x) => x.id !== picked.id);
    }
  });
  return teams.filter((t) => t.players.length >= 4);
}

function pickFixedPairs(players) {
  const map = new Map(players.map((p) => [p.id, p]));
  const used = new Set();
  const fixedPairs = [];
  players.forEach((p) => {
    if (!p.fixedPartnerId || used.has(p.id)) return;
    const partner = map.get(p.fixedPartnerId);
    if (!partner || used.has(partner.id)) return;
    used.add(p.id);
    used.add(partner.id);
    fixedPairs.push([p, partner]);
  });
  return { fixedPairs, remaining: players.filter((p) => !used.has(p.id)) };
}

function autoPairPlayers(players, matchMode, baseAge) {
  const { fixedPairs, remaining } = pickFixedPairs(players);
  const pairs = [...fixedPairs];

  const scoreForPairing = (p) => adjustedScoreForTargetAge(p, baseAge);
  const rem = [...remaining];

  if (matchMode === "NAM") {
    const men = rem.filter((p) => p.gender === "남").sort((a, b) => scoreForPairing(b) - scoreForPairing(a));
    while (men.length >= 2) {
      const high = men.shift();
      let bestIdx = 0;
      let bestVal = Infinity;
      men.forEach((cand, idx) => {
        const val = Math.abs(scoreForPairing(high) - scoreForPairing(cand));
        if (val < bestVal) {
          bestVal = val;
          bestIdx = idx;
        }
      });
      const partner = men.splice(bestIdx, 1)[0];
      pairs.push([high, partner]);
    }
  } else if (matchMode === "YEO") {
    const women = rem.filter((p) => p.gender === "여").sort((a, b) => scoreForPairing(b) - scoreForPairing(a));
    while (women.length >= 2) {
      const high = women.shift();
      let bestIdx = 0;
      let bestVal = Infinity;
      women.forEach((cand, idx) => {
        const val = Math.abs(scoreForPairing(high) - scoreForPairing(cand));
        if (val < bestVal) {
          bestVal = val;
          bestIdx = idx;
        }
      });
      const partner = women.splice(bestIdx, 1)[0];
      pairs.push([high, partner]);
    }
  } else {
    const men = rem.filter((p) => p.gender === "남").sort((a, b) => scoreForPairing(b) - scoreForPairing(a));
    const women = rem.filter((p) => p.gender === "여").sort((a, b) => scoreForPairing(a) - scoreForPairing(b));
    while (men.length && women.length) {
      const m = men.shift();
      let bestIdx = 0;
      let bestVal = Infinity;
      women.forEach((cand, idx) => {
        const val = Math.abs(scoreForPairing(m) - scoreForPairing(cand));
        if (val < bestVal) {
          bestVal = val;
          bestIdx = idx;
        }
      });
      const w = women.splice(bestIdx, 1)[0];
      pairs.push([m, w]);
    }
  }

  return pairs.filter((p) => p.length === 2);
}

function buildRoundRobin(n) {
  const list = Array.from({ length: n }, (_, i) => i);
  const ghost = n % 2 === 1 ? n : null;
  const arr = ghost === null ? [...list] : [...list, ghost];
  const rounds = [];
  for (let r = 0; r < arr.length - 1; r += 1) {
    const pairs = [];
    for (let i = 0; i < arr.length / 2; i += 1) {
      const a = arr[i];
      const b = arr[arr.length - 1 - i];
      if (a !== ghost && b !== ghost) pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

function buildLeagueSchedule(players) {
  let teams = buildAgeTeams(players);
  teams = fillTeamShortage(teams, players);

  const teamBundles = teams
    .map((team) => {
      const pairs = autoPairPlayers(team.players, team.matchMode, team.baseAge).map((pair, idx) => ({
        id: `${team.id}-pair-${idx + 1}`,
        label: `${idx + 1}조`,
        teamName: team.name,
        matchMode: team.matchMode,
        players: pair,
        score: pair.reduce((s, p) => s + adjustedScoreForTargetAge(p, team.baseAge), 0),
      }));
      return { ...team, pairs };
    })
    .filter((t) => t.pairs.length >= 2);

  const rounds = [];
  let roundId = 1;

  teamBundles.forEach((team) => {
    const rr = buildRoundRobin(team.pairs.length);
    rr.forEach((pairings, rrIdx) => {
      const matches = pairings.map(([aIdx, bIdx], idx) => {
        const a = team.pairs[aIdx];
        const b = team.pairs[bIdx];
        return {
          courtId: idx + 1,
          teamName: team.name,
          internalRound: rrIdx + 1,
          pairA: a,
          pairB: b,
          scoreA: a.score,
          scoreB: b.score,
          diff: Math.abs(a.score - b.score),
          label: `${team.name} ${typeLabel(team.matchMode)} ${a.label} vs ${b.label}`,
          result: { a: "", b: "" },
        };
      });
      for (let i = 0; i < matches.length; i += TOTAL_COURTS) {
        rounds.push({
          id: roundId,
          groupName: team.name,
          internalRound: rrIdx + 1,
          matches: matches.slice(i, i + TOTAL_COURTS).map((m, idx) => ({ ...m, courtId: idx + 1 })),
        });
        roundId += 1;
      }
    });
  });

  return { rounds, teams: teamBundles };
}

function computeLeagueStandings(schedule, leagueTeams) {
  const standings = {};
  leagueTeams.forEach((team) => {
    team.pairs.forEach((pair) => {
      standings[pair.id] = {
        id: pair.id,
        teamName: team.name,
        label: pair.label,
        players: pair.players,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        leaguePoints: 0,
      };
    });
  });

  schedule.forEach((round) => {
    round.matches.forEach((match) => {
      if (!match.pairA || !match.pairB) return;
      const a = Number(match.result?.a);
      const b = Number(match.result?.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      const rowA = standings[match.pairA.id];
      const rowB = standings[match.pairB.id];
      if (!rowA || !rowB) return;
      rowA.played += 1;
      rowB.played += 1;
      rowA.pointsFor += a;
      rowA.pointsAgainst += b;
      rowB.pointsFor += b;
      rowB.pointsAgainst += a;
      if (a > b) {
        rowA.wins += 1;
        rowB.losses += 1;
        rowA.leaguePoints += 3;
      } else if (b > a) {
        rowB.wins += 1;
        rowA.losses += 1;
        rowB.leaguePoints += 3;
      } else {
        rowA.draws += 1;
        rowB.draws += 1;
        rowA.leaguePoints += 1;
        rowB.leaguePoints += 1;
      }
    });
  });

  Object.values(standings).forEach((row) => {
    row.diff = row.pointsFor - row.pointsAgainst;
  });

  const grouped = {};
  Object.values(standings).forEach((row) => {
    if (!grouped[row.teamName]) grouped[row.teamName] = [];
    grouped[row.teamName].push(row);
  });

  Object.keys(grouped).forEach((teamName) => {
    grouped[teamName].sort((a, b) => {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.label.localeCompare(b.label, "ko");
    });
  });

  return grouped;
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: { background: "#f1f5f9", color: "#334155" },
    blue: { background: "#dbeafe", color: "#1d4ed8" },
    pink: { background: "#fce7f3", color: "#be185d" },
    green: { background: "#dcfce7", color: "#166534" },
    orange: { background: "#ffedd5", color: "#c2410c" },
    indigo: { background: "#e0e7ff", color: "#4338ca" },
  };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, ...tones[tone] }}>{children}</span>;
}

function Section({ title, right, children }) {
  return (
    <div style={{ ...styles.card, overflow: "hidden" }}>
      <div style={{ padding: 16, borderBottom: "1px solid #eef2ff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
        {right}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export default function App() {
  const uploadRef = useRef(null);
  const scheduleRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState("friendly");
  const [tab, setTab] = useState("players");
  const [message, setMessage] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [homeMode, setHomeMode] = useState(true);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [manualTargetTeam, setManualTargetTeam] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPlayers((parsed.players || []).map((p, idx) => makePlayer(p.id ?? idx + 1, p)).filter((p) => p.name));
      if (MODES.some((m) => m.value === parsed.mode)) setMode(parsed.mode);
      setHomeMode(parsed.homeMode ?? true);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, mode, homeMode }));
  }, [players, mode, homeMode]);

  const nextId = useMemo(() => (players.length ? Math.max(...players.map((p) => p.id)) + 1 : 1), [players]);
  const leagueStandings = useMemo(() => computeLeagueStandings(schedule, leagueTeams), [schedule, leagueTeams]);

  const countMale = players.filter((p) => p.gender === "남").length;
  const countFemale = players.filter((p) => p.gender === "여").length;

  function resetModeOutput() {
    setSchedule([]);
    setLeagueTeams([]);
    setTab("players");
  }

  function addPlayer() {
    const name = form.name.trim();
    if (!name) return setMessage("선수 이름을 입력해 주세요.");
    if (players.some((p) => p.name === name)) return setMessage(`'${name}' 선수는 이미 등록되어 있습니다.`);
    const player = makePlayer(nextId, {
      ...form,
      customScore: form.customScore === "" ? null : form.customScore,
    });
    setPlayers((prev) => [...prev, player]);
    setForm((prev) => ({
      ...emptyForm,
      gender: prev.gender,
      grade: prev.grade,
      ageBand: prev.ageBand,
      rivalryTeam: prev.rivalryTeam,
      events: normalizeEventsByGender(prev.gender, prev.events),
    }));
    setMessage(`선수 '${name}' 등록 완료`);
    resetModeOutput();
  }

  function updatePlayer(id, patch) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? makePlayer(id, { ...p, ...patch }) : p)));
    resetModeOutput();
  }

  function removePlayer(id) {
    setPlayers((prev) => prev.filter((p) => p.id !== id).map((p) => ({ ...p, fixedPartnerId: p.fixedPartnerId === id ? null : p.fixedPartnerId })));
    resetModeOutput();
  }

  function resetPlayers() {
    if (!window.confirm("전체 선수 목록을 삭제할까요?")) return;
    setPlayers([]);
    setSchedule([]);
    setLeagueTeams([]);
    setMessage("전체 초기화 완료");
  }

  function downloadTemplate() {
    const rows = [
      { 이름: "김철수", 성별: "남", 급수: "C", 연령대: "40대" },
      { 이름: "이영희", 성별: "여", 급수: "B", 연령대: "30대" },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "선수등록예시");
    XLSX.writeFile(wb, `BADMONKEYZ_선수등록_예시_${dateStamp()}.xlsx`);
  }

  async function handleExcelUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      let id = nextId;
      const success = [];
      const fail = [];
      const existing = new Set(players.map((p) => p.name));
      const staged = new Set();
      const getRowValue = (row, aliases) => {
        const entries = Object.entries(row || {});
        for (const alias of aliases) {
          const wanted = normalizeHeaderKey(alias);
          const found = entries.find(([k]) => normalizeHeaderKey(k) === wanted);
          if (found) return found[1];
        }
        return "";
      };

      rows.forEach((row, idx) => {
        const rowNo = idx + 2;
        const name = String(getRowValue(row, ["이름", "name"]) || "").trim();
        const gender = String(getRowValue(row, ["성별", "gender"]) || "").trim();
        const grade = String(getRowValue(row, ["급수", "grade"]) || "").trim();
        const ageBand = String(getRowValue(row, ["연령대", "연령", "ageband", "age group"]) || "").trim();
        const maxGames = getRowValue(row, ["목표경기", "최대경기", "maxgames"]);
        const customScore = getRowValue(row, ["커스텀점수", "customscore"]);
        const rivalryTeam = getRowValue(row, ["소속팀", "team"]);
        const nam = parseTruthy(getRowValue(row, ["남복참가", "nam"]));
        const yeo = parseTruthy(getRowValue(row, ["여복참가", "yeo"]));
        const hon = parseTruthy(getRowValue(row, ["혼복참가", "hon"]));

        if (!name || !gender || !grade || !ageBand) {
          fail.push({ rowNo, reason: "필수값(이름/성별/급수/연령대)이 비어 있습니다." });
          return;
        }
        if (existing.has(name) || staged.has(name)) {
          fail.push({ rowNo, reason: "중복된 이름입니다." });
          return;
        }
        if (!GENDERS.includes(gender)) {
          fail.push({ rowNo, reason: "성별은 남/여만 가능합니다." });
          return;
        }
        if (!GRADES.includes(grade)) {
          fail.push({ rowNo, reason: "급수는 A/B/C/D/초심만 가능합니다." });
          return;
        }
        if (!AGE_BANDS.includes(ageBand)) {
          fail.push({ rowNo, reason: "연령대는 20대/30대/40대/50대/60대+만 가능합니다." });
          return;
        }
        const player = makePlayer(id++, {
          name,
          gender,
          grade,
          ageBand,
          maxGames: maxGames === "" ? DEFAULT_MAX_GAMES : Number(maxGames),
          customScore: customScore === "" ? null : Number(customScore),
          rivalryTeam: RIVALRY_TEAMS.includes(String(rivalryTeam).trim()) ? rivalryTeam : "홈팀",
          events: normalizeEventsByGender(gender, {
            nam: nam || gender === "남",
            yeo: yeo || gender === "여",
            hon,
          }),
        });
        success.push(player);
        staged.add(name);
      });

      if (success.length) {
        setPlayers((prev) => [...prev, ...success]);
        resetModeOutput();
      }
      setUploadSummary({ total: rows.length, success: success.length, failed: fail.length, failures: fail.slice(0, 6) });
      setMessage(success.length ? `엑셀 업로드 완료: 성공 ${success.length}건 / 실패 ${fail.length}건` : "업로드 실패: 필수값을 확인해 주세요.");
    } catch (err) {
      console.error(err);
      setMessage("엑셀 업로드 중 오류가 발생했습니다.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  function generateSchedule() {
    if (players.length < 4) return setMessage("최소 4명 이상 등록해 주세요.");
    try {
      if (mode === "league") {
        const result = buildLeagueSchedule(players);
        setSchedule(result.rounds);
        setLeagueTeams(result.teams);
        setTab("schedule");
        setMessage(result.rounds.length ? `정기전 대진 생성 완료 (${result.teams.length}개 팀)` : "정기전 대진을 생성하지 못했습니다.");
        return;
      }
      const result = generateGeneralSchedule(players, mode);
      setSchedule(result.rounds);
      setLeagueTeams([]);
      setTab("schedule");
      setMessage(result.rounds.length ? `대진 생성 완료 (${result.rounds.length}R)` : "대진을 생성하지 못했습니다.");
    } catch (e) {
      console.error(e);
      setMessage("대진 생성 중 오류가 발생했습니다.");
    }
  }

  function updateLeagueScore(roundId, matchIndex, side, value) {
    setSchedule((prev) => prev.map((round) => {
      if (round.id !== roundId) return round;
      return {
        ...round,
        matches: round.matches.map((m, idx) => idx === matchIndex ? { ...m, result: { ...m.result, [side]: value } } : m),
      };
    }));
  }

  function assignFixedPartner() {
    const playerId = Number(selectedPlayerId);
    const partnerId = Number(selectedPartnerId);
    if (!playerId || !partnerId || playerId === partnerId) return setMessage("선수 2명을 올바르게 선택해 주세요.");
    const player = players.find((p) => p.id === playerId);
    const partner = players.find((p) => p.id === partnerId);
    if (!player || !partner) return setMessage("선수를 다시 선택해 주세요.");
    setPlayers((prev) => prev.map((p) => {
      if (p.id === playerId) return { ...p, fixedPartnerId: partnerId };
      if (p.id === partnerId) return { ...p, fixedPartnerId: playerId };
      return p;
    }));
    resetModeOutput();
    setMessage(`고정 파트너 지정 완료: ${player.name} / ${partner.name}`);
  }

  function clearFixedPartner(playerId) {
    const player = players.find((p) => p.id === playerId);
    const partnerId = player?.fixedPartnerId;
    setPlayers((prev) => prev.map((p) => {
      if (p.id === playerId) return { ...p, fixedPartnerId: null };
      if (partnerId && p.id === partnerId) return { ...p, fixedPartnerId: null };
      return p;
    }));
    resetModeOutput();
  }

  function addManualLeaguePlacement() {
    const playerId = Number(selectedPlayerId);
    if (!playerId || !manualTargetTeam) return setMessage("선수와 대상 팀을 선택해 주세요.");
    setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, leagueTargetTeam: manualTargetTeam, leagueManualPool: true } : p));
    resetModeOutput();
    setMessage("수동 팀 배정 설정 완료 (정기전 팀 밸런스 예외)");
  }

  function clearManualLeaguePlacement(playerId) {
    setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, leagueTargetTeam: "", leagueManualPool: false } : p));
    resetModeOutput();
  }

  function downloadExcel() {
    if (!schedule.length) return window.alert("생성된 대진표가 없습니다.");
    const rows = [];
    if (mode === "league") {
      Object.entries(leagueStandings).forEach(([teamName, teamRows]) => {
        rows.push({ 구분: `${teamName} 순위표` });
        teamRows.forEach((row, idx) => {
          rows.push({
            순위: idx + 1,
            팀: teamName,
            조: row.label,
            선수: `${row.players[0]?.name || ""} / ${row.players[1]?.name || ""}`,
            경기수: row.played,
            승: row.wins,
            무: row.draws,
            패: row.losses,
            득점: row.pointsFor,
            실점: row.pointsAgainst,
            득실차: row.diff,
            승점: row.leaguePoints,
          });
        });
        rows.push({});
      });
    }
    schedule.forEach((round) => {
      round.matches.forEach((m) => {
        rows.push(mode === "league" ? {
          구분: "정기전",
          라운드: `${round.groupName} ${round.internalRound}R`,
          코트: `${m.courtId}코트`,
          경기: m.label,
          A조: `${m.pairA.label} (${m.pairA.players.map((p) => p.name).join(" / ")})`,
          B조: `${m.pairB.label} (${m.pairB.players.map((p) => p.name).join(" / ")})`,
          예측합A: m.scoreA.toFixed(1),
          예측합B: m.scoreB.toFixed(1),
          실제점수A: m.result?.a ?? "",
          실제점수B: m.result?.b ?? "",
        } : {
          구분: MODES.find((x) => x.value === mode)?.label,
          라운드: `${round.id}R`,
          코트: `${m.courtId}코트`,
          경기: m.label,
          팀A: `${m.teamA[0].name} / ${m.teamA[1].name}`,
          팀B: `${m.teamB[0].name} / ${m.teamB[1].name}`,
          점수A: m.scoreA.toFixed(1),
          점수B: m.scoreB.toFixed(1),
          차이: m.diff.toFixed(1),
        });
      });
      rows.push({});
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "대진표");
    XLSX.writeFile(wb, `BADMONKEYZ_대진표_${dateStamp()}.xlsx`);
  }

  async function downloadImage() {
    if (!scheduleRef.current) return;
    try {
      const node = scheduleRef.current;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2.2,
        backgroundColor: "#f8fafc",
        width: node.scrollWidth,
        height: node.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = `BADMONKEYZ_대진표_${dateStamp()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      setMessage("이미지 저장 중 오류가 발생했습니다.");
    }
  }

  const teamCandidates = useMemo(() => {
    const base = AGE_BANDS.map((age) => `${age}팀`);
    return [...base, "소수남성팀", "소수여성팀", "소수혼합팀"];
  }, []);

  if (homeMode) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={{ ...styles.card, padding: 28 }}>
            <div style={{ fontSize: 42, fontWeight: 950, color: "#312e81" }}>BADMONKEYZ</div>
            <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.7 }}>친선전 / 대회 / 대항전 / 정기전을 하나의 화면에서 관리할 수 있는 통합 App.jsx 버전이야.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 22 }}>
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => { setMode(m.value); setHomeMode(false); }}
                  style={{ ...styles.button, padding: 20, textAlign: "left", background: "linear-gradient(135deg,#ffffff 0%,#eef2ff 100%)", border: "1px solid #dbeafe" }}
                >
                  <div style={{ fontSize: 30 }}>{m.icon}</div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <input ref={uploadRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display: "none" }} />

        <div style={{ ...styles.card, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <button onClick={() => setHomeMode(true)} style={{ ...styles.button, background: "#fff", border: "1px solid #cbd5e1", marginBottom: 10 }}>← HOME</button>
              <div style={{ fontSize: 30, fontWeight: 950, color: "#1e1b4b" }}>{MODES.find((m) => m.value === mode)?.icon} {MODES.find((m) => m.value === mode)?.label}</div>
              <div style={{ marginTop: 6, color: "#475569" }}>인원 {players.length}명 / 남 {countMale}명 / 여 {countFemale}명</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {MODES.map((m) => (
                <button key={m.value} onClick={() => { setMode(m.value); resetModeOutput(); }} style={{ ...styles.button, background: mode === m.value ? "linear-gradient(135deg,#6366f1 0%,#3b82f6 100%)" : "#fff", color: mode === m.value ? "#fff" : "#334155", border: mode === m.value ? "none" : "1px solid #cbd5e1" }}>{m.label}</button>
              ))}
            </div>
          </div>
        </div>

        {message && <div style={{ ...styles.card, padding: 14, marginBottom: 16, color: "#1d4ed8", background: "linear-gradient(135deg,#eff6ff 0%,#eef2ff 100%)" }}>{message}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setTab("players")} style={{ ...styles.button, background: tab === "players" ? "#312e81" : "#fff", color: tab === "players" ? "#fff" : "#334155", border: tab === "players" ? "none" : "1px solid #cbd5e1" }}>선수 관리</button>
          <button onClick={() => setTab("schedule")} style={{ ...styles.button, background: tab === "schedule" ? "#312e81" : "#fff", color: tab === "schedule" ? "#fff" : "#334155", border: tab === "schedule" ? "none" : "1px solid #cbd5e1" }}>대진표</button>
        </div>

        {tab === "players" && (
          <div style={{ display: "grid", gap: 16 }}>
            <Section
              title="선수 등록"
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={downloadTemplate} style={{ ...styles.button, background: "#16a34a", color: "#fff" }}>📄 템플릿</button>
                  <button onClick={() => uploadRef.current?.click()} style={{ ...styles.button, background: "#fff", border: "1px solid #cbd5e1" }}>📥 엑셀 업로드</button>
                </div>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
                <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>이름</div><input style={styles.input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>성별</div><select style={styles.input} value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value, events: normalizeEventsByGender(e.target.value, p.events) }))}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></div>
                <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>급수</div><select style={styles.input} value={form.grade} onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></div>
                <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>연령대</div><select style={styles.input} value={form.ageBand} onChange={(e) => setForm((p) => ({ ...p, ageBand: e.target.value }))}>{AGE_BANDS.map((a) => <option key={a}>{a}</option>)}</select></div>
                <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>목표경기</div><input type="number" style={styles.input} value={form.maxGames} onChange={(e) => setForm((p) => ({ ...p, maxGames: clamp(e.target.value || 3, 1, 20) }))} /></div>
                <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>커스텀점수</div><input type="number" step="0.1" style={styles.input} value={form.customScore} onChange={(e) => setForm((p) => ({ ...p, customScore: e.target.value }))} placeholder="선택" /></div>
                {mode === "rivalry" && <div><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>소속팀</div><select style={styles.input} value={form.rivalryTeam} onChange={(e) => setForm((p) => ({ ...p, rivalryTeam: e.target.value }))}>{RIVALRY_TEAMS.map((t) => <option key={t}>{t}</option>)}</select></div>}
                {mode === "tournament" && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>참가 종목</div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: 12, border: "1px solid #cbd5e1", borderRadius: 14 }}>
                      <label><input type="checkbox" checked={form.events.nam} disabled={form.gender !== "남"} onChange={(e) => setForm((p) => ({ ...p, events: normalizeEventsByGender(p.gender, { ...p.events, nam: e.target.checked }) }))} /> 남복</label>
                      <label><input type="checkbox" checked={form.events.yeo} disabled={form.gender !== "여"} onChange={(e) => setForm((p) => ({ ...p, events: normalizeEventsByGender(p.gender, { ...p.events, yeo: e.target.checked }) }))} /> 여복</label>
                      <label><input type="checkbox" checked={form.events.hon} onChange={(e) => setForm((p) => ({ ...p, events: normalizeEventsByGender(p.gender, { ...p.events, hon: e.target.checked }) }))} /> 혼복</label>
                    </div>
                  </div>
                )}
                <div style={{ alignSelf: "end" }}><button onClick={addPlayer} style={{ ...styles.button, background: "linear-gradient(135deg,#22c55e 0%,#16a34a 100%)", color: "#fff", width: "100%" }}>➕ 선수 추가</button></div>
              </div>

              {mode === "league" && (
                <div style={{ marginTop: 14, borderRadius: 16, padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", lineHeight: 1.65 }}>
                  정기전은 연령대 자체가 팀이 된다. 20대팀/30대팀/40대팀/50대팀/60대팀 형태로 구성하고, 팀 내부의 성비에 따라 남복/여복/혼복 한 가지 방식으로만 운영한다. 팀 인원이 부족하면 다른 팀에서 보충하고, 소수 성별은 별도 소수 팀으로 묶는다.
                </div>
              )}
            </Section>

            {uploadSummary && (
              <div style={{ ...styles.card, padding: 14, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534" }}>
                총 {uploadSummary.total}행 / 성공 {uploadSummary.success}행 / 실패 {uploadSummary.failed}행
                {!!uploadSummary.failures?.length && <div style={{ marginTop: 8, fontSize: 13 }}>{uploadSummary.failures.map((f, i) => <div key={i}>- {f.rowNo}행: {f.reason}</div>)}</div>}
              </div>
            )}

            {mode === "league" && (
              <Section title="정기전 수동 설정">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>선수 선택</div>
                    <select style={styles.input} value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
                      <option value="">선수 선택</option>
                      {players.map((p) => <option key={p.id} value={p.id}>{p.name} / {p.ageBand} / {p.gender}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>수동 팀 배정</div>
                    <select style={styles.input} value={manualTargetTeam} onChange={(e) => setManualTargetTeam(e.target.value)}>
                      <option value="">대상 팀 선택</option>
                      {teamCandidates.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ alignSelf: "end" }}>
                    <button onClick={addManualLeaguePlacement} style={{ ...styles.button, background: "#f59e0b", color: "#fff", width: "100%" }}>수동 팀 배정</button>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>파트너 선수 1</div>
                    <select style={styles.input} value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
                      <option value="">선수 선택</option>
                      {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>파트너 선수 2</div>
                    <select style={styles.input} value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)}>
                      <option value="">선수 선택</option>
                      {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ alignSelf: "end" }}>
                    <button onClick={assignFixedPartner} style={{ ...styles.button, background: "#6366f1", color: "#fff", width: "100%" }}>고정 파트너 지정</button>
                  </div>
                </div>
              </Section>
            )}

            <Section
              title={`선수 목록 (${players.length}명)`}
              right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={generateSchedule} style={{ ...styles.button, background: "linear-gradient(135deg,#6366f1 0%,#3b82f6 100%)", color: "#fff" }}>🚀 대진표 생성</button><button onClick={resetPlayers} style={{ ...styles.button, background: "#ef4444", color: "#fff" }}>🗑 전체 초기화</button></div>}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                  <thead>
                    <tr>
                      {["이름", "성별", "급수", "연령대", "기본점수", "커스텀", "적용점수", "목표경기", ...(mode === "rivalry" ? ["소속팀"] : []), ...(mode === "league" ? ["수동팀", "고정파트너"] : []), ...(mode === "tournament" ? ["참가종목"] : []), "삭제"].map((h) => <th key={h} style={styles.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => {
                      const partner = players.find((x) => x.id === p.fixedPartnerId);
                      return (
                        <tr key={p.id}>
                          <td style={styles.td}><b>{p.name}</b></td>
                          <td style={styles.td}><Pill tone={p.gender === "남" ? "blue" : "pink"}>{p.gender}</Pill></td>
                          <td style={styles.td}>{p.grade}</td>
                          <td style={styles.td}><Pill tone="green">{p.ageBand}</Pill></td>
                          <td style={styles.td}>{getBaseScore(p.grade, p.gender)}</td>
                          <td style={styles.td}><input type="number" step="0.1" style={{ ...styles.input, width: 90 }} value={p.customScore ?? ""} onChange={(e) => updatePlayer(p.id, { customScore: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                          <td style={styles.td}><b>{getPlayerScore(p)}</b></td>
                          <td style={styles.td}><input type="number" style={{ ...styles.input, width: 90 }} value={p.maxGames} onChange={(e) => updatePlayer(p.id, { maxGames: clamp(e.target.value || 3, 1, 20) })} /></td>
                          {mode === "rivalry" && <td style={styles.td}><select style={styles.input} value={p.rivalryTeam} onChange={(e) => updatePlayer(p.id, { rivalryTeam: e.target.value })}>{RIVALRY_TEAMS.map((t) => <option key={t}>{t}</option>)}</select></td>}
                          {mode === "league" && (
                            <>
                              <td style={styles.td}>
                                {p.leagueTargetTeam ? (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <Pill tone="orange">{p.leagueTargetTeam}</Pill>
                                    <button onClick={() => clearManualLeaguePlacement(p.id)} style={{ ...styles.button, background: "#fff", border: "1px solid #cbd5e1", padding: "6px 8px", fontSize: 12 }}>해제</button>
                                  </div>
                                ) : "-"}
                              </td>
                              <td style={styles.td}>
                                {partner ? (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <Pill tone="indigo">{partner.name}</Pill>
                                    <button onClick={() => clearFixedPartner(p.id)} style={{ ...styles.button, background: "#fff", border: "1px solid #cbd5e1", padding: "6px 8px", fontSize: 12 }}>해제</button>
                                  </div>
                                ) : "-"}
                              </td>
                            </>
                          )}
                          {mode === "tournament" && <td style={styles.td}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label><input type="checkbox" checked={p.events.nam} disabled={p.gender !== "남"} onChange={(e) => updatePlayer(p.id, { events: normalizeEventsByGender(p.gender, { ...p.events, nam: e.target.checked }) })} /> 남복</label><label><input type="checkbox" checked={p.events.yeo} disabled={p.gender !== "여"} onChange={(e) => updatePlayer(p.id, { events: normalizeEventsByGender(p.gender, { ...p.events, yeo: e.target.checked }) })} /> 여복</label><label><input type="checkbox" checked={p.events.hon} onChange={(e) => updatePlayer(p.id, { events: normalizeEventsByGender(p.gender, { ...p.events, hon: e.target.checked }) })} /> 혼복</label></div></td>}
                          <td style={styles.td}><button onClick={() => removePlayer(p.id)} style={{ ...styles.button, background: "transparent", color: "#ef4444", padding: 0 }}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        )}

        {tab === "schedule" && (
          <div style={{ display: "grid", gap: 16 }}>
            {!schedule.length ? (
              <div style={{ ...styles.card, padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>생성된 대진표가 없습니다.</div>
                <div style={{ marginTop: 8, color: "#64748b" }}>선수 등록 후 대진표를 생성해 주세요.</div>
              </div>
            ) : (
              <>
                <Section title="매칭 결과" right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={generateSchedule} style={{ ...styles.button, background: "linear-gradient(135deg,#6366f1 0%,#3b82f6 100%)", color: "#fff" }}>🔄 재생성</button><button onClick={downloadExcel} style={{ ...styles.button, background: "#16a34a", color: "#fff" }}>📊 엑셀 저장</button><button onClick={downloadImage} style={{ ...styles.button, background: "#fff", border: "1px solid #cbd5e1" }}>🖼 이미지 저장</button></div>}>
                  <div style={{ color: "#475569" }}>모드: {MODES.find((m) => m.value === mode)?.label} / 라운드 {schedule.length}개</div>
                </Section>

                {mode === "league" && !!leagueTeams.length && (
                  <>
                    <Section title="정기전 팀 구성">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
                        {leagueTeams.map((team) => (
                          <div key={team.id} style={{ border: "1px solid #dcfce7", background: "#f0fdf4", borderRadius: 18, padding: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <div style={{ fontWeight: 900, fontSize: 20, color: "#166534" }}>{team.name}</div>
                              <Pill tone="green">{typeLabel(team.matchMode)}</Pill>
                            </div>
                            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                              {team.players.map((p) => (
                                <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <div><b>{p.name}</b>{p.leagueBorrowedFrom ? <span style={{ color: "#c2410c", marginLeft: 6 }}>(보충:{p.leagueBorrowedFrom})</span> : null}</div>
                                  <div style={{ color: "#475569" }}>{p.gender}/{p.grade}/{p.ageBand}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, fontWeight: 800 }}>파트너</div>
                            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                              {team.pairs.map((pair) => (
                                <div key={pair.id} style={{ background: "#fff", borderRadius: 12, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <div>{pair.label}</div>
                                  <div style={{ color: "#475569" }}>{pair.players.map((p) => p.name).join(" / ")}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>

                    <Section title="정기전 팀별 순위표">
                      <div style={{ display: "grid", gap: 16 }}>
                        {Object.entries(leagueStandings).map(([teamName, rows]) => (
                          <div key={teamName} style={{ overflowX: "auto" }}>
                            <div style={{ fontWeight: 900, marginBottom: 8 }}>{teamName}</div>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                              <thead>
                                <tr>{["순위", "조", "선수", "경기", "승", "무", "패", "득점", "실점", "득실차", "승점"].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
                              </thead>
                              <tbody>
                                {rows.map((row, idx) => (
                                  <tr key={row.id}>
                                    <td style={styles.td}><b>{idx + 1}</b></td>
                                    <td style={styles.td}>{row.label}</td>
                                    <td style={styles.td}>{row.players.map((p) => p.name).join(" / ")}</td>
                                    <td style={styles.td}>{row.played}</td>
                                    <td style={styles.td}>{row.wins}</td>
                                    <td style={styles.td}>{row.draws}</td>
                                    <td style={styles.td}>{row.losses}</td>
                                    <td style={styles.td}>{row.pointsFor}</td>
                                    <td style={styles.td}>{row.pointsAgainst}</td>
                                    <td style={styles.td}>{row.diff}</td>
                                    <td style={styles.td}><b>{row.leaguePoints}</b></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                <div ref={scheduleRef} style={{ display: "grid", gap: 16 }}>
                  {schedule.map((round) => (
                    <div key={round.id} style={{ ...styles.card, overflow: "hidden" }}>
                      <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#334155 100%)", color: "#fff", padding: 14, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>{mode === "league" ? `${round.groupName} / ${round.internalRound}R` : `ROUND ${round.id}`}</div>
                        <Pill tone="slate">{round.matches.length} matches</Pill>
                      </div>
                      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
                        {round.matches.map((m, idx) => (
                          <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, background: "linear-gradient(180deg,#fff 0%,#f8fafc 100%)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <Pill tone="indigo">{m.courtId}코트</Pill>
                              <Pill tone="slate">{m.label}</Pill>
                            </div>

                            {mode === "league" ? (
                              <>
                                <div style={{ marginTop: 12, borderRadius: 16, background: "#eff6ff", border: "1px solid #bfdbfe", padding: 12 }}>
                                  <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 800 }}>{m.pairA.label}</div>
                                  {m.pairA.players.map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0" }}><div><b>{p.name}</b></div><div style={{ color: "#475569" }}>{p.gender}/{p.grade}/{p.ageBand}</div></div>)}
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bfdbfe", textAlign: "right", fontWeight: 900, color: "#1d4ed8" }}>예측합 {m.scoreA.toFixed(1)}</div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, margin: "10px 0" }}>
                                  <div style={{ fontSize: 24, fontWeight: 950, color: "#94a3b8" }}>VS</div>
                                  <Pill tone="green">{m.diff.toFixed(1)}차</Pill>
                                </div>
                                <div style={{ borderRadius: 16, background: "#fff1f2", border: "1px solid #fecdd3", padding: 12 }}>
                                  <div style={{ fontSize: 12, color: "#be123c", fontWeight: 800 }}>{m.pairB.label}</div>
                                  {m.pairB.players.map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0" }}><div><b>{p.name}</b></div><div style={{ color: "#475569" }}>{p.gender}/{p.grade}/{p.ageBand}</div></div>)}
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #fecdd3", textAlign: "right", fontWeight: 900, color: "#be123c" }}>예측합 {m.scoreB.toFixed(1)}</div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 12 }}>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>{m.pairA.label} 실제점수</div>
                                    <input type="number" min={0} style={styles.input} value={m.result?.a ?? ""} onChange={(e) => updateLeagueScore(round.id, idx, "a", e.target.value)} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#64748b" }}>{m.pairB.label} 실제점수</div>
                                    <input type="number" min={0} style={styles.input} value={m.result?.b ?? ""} onChange={(e) => updateLeagueScore(round.id, idx, "b", e.target.value)} />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ marginTop: 12, borderRadius: 16, background: "#eff6ff", border: "1px solid #bfdbfe", padding: 12 }}>
                                  <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 800 }}>{mode === "rivalry" ? m.teamA[0].rivalryTeam : "TEAM A"}</div>
                                  {m.teamA.map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0" }}><div><b>{p.name}</b></div><div style={{ color: "#475569" }}>{p.gender}/{p.grade} ({getPlayerScore(p)})</div></div>)}
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bfdbfe", textAlign: "right", fontWeight: 900, color: "#1d4ed8" }}>합계 {m.scoreA.toFixed(1)}</div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, margin: "10px 0" }}>
                                  <div style={{ fontSize: 24, fontWeight: 950, color: "#94a3b8" }}>VS</div>
                                  <Pill tone="green">{m.diff.toFixed(1)}차</Pill>
                                </div>
                                <div style={{ borderRadius: 16, background: "#fff1f2", border: "1px solid #fecdd3", padding: 12 }}>
                                  <div style={{ fontSize: 12, color: "#be123c", fontWeight: 800 }}>{mode === "rivalry" ? m.teamB[0].rivalryTeam : "TEAM B"}</div>
                                  {m.teamB.map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0" }}><div><b>{p.name}</b></div><div style={{ color: "#475569" }}>{p.gender}/{p.grade} ({getPlayerScore(p)})</div></div>)}
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #fecdd3", textAlign: "right", fontWeight: 900, color: "#be123c" }}>합계 {m.scoreB.toFixed(1)}</div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
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
