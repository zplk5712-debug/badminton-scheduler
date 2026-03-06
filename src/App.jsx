import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

/**
 * 배드민턴 밸런스 매처 v10
 * - 1파일 통합 버전
 * - 모바일/PC 반응형
 * - 선수 자동 저장(localStorage)
 * - 엑셀 업로드
 * - JSON 백업/복원
 * - 코트 카드형 대진표
 * - 라운드 아코디언
 * - A4 가로 인쇄 모드
 * - 상대/파트너 반복 최소화(약하게)
 * - 부족자 우선 재생성 토글
 */

const STORAGE_KEY = "bm_scheduler_v10_allinone";

const GRADES = ["A", "B", "C", "D", "초심"];
const MALE_POINTS = { A: 5, B: 4, C: 3, D: 2, 초심: 1 };
const FEMALE_POINTS = { A: 3.8, B: 2.5, C: 2.0, D: 1.5, 초심: 0.5 };

const GRADE_COLOR = {
  A: "#ef4444",
  B: "#3b82f6",
  C: "#22c55e",
  D: "#f59e0b",
  초심: "#9ca3af",
};

const DEFAULT_TITLE = "배드민턴 대진표";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const normalize = (s) => String(s ?? "").trim();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function gradeColor(grade) {
  return GRADE_COLOR[grade] || "#9ca3af";
}

function getBaseScore(grade, gender) {
  if (gender === "남") return MALE_POINTS[grade] ?? 3;
  return FEMALE_POINTS[grade] ?? 2;
}

function isManualScore(player) {
  return player.scoreOverride !== null && player.scoreOverride !== undefined && player.scoreOverride !== "";
}

function getAppliedScore(player) {
  if (isManualScore(player)) return Number(player.scoreOverride);
  return getBaseScore(player.grade, player.gender);
}

function getType(team) {
  const maleCount = team.filter((p) => p.gender === "남").length;
  if (maleCount === 2) return "남복";
  if (maleCount === 1) return "혼복";
  return "여복";
}

function isForbiddenMatch(typeA, typeB) {
  const mixedVsMale = (typeA === "혼복" && typeB === "남복") || (typeA === "남복" && typeB === "혼복");
  const maleVsFemale = (typeA === "남복" && typeB === "여복") || (typeA === "여복" && typeB === "남복");
  return mixedVsMale || maleVsFemale;
}

function teamScore(team) {
  return team.reduce((sum, p) => sum + getAppliedScore(p), 0);
}

function buildNameForSchedule(name) {
  const text = String(name ?? "");
  if (text.length >= 4) return `${text.slice(0, 2)}\n${text.slice(2)}`;
  return text;
}

function playerNameShort(name) {
  return String(name ?? "").slice(0, 5);
}

function formatScore(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "";
  return x % 1 === 0 ? x.toFixed(0) : x.toFixed(1);
}

function getNameCounts(players) {
  const map = new Map();
  players.forEach((p) => {
    const key = normalize(p.name);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function getAssignedCounts(rounds) {
  const map = new Map();
  rounds.forEach((round) => {
    round.matches.forEach((m) => {
      [...m.teamAIds, ...m.teamBIds].forEach((id) => {
        map.set(id, (map.get(id) || 0) + 1);
      });
    });
  });
  return map;
}

function getPlayerMap(players) {
  const map = new Map();
  players.forEach((p) => map.set(p.id, p));
  return map;
}

function pairKey(a, b) {
  return [a, b].sort().join("::");
}

function opponentPenalty(teamA, teamB, opponentHistory) {
  let penalty = 0;
  for (const a of teamA) {
    for (const b of teamB) {
      const count = opponentHistory.get(pairKey(a.id, b.id)) || 0;
      if (count >= 1) penalty += 18 + count * 14;
    }
  }
  return penalty;
}

function partnerPenalty(team, partnerHistory) {
  const [a, b] = team;
  const count = partnerHistory.get(pairKey(a.id, b.id)) || 0;
  if (count >= 1) return 22 + count * 18;
  return 0;
}

function weakerMixedRuleOK(team, isWeaker) {
  if (!isWeaker) return true;
  const male = team.find((p) => p.gender === "남");
  const female = team.find((p) => p.gender === "여");
  if (male && female) return getAppliedScore(male) >= getAppliedScore(female);
  return true;
}

function buildAllSplits(a, b, c, d) {
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

function evaluateFourPlayers(four, options, partnerHistory, opponentHistory) {
  const [a, b, c, d] = four;
  let best = null;
  let bestPenalty = Infinity;

  for (const split of buildAllSplits(a, b, c, d)) {
    const typeA = getType(split.teamA);
    const typeB = getType(split.teamB);

    if (isForbiddenMatch(typeA, typeB)) continue;

    const scoreA = teamScore(split.teamA);
    const scoreB = teamScore(split.teamB);
    const diff = Math.abs(scoreA - scoreB);
    if (diff > options.maxDiff) continue;

    // 혼복 vs 여복이면 gap 체크
    const mixedVsFemale =
      (typeA === "혼복" && typeB === "여복") || (typeA === "여복" && typeB === "혼복");

    if (mixedVsFemale) {
      const mixedScore = typeA === "혼복" ? scoreA : scoreB;
      const femaleScore = typeA === "여복" ? scoreA : scoreB;
      const gap = femaleScore - mixedScore;
      if (gap < options.mixedVsFemaleGapMin || gap > options.mixedVsFemaleGapMax) continue;
    }

    const isTeamAWeaker = scoreA < scoreB;
    const isTeamBWeaker = scoreB < scoreA;

    const validA = scoreA === scoreB ? true : weakerMixedRuleOK(split.teamA, isTeamAWeaker);
    const validB = scoreA === scoreB ? true : weakerMixedRuleOK(split.teamB, isTeamBWeaker);
    if (!validA || !validB) continue;

    const partnerP = partnerPenalty(split.teamA, partnerHistory) + partnerPenalty(split.teamB, partnerHistory);
    const opponentP = opponentPenalty(split.teamA, split.teamB, opponentHistory);

    let penalty = diff * 10 + partnerP + opponentP;

    bestPenalty = penalty < bestPenalty ? penalty : bestPenalty;
    if (penalty <= bestPenalty) {
      best = {
        ...split,
        scoreA,
        scoreB,
        diff,
        typeA,
        typeB,
        penalty,
      };
    }
  }

  return best;
}

function buildRoundGreedy(availablePlayers, courts, options, partnerHistory, opponentHistory) {
  const targetMatchCount = Math.min(courts, Math.floor(availablePlayers.length / 4));
  if (targetMatchCount <= 0) return [];

  const unused = new Set(availablePlayers.map((p) => p.id));
  const playerMap = new Map(availablePlayers.map((p) => [p.id, p]));
  const matches = [];

  for (let court = 1; court <= targetMatchCount; court++) {
    const left = Array.from(unused).map((id) => playerMap.get(id));
    if (left.length < 4) break;

    let bestCandidate = null;

    // 우선순위 높은 선수 몇 명을 anchor로
    const anchors = left.slice(0, Math.min(left.length, 8));

    for (const anchor of anchors) {
      const others = left.filter((p) => p.id !== anchor.id).slice(0, 14);

      for (let i = 0; i < others.length; i++) {
        for (let j = i + 1; j < others.length; j++) {
          for (let k = j + 1; k < others.length; k++) {
            const four = [anchor, others[i], others[j], others[k]];
            const evaluated = evaluateFourPlayers(four, options, partnerHistory, opponentHistory);
            if (!evaluated) continue;

            if (!bestCandidate || evaluated.penalty < bestCandidate.penalty) {
              bestCandidate = { court, ...evaluated };
            }
          }
        }
      }
    }

    if (!bestCandidate) break;

    matches.push(bestCandidate);
    [...bestCandidate.teamA, ...bestCandidate.teamB].forEach((p) => unused.delete(p.id));
  }

  return matches;
}

function updateHistories(roundMatches, partnerHistory, opponentHistory) {
  roundMatches.forEach((m) => {
    const [a1, a2] = m.teamA;
    const [b1, b2] = m.teamB;

    const pA = pairKey(a1.id, a2.id);
    const pB = pairKey(b1.id, b2.id);
    partnerHistory.set(pA, (partnerHistory.get(pA) || 0) + 1);
    partnerHistory.set(pB, (partnerHistory.get(pB) || 0) + 1);

    for (const a of m.teamA) {
      for (const b of m.teamB) {
        const key = pairKey(a.id, b.id);
        opponentHistory.set(key, (opponentHistory.get(key) || 0) + 1);
      }
    }
  });
}

function generateSchedule(players, settings) {
  const {
    courts,
    maxRounds,
    shortagePriority,
    maxDiff,
    mixedVsFemaleGapMin,
    mixedVsFemaleGapMax,
    title,
  } = settings;

  const options = {
    maxDiff,
    mixedVsFemaleGapMin,
    mixedVsFemaleGapMax,
  };

  const assigned = new Map(players.map((p) => [p.id, 0]));
  const partnerHistory = new Map();
  const opponentHistory = new Map();
  const rounds = [];

  let guard = 0;
  while (guard < 200) {
    guard += 1;

    if (maxRounds && rounds.length >= maxRounds) break;

    let available = players.filter((p) => assigned.get(p.id) < p.targetGames);
    if (available.length < 4) break;

    available = [...available].sort((a, b) => {
      const remainA = a.targetGames - (assigned.get(a.id) || 0);
      const remainB = b.targetGames - (assigned.get(b.id) || 0);

      if (shortagePriority && remainA !== remainB) return remainB - remainA;
      if (shortagePriority) {
        if ((assigned.get(a.id) || 0) !== (assigned.get(b.id) || 0)) {
          return (assigned.get(a.id) || 0) - (assigned.get(b.id) || 0);
        }
      }

      const scoreDiff = getAppliedScore(b) - getAppliedScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    });

    // 약간 랜덤성 추가
    const head = available.slice(0, Math.min(18, available.length));
    const tail = available.slice(Math.min(18, available.length));
    head.sort(() => Math.random() - 0.5);
    available = [...head, ...tail];

    const matches = buildRoundGreedy(available, courts, options, partnerHistory, opponentHistory);

    if (!matches.length) break;

    matches.forEach((m) => {
      [...m.teamA, ...m.teamB].forEach((p) => {
        assigned.set(p.id, (assigned.get(p.id) || 0) + 1);
      });
    });

    updateHistories(matches, partnerHistory, opponentHistory);

    rounds.push({
      id: uid(),
      title: `ROUND ${rounds.length + 1}`,
      matches: matches.map((m) => ({
        id: uid(),
        court: m.court,
        teamAIds: m.teamA.map((p) => p.id),
        teamBIds: m.teamB.map((p) => p.id),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        diff: m.diff,
        typeA: m.typeA,
        typeB: m.typeB,
      })),
    });

    const remain = players.filter((p) => (assigned.get(p.id) || 0) < p.targetGames);
    if (remain.length < 4) break;
  }

  return {
    title,
    createdAt: new Date().toISOString(),
    rounds,
    assigned,
  };
}

function summaryRows(players, assignedMap) {
  return players.map((p) => {
    const assigned = assignedMap.get(p.id) || 0;
    const diff = assigned - p.targetGames;
    return {
      ...p,
      assigned,
      diff,
    };
  });
}

function exportPlayersJson(players) {
  const blob = new Blob([JSON.stringify(players, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `players_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function scheduleToExcel(rounds, playerMap, title) {
  const rows = [];
  rounds.forEach((round) => {
    round.matches.forEach((m) => {
      const teamA = m.teamAIds.map((id) => playerMap.get(id)?.name || "");
      const teamB = m.teamBIds.map((id) => playerMap.get(id)?.name || "");
      rows.push({
        제목: title,
        라운드: round.title,
        코트: `${m.court}코트`,
        타입: `${m.typeA} vs ${m.typeB}`,
        "TEAM A-1": teamA[0] || "",
        "TEAM A-2": teamA[1] || "",
        "TEAM B-1": teamB[0] || "",
        "TEAM B-2": teamB[1] || "",
        "TEAM A 합": formatScore(m.scoreA),
        "TEAM B 합": formatScore(m.scoreB),
        "점수차 Δ": formatScore(m.diff),
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "대진표");
  XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function App() {
  const initialState = loadState();

  const [title, setTitle] = useState(initialState?.title || DEFAULT_TITLE);
  const [players, setPlayers] = useState(initialState?.players || []);
  const [schedule, setSchedule] = useState(initialState?.schedule || null);

  const [courts, setCourts] = useState(initialState?.courts || 4);
  const [defaultTargetGames, setDefaultTargetGames] = useState(initialState?.defaultTargetGames || 3);
  const [maxRoundsInput, setMaxRoundsInput] = useState(initialState?.maxRoundsInput || "");
  const [shortagePriority, setShortagePriority] = useState(initialState?.shortagePriority || false);

  const [maxDiff, setMaxDiff] = useState(initialState?.maxDiff || 1.0);
  const [mixedVsFemaleGapMin, setMixedVsFemaleGapMin] = useState(initialState?.mixedVsFemaleGapMin || 1);
  const [mixedVsFemaleGapMax, setMixedVsFemaleGapMax] = useState(initialState?.mixedVsFemaleGapMax || 2);

  const [newPlayer, setNewPlayer] = useState({
    name: "",
    gender: "남",
    grade: "C",
    targetGames: 3,
  });

  const [expandedRounds, setExpandedRounds] = useState(() => {
    if (initialState?.schedule?.rounds?.length) {
      return initialState.schedule.rounds.map((r) => r.id);
    }
    return [];
  });

  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  useEffect(() => {
    saveState({
      title,
      players,
      schedule,
      courts,
      defaultTargetGames,
      maxRoundsInput,
      shortagePriority,
      maxDiff,
      mixedVsFemaleGapMin,
      mixedVsFemaleGapMax,
    });
  }, [
    title,
    players,
    schedule,
    courts,
    defaultTargetGames,
    maxRoundsInput,
    shortagePriority,
    maxDiff,
    mixedVsFemaleGapMin,
    mixedVsFemaleGapMax,
  ]);

  const assignedMap = useMemo(() => {
    if (!schedule?.rounds?.length) return new Map();
    return getAssignedCounts(schedule.rounds);
  }, [schedule]);

  const playerMap = useMemo(() => getPlayerMap(players), [players]);

  const nameCountMap = useMemo(() => getNameCounts(players), [players]);

  const summary = useMemo(() => {
    const rows = summaryRows(players, assignedMap).sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [players, assignedMap]);

  const shortageRows = useMemo(() => summary.filter((x) => x.diff < 0), [summary]);

  function addPlayer() {
    const name = normalize(newPlayer.name);
    if (!name) return;

    setPlayers((prev) => [
      ...prev,
      {
        id: uid(),
        name,
        gender: newPlayer.gender,
        grade: newPlayer.grade,
        targetGames: clamp(Number(newPlayer.targetGames) || 3, 1, 30),
        scoreOverride: null,
      },
    ]);

    setNewPlayer((prev) => ({ ...prev, name: "" }));
  }

  function updatePlayer(id, patch) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePlayer(id) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function applyDefaultTargetToAll() {
    const value = clamp(Number(defaultTargetGames) || 3, 1, 30);
    setPlayers((prev) => prev.map((p) => ({ ...p, targetGames: value })));
  }

  function resetScoreToAuto(id) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, scoreOverride: null } : p))
    );
  }

  function buildSchedule() {
    const maxRounds = maxRoundsInput === "" ? null : clamp(Number(maxRoundsInput) || 1, 1, 999);
    const result = generateSchedule(players, {
      courts: clamp(Number(courts) || 4, 1, 10),
      maxRounds,
      shortagePriority,
      maxDiff: Number(maxDiff) || 1.0,
      mixedVsFemaleGapMin: Number(mixedVsFemaleGapMin) || 1,
      mixedVsFemaleGapMax: Number(mixedVsFemaleGapMax) || 2,
      title: title || DEFAULT_TITLE,
    });
    setSchedule(result);
    setExpandedRounds(result.rounds.map((r) => r.id));
  }

  function clearAll() {
    if (!window.confirm("선수/설정/대진표를 모두 삭제할까요?")) return;
    setPlayers([]);
    setSchedule(null);
    setTitle(DEFAULT_TITLE);
    setCourts(4);
    setDefaultTargetGames(3);
    setMaxRoundsInput("");
    setShortagePriority(false);
    setExpandedRounds([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function handleExcelUpload(file) {
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const mapped = rows
        .map((row) => {
          const name = normalize(row["이름"] || row["name"] || row["Name"]);
          if (!name) return null;

          const gender = normalize(row["성별"] || row["gender"] || row["Gender"]) === "여" ? "여" : "남";
          const gradeRaw = normalize(row["급수"] || row["grade"] || row["Grade"]);
          const grade = GRADES.includes(gradeRaw) ? gradeRaw : "C";
          const targetGames = clamp(
            Number(row["목표경기"] || row["targetGames"] || row["TargetGames"] || 3),
            1,
            30
          );
          const appliedScore = row["적용점수"] || row["score"] || row["appliedScore"] || "";
          const base = getBaseScore(grade, gender);
          const scoreOverride =
            appliedScore === "" || appliedScore === null || appliedScore === undefined
              ? null
              : Number(appliedScore) === base
              ? null
              : Number(appliedScore);

          return {
            id: uid(),
            name,
            gender,
            grade,
            targetGames,
            scoreOverride: Number.isFinite(Number(scoreOverride)) ? Number(scoreOverride) : null,
          };
        })
        .filter(Boolean);

      setPlayers((prev) => [...prev, ...mapped]);
    } catch {
      alert("엑셀 파일을 읽지 못했어. 컬럼명을 확인해줘.");
    }
  }

  async function handleJsonImport(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) {
        alert("JSON 형식이 올바르지 않아.");
        return;
      }

      const mode = window.prompt(
        "불러오기 방식 입력:\n1 = 기존 유지 + 추가\n2 = 기존 전체 교체",
        "1"
      );

      const clean = imported
        .map((p) => ({
          id: uid(),
          name: normalize(p.name),
          gender: p.gender === "여" ? "여" : "남",
          grade: GRADES.includes(p.grade) ? p.grade : "C",
          targetGames: clamp(Number(p.targetGames) || 3, 1, 30),
          scoreOverride:
            p.scoreOverride === null || p.scoreOverride === undefined || p.scoreOverride === ""
              ? null
              : Number(p.scoreOverride),
        }))
        .filter((p) => p.name);

      if (mode === "2") {
        setPlayers(clean);
      } else {
        setPlayers((prev) => [...prev, ...clean]);
      }
    } catch {
      alert("JSON 파일을 읽지 못했어.");
    }
  }

  function toggleRound(roundId) {
    setExpandedRounds((prev) =>
      prev.includes(roundId) ? prev.filter((x) => x !== roundId) : [...prev, roundId]
    );
  }

  function expandAll() {
    if (!schedule?.rounds) return;
    setExpandedRounds(schedule.rounds.map((r) => r.id));
  }

  function collapseAll() {
    setExpandedRounds([]);
  }

  function copyScheduleText() {
    if (!schedule?.rounds?.length) return;
    const lines = [];
    lines.push(title || DEFAULT_TITLE);
    lines.push(`${courts}코트 / ${schedule.rounds.length}라운드`);
    lines.push("");

    schedule.rounds.forEach((round) => {
      lines.push(round.title);
      round.matches.forEach((m) => {
        const teamA = m.teamAIds.map((id) => playerMap.get(id)?.name || "").join(", ");
        const teamB = m.teamBIds.map((id) => playerMap.get(id)?.name || "").join(", ");
        lines.push(`${m.court}코트 | ${teamA}  VS  ${teamB} | ${formatScore(m.scoreA)}:${formatScore(m.scoreB)} Δ${formatScore(m.diff)}`);
      });
      lines.push("");
    });

    navigator.clipboard.writeText(lines.join("\n"));
    alert("대진표 텍스트를 복사했어.");
  }

  function printSchedule() {
    if (!schedule?.rounds?.length) return;
    expandAll();
    setTimeout(() => window.print(), 80);
  }

  const printMeta = useMemo(() => {
    const date = new Date().toLocaleDateString("ko-KR").replace(/\./g, "-").replace(/\s/g, "");
    return `${date} | ${courts}코트 | ${schedule?.rounds?.length || 0}라운드`;
  }, [courts, schedule]);

  return (
    <div className="app">
      <style>{css}</style>

      <div className="shell">
        {/* 헤더 */}
        <header className="app-header no-print">
          <div className="header-left">
            <div className="app-icon">🏸</div>
            <div>
              <div className="app-title">배드민턴 밸런스 매처 v10</div>
              <div className="app-sub">모바일/PC/출력용 통합 버전</div>
            </div>
          </div>
        </header>

        {/* 설정 */}
        <section className="panel no-print">
          <div className="panel-title">설정</div>

          <div className="settings-grid">
            <label className="field wide">
              <span>대진표 제목</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={DEFAULT_TITLE} />
            </label>

            <label className="field">
              <span>코트 수</span>
              <input
                type="number"
                min={1}
                max={10}
                value={courts}
                onChange={(e) => setCourts(clamp(Number(e.target.value) || 4, 1, 10))}
              />
            </label>

            <label className="field">
              <span>기본 목표경기</span>
              <input
                type="number"
                min={1}
                max={30}
                value={defaultTargetGames}
                onChange={(e) => setDefaultTargetGames(clamp(Number(e.target.value) || 3, 1, 30))}
              />
            </label>

            <div className="field btn-field">
              <span>전원 적용</span>
              <button onClick={applyDefaultTargetToAll}>전원 적용</button>
            </div>

            <label className="field">
              <span>최대 라운드(선택)</span>
              <input
                type="number"
                min={1}
                value={maxRoundsInput}
                onChange={(e) => setMaxRoundsInput(e.target.value)}
                placeholder="비우면 무제한"
              />
            </label>

            <label className="field">
              <span>점수차 최대(Δ)</span>
              <input
                type="number"
                step="0.1"
                value={maxDiff}
                onChange={(e) => setMaxDiff(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span>혼복vs여복 gap 최소</span>
              <input
                type="number"
                value={mixedVsFemaleGapMin}
                onChange={(e) => setMixedVsFemaleGapMin(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span>혼복vs여복 gap 최대</span>
              <input
                type="number"
                value={mixedVsFemaleGapMax}
                onChange={(e) => setMixedVsFemaleGapMax(Number(e.target.value))}
              />
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={shortagePriority}
                onChange={(e) => setShortagePriority(e.target.checked)}
              />
              <span>부족자 우선 재생성</span>
            </label>
          </div>

          <div className="toolbar">
            <button className="primary" onClick={buildSchedule}>대진표 생성</button>
            <button onClick={() => fileInputRef.current?.click()}>엑셀 업로드</button>
            <button onClick={() => exportPlayersJson(players)}>명단 백업(JSON)</button>
            <button onClick={() => jsonInputRef.current?.click()}>명단 복원(JSON)</button>
            <button className="danger" onClick={clearAll}>전체삭제</button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => handleExcelUpload(e.target.files?.[0])}
            />
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              hidden
              onChange={(e) => handleJsonImport(e.target.files?.[0])}
            />
          </div>
        </section>

        <div className="content-grid">
          {/* 선수 관리 */}
          <section className="panel no-print">
            <div className="panel-title">선수 등록 / 관리</div>

            <div className="add-row">
              <input
                className="name-input"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="이름"
              />
              <select
                value={newPlayer.gender}
                onChange={(e) => setNewPlayer((prev) => ({ ...prev, gender: e.target.value }))}
              >
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
              <select
                value={newPlayer.grade}
                onChange={(e) => setNewPlayer((prev) => ({ ...prev, grade: e.target.value }))}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={30}
                value={newPlayer.targetGames}
                onChange={(e) => setNewPlayer((prev) => ({
                  ...prev,
                  targetGames: clamp(Number(e.target.value) || 3, 1, 30),
                }))}
              />
              <button className="primary" onClick={addPlayer}>추가</button>
            </div>

            <div className="player-list">
              {players.length === 0 && <div className="empty">선수가 아직 없어.</div>}

              {players.map((p) => {
                const assigned = assignedMap.get(p.id) || 0;
                const duplicateWarn = (nameCountMap.get(normalize(p.name)) || 0) > 1;

                return (
                  <div className="player-card" key={p.id}>
                    <div className="player-card-top">
                      <div className="player-name-wrap">
                        <input
                          className="player-name"
                          value={p.name}
                          onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                          title={p.name}
                        />
                        {duplicateWarn && <span className="dup-warn">⚠</span>}
                      </div>

                      <span
                        className="grade-pill"
                        style={{ backgroundColor: `${gradeColor(p.grade)}22`, color: gradeColor(p.grade), borderColor: `${gradeColor(p.grade)}66` }}
                      >
                        {p.gender} {p.grade}
                      </span>

                      <button className="icon danger" onClick={() => removePlayer(p.id)}>✕</button>
                    </div>

                    <div className="player-card-bottom">
                      <div className="mini-field">
                        <span>목</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={p.targetGames}
                          onChange={(e) => updatePlayer(p.id, { targetGames: clamp(Number(e.target.value) || 3, 1, 30) })}
                        />
                      </div>

                      <div className="mini-field score-field">
                        <span>점</span>
                        <input
                          type="number"
                          step="0.1"
                          value={isManualScore(p) ? p.scoreOverride : getAppliedScore(p)}
                          onChange={(e) => {
                            const v = e.target.value;
                            updatePlayer(p.id, {
                              scoreOverride: v === "" ? null : Number(v),
                            });
                          }}
                        />
                        <span className={`mode-badge ${isManualScore(p) ? "manual" : "auto"}`}>
                          {isManualScore(p) ? "수동" : "자동"}
                        </span>
                        {isManualScore(p) && (
                          <button className="icon tiny" onClick={() => resetScoreToAuto(p.id)}>↺</button>
                        )}
                      </div>

                      <div className="mini-field readonly">
                        <span>출</span>
                        <div>{assigned}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 대진표 */}
          <section className="panel print-panel">
            <div className="schedule-header no-print">
              <div>
                <div className="panel-title">대진표</div>
                <div className="muted">
                  {title || DEFAULT_TITLE} · {courts}코트 · {schedule?.rounds?.length || 0}라운드
                </div>
              </div>

              <div className="toolbar compact">
                <button onClick={expandAll}>모두 펼치기</button>
                <button onClick={collapseAll}>모두 접기</button>
                <button onClick={copyScheduleText}>텍스트 복사</button>
                <button onClick={() => schedule?.rounds?.length && scheduleToExcel(schedule.rounds, playerMap, title || DEFAULT_TITLE)}>
                  엑셀 저장
                </button>
                <button className="primary" onClick={printSchedule}>인쇄(A4 가로)</button>
              </div>
            </div>

            {/* 인쇄용 헤더 */}
            <div className="print-header print-only">
              <div className="print-title">🏸 {title || DEFAULT_TITLE}</div>
              <div className="print-sub">{printMeta}</div>
            </div>

            {/* 출전 현황 요약 */}
            <div className="summary-box">
              <div className="summary-title">출전 현황 요약</div>
              <div className="summary-table-wrap">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>목표</th>
                      <th>배정</th>
                      <th>차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="name-cell">
                            <span style={{ color: gradeColor(row.grade) }}>●</span> {playerNameShort(row.name)}
                            {(nameCountMap.get(normalize(row.name)) || 0) > 1 && <span className="dup-warn-inline">⚠</span>}
                          </span>
                        </td>
                        <td>{row.targetGames}</td>
                        <td>{row.assigned}</td>
                        <td>
                          {row.diff === 0 && <span className="ok">✅ 0</span>}
                          {row.diff === -1 && <span className="warn">⚠ -1</span>}
                          {row.diff <= -2 && <span className="bad">❌ {row.diff}</span>}
                          {row.diff > 0 && <span>+{row.diff}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {shortageRows.length > 0 && (
                <div className="shortage-hint">
                  부족한 선수: {shortageRows.map((x) => playerNameShort(x.name)).join(", ")}
                </div>
              )}
            </div>

            {/* 라운드 아코디언 */}
            {!schedule?.rounds?.length ? (
              <div className="empty">대진표를 생성해줘.</div>
            ) : (
              <div className="round-list">
                {schedule.rounds.map((round) => {
                  const opened = expandedRounds.includes(round.id);
                  return (
                    <div className="round-accordion" key={round.id}>
                      <button className="round-toggle" onClick={() => toggleRound(round.id)}>
                        <span>{opened ? "▼" : "▶"} {round.title}</span>
                        <span>{round.matches.length} matches</span>
                      </button>

                      {opened && (
                        <div className="court-grid">
                          {round.matches.map((m) => {
                            const teamA = m.teamAIds.map((id) => playerMap.get(id)).filter(Boolean);
                            const teamB = m.teamBIds.map((id) => playerMap.get(id)).filter(Boolean);

                            return (
                              <div className="court-card" key={m.id}>
                                <div className="court-card-top">
                                  <div className="court-no">{m.court}코트</div>
                                  <div className="type-badge">{m.typeA} vs {m.typeB}</div>
                                  <div className="diff-badge">Δ {formatScore(m.diff)}</div>
                                </div>

                                <div className="team-block">
                                  <div className="team-label">TEAM A</div>
                                  <div className="team-names">
                                    {teamA.map((p) => (
                                      <div className="name-row" key={p.id}>
                                        <span
                                          className="dot"
                                          style={{ backgroundColor: gradeColor(p.grade) }}
                                        />
                                        <span className="schedule-name">{buildNameForSchedule(p.name)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="score-big">TEAM A {formatScore(m.scoreA)}</div>
                                </div>

                                <div className="vs-center">VS</div>

                                <div className="team-block">
                                  <div className="team-label">TEAM B</div>
                                  <div className="team-names">
                                    {teamB.map((p) => (
                                      <div className="name-row" key={p.id}>
                                        <span
                                          className="dot"
                                          style={{ backgroundColor: gradeColor(p.grade) }}
                                        />
                                        <span className="schedule-name">{buildNameForSchedule(p.name)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="score-big">TEAM B {formatScore(m.scoreB)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="print-footer print-only">
              Generated by Badminton Scheduler
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const css = `
:root{
  --bg:#08111f;
  --panel:#0f1b31;
  --panel-2:#12213d;
  --line:rgba(255,255,255,.10);
  --text:#eaf1ff;
  --muted:#9fb2d5;
  --primary:#25c2a0;
  --primary-2:#1952d8;
  --danger:#ef4444;
  --warn:#f59e0b;
}

*{box-sizing:border-box}
body{
  margin:0;
  background:
    radial-gradient(circle at top left, rgba(37,194,160,.10), transparent 25%),
    radial-gradient(circle at top right, rgba(25,82,216,.12), transparent 20%),
    var(--bg);
  color:var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button,input,select{
  font:inherit;
}
.app{
  min-height:100vh;
}
.shell{
  max-width:1400px;
  margin:0 auto;
  padding:16px;
}
.app-header{
  background:linear-gradient(135deg, rgba(37,194,160,.12), rgba(25,82,216,.10));
  border:1px solid var(--line);
  border-radius:18px;
  padding:16px;
  margin-bottom:14px;
}
.header-left{
  display:flex;
  align-items:center;
  gap:12px;
}
.app-icon{
  width:42px;
  height:42px;
  display:grid;
  place-items:center;
  border-radius:12px;
  background:rgba(37,194,160,.15);
  border:1px solid rgba(37,194,160,.25);
}
.app-title{
  font-size:28px;
  font-weight:900;
  line-height:1.1;
}
.app-sub{
  color:var(--muted);
  margin-top:4px;
  font-size:13px;
}

.panel{
  background:rgba(15,27,49,.92);
  border:1px solid var(--line);
  border-radius:18px;
  padding:14px;
  box-shadow:0 20px 50px rgba(0,0,0,.18);
}
.panel-title{
  font-weight:900;
  font-size:18px;
  margin-bottom:10px;
}
.muted{
  color:var(--muted);
  font-size:13px;
}

.settings-grid{
  display:grid;
  grid-template-columns:repeat(4, minmax(0, 1fr));
  gap:10px;
}
.field{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.field.wide{
  grid-column:span 2;
}
.field span{
  font-size:12px;
  color:var(--muted);
}
.field input, .field select{
  width:100%;
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
}
.btn-field button{
  height:42px;
}
.toggle{
  display:flex;
  align-items:center;
  gap:10px;
  border:1px solid var(--line);
  background:#091526;
  border-radius:12px;
  padding:10px 12px;
  min-height:42px;
  margin-top:19px;
}
.toolbar{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:12px;
}
.toolbar.compact{
  margin-top:0;
}
.toolbar button{
  border:1px solid var(--line);
  background:#0a1830;
  color:var(--text);
  padding:10px 12px;
  border-radius:12px;
  cursor:pointer;
}
.toolbar button.primary,
.add-row button.primary{
  background:linear-gradient(135deg, rgba(37,194,160,.20), rgba(25,82,216,.18));
  border-color:rgba(37,194,160,.35);
}
.toolbar button.danger{
  border-color:rgba(239,68,68,.35);
  background:rgba(239,68,68,.10);
}

.content-grid{
  display:grid;
  grid-template-columns:420px 1fr;
  gap:14px;
  margin-top:14px;
}

.add-row{
  display:grid;
  grid-template-columns:minmax(0, 1fr) 70px 80px 80px 80px;
  gap:8px;
  margin-bottom:12px;
}
.add-row input, .add-row select, .add-row button{
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
}
.name-input{
  min-width:0;
}

.player-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}
.player-card{
  border:1px solid var(--line);
  background:#0b172b;
  border-radius:14px;
  padding:10px;
}
.player-card-top,
.player-card-bottom{
  display:flex;
  align-items:center;
  gap:8px;
}
.player-card-bottom{
  margin-top:8px;
  flex-wrap:wrap;
}
.player-name-wrap{
  display:flex;
  align-items:center;
  gap:6px;
  min-width:0;
  flex:1;
}
.player-name{
  width:6ch;
  max-width:6ch;
  min-width:6ch;
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:10px;
  padding:8px 10px;
  overflow:hidden;
  white-space:nowrap;
}
.dup-warn{
  color:#fbbf24;
  font-weight:900;
}
.dup-warn-inline{
  color:#fbbf24;
  margin-left:4px;
}
.grade-pill{
  border:1px solid;
  padding:7px 10px;
  border-radius:999px;
  font-weight:800;
  white-space:nowrap;
  font-size:12px;
}
.icon{
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:10px;
  padding:7px 10px;
  cursor:pointer;
}
.icon.danger{
  border-color:rgba(239,68,68,.35);
  background:rgba(239,68,68,.10);
}
.icon.tiny{
  padding:5px 8px;
  font-size:12px;
}
.mini-field{
  display:flex;
  align-items:center;
  gap:6px;
  min-width:0;
}
.mini-field > span{
  color:var(--muted);
  font-size:12px;
  min-width:16px;
}
.mini-field input{
  width:3.5ch;
  min-width:3.5ch;
  max-width:5.5ch;
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:10px;
  padding:7px 8px;
  text-align:center;
}
.mini-field.readonly div{
  min-width:28px;
  padding:7px 8px;
  border-radius:10px;
  background:#091526;
  border:1px solid var(--line);
  text-align:center;
}
.score-field input{
  width:5.5ch;
}
.mode-badge{
  font-size:11px;
  padding:5px 7px;
  border-radius:999px;
  font-weight:800;
  white-space:nowrap;
}
.mode-badge.auto{
  background:rgba(37,194,160,.12);
  color:#7ee4cf;
}
.mode-badge.manual{
  background:rgba(245,158,11,.14);
  color:#fbbf24;
}

.schedule-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}
.summary-box{
  border:1px solid var(--line);
  background:#0b172b;
  border-radius:14px;
  padding:12px;
  margin-bottom:12px;
}
.summary-title{
  font-weight:800;
  margin-bottom:8px;
}
.summary-table-wrap{
  overflow:auto;
}
.summary-table{
  width:100%;
  border-collapse:collapse;
  min-width:380px;
}
.summary-table th,
.summary-table td{
  padding:8px 10px;
  border-bottom:1px solid rgba(255,255,255,.06);
  text-align:left;
  font-size:13px;
}
.summary-table th{
  color:var(--muted);
}
.ok{color:#86efac;font-weight:800}
.warn{color:#fbbf24;font-weight:800}
.bad{color:#f87171;font-weight:800}
.shortage-hint{
  margin-top:8px;
  color:var(--muted);
  font-size:12px;
}

.round-list{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.round-accordion{
  border:1px solid var(--line);
  background:#0b172b;
  border-radius:16px;
  overflow:hidden;
}
.round-toggle{
  width:100%;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  background:linear-gradient(90deg, rgba(37,194,160,.10), rgba(25,82,216,.08));
  color:var(--text);
  border:none;
  cursor:pointer;
  padding:12px 14px;
  font-weight:900;
}
.court-grid{
  display:grid;
  grid-template-columns:1fr;
  gap:12px;
  padding:12px;
}
.court-card{
  border:1px solid var(--line);
  background:
    radial-gradient(circle at top left, rgba(25,82,216,.16), transparent 30%),
    #091526;
  border-radius:16px;
  padding:12px;
  page-break-inside:avoid;
  break-inside:avoid;
}
.court-card-top{
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:10px;
  flex-wrap:wrap;
}
.court-no{
  background:rgba(37,194,160,.14);
  border:1px solid rgba(37,194,160,.35);
  color:#7ee4cf;
  padding:6px 10px;
  border-radius:999px;
  font-weight:900;
}
.type-badge{
  color:var(--muted);
  font-size:12px;
}
.diff-badge{
  margin-left:auto;
  background:rgba(109,40,217,.18);
  border:1px solid rgba(109,40,217,.35);
  color:#c4b5fd;
  padding:6px 10px;
  border-radius:999px;
  font-weight:900;
}
.team-block{
  border:1px solid var(--line);
  background:rgba(255,255,255,.03);
  border-radius:14px;
  padding:10px;
}
.team-label{
  font-size:12px;
  color:var(--muted);
  font-weight:900;
  margin-bottom:6px;
}
.team-names{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.name-row{
  display:flex;
  align-items:flex-start;
  gap:8px;
}
.dot{
  width:10px;
  height:10px;
  border-radius:999px;
  margin-top:4px;
  flex:0 0 auto;
}
.schedule-name{
  white-space:pre-line;
  line-height:1.15;
  font-weight:900;
  font-size:18px;
}
.vs-center{
  text-align:center;
  font-weight:900;
  letter-spacing:1px;
  margin:10px 0;
  color:var(--muted);
}
.score-big{
  margin-top:10px;
  font-size:20px;
  font-weight:900;
  color:#f8fafc;
}

.empty{
  padding:20px;
  text-align:center;
  color:var(--muted);
}

.print-header,
.print-footer{
  display:none;
}
.name-cell{
  display:inline-flex;
  align-items:center;
  gap:4px;
}

@media (max-width: 960px){
  .settings-grid{
    grid-template-columns:1fr 1fr;
  }
  .field.wide{
    grid-column:span 2;
  }
  .content-grid{
    grid-template-columns:1fr;
  }
  .schedule-header{
    flex-direction:column;
  }
}

@media (min-width: 961px){
  .court-grid{
    grid-template-columns:1fr 1fr;
  }
}

@page{
  size:A4 landscape;
  margin:10mm;
}

@media print{
  body{
    background:white !important;
    color:#0f172a !important;
  }
  .no-print{
    display:none !important;
  }
  .shell{
    max-width:none;
    padding:0;
    margin:0;
  }
  .print-panel{
    border:none !important;
    box-shadow:none !important;
    background:white !important;
    padding:0 !important;
  }
  .print-header{
    display:block;
    margin-bottom:10px;
    border-bottom:2px solid #0f3f6b;
    padding-bottom:8px;
  }
  .print-title{
    font-size:24px;
    font-weight:900;
    color:#0f3f6b;
  }
  .print-sub{
    margin-top:6px;
    color:#475569;
    font-size:12px;
  }
  .summary-box{
    background:white !important;
    color:#0f172a !important;
    border:1px solid #cbd5e1 !important;
    box-shadow:none !important;
  }
  .summary-table th,
  .summary-table td{
    color:#0f172a !important;
    border-bottom:1px solid #e2e8f0 !important;
  }
  .round-accordion{
    border:none !important;
    background:white !important;
    margin-bottom:10px;
    break-inside:auto;
  }
  .round-toggle{
    background:none !important;
    color:#0f3f6b !important;
    border-top:1px solid #cbd5e1;
    border-bottom:1px solid #cbd5e1;
    padding:8px 0 !important;
  }
  .court-grid{
    grid-template-columns:1fr 1fr !important;
    gap:8px !important;
    padding:8px 0 !important;
  }
  .court-card{
    background:white !important;
    color:#0f172a !important;
    border:1px solid #cbd5e1 !important;
    box-shadow:none !important;
  }
  .court-no{
    background:#0f3f6b !important;
    color:white !important;
    border:1px solid #0f3f6b !important;
  }
  .type-badge{
    color:#475569 !important;
  }
  .diff-badge{
    background:#f1f5f9 !important;
    color:#334155 !important;
    border:1px solid #cbd5e1 !important;
  }
  .team-block{
    border:1px solid #dbeafe !important;
    background:#f8fafc !important;
  }
  .team-label{
    color:#475569 !important;
  }
  .schedule-name{
    color:#0f172a !important;
    font-size:15px !important;
  }
  .vs-center{
    color:#334155 !important;
  }
  .score-big{
    color:#0f172a !important;
    font-size:18px !important;
  }
  .print-footer{
    display:block;
    margin-top:10px;
    text-align:right;
    color:#64748b;
    font-size:11px;
  }
}
`;