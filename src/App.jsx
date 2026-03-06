import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";

const STORAGE_KEY = "badminton_scheduler_v14_full";
const DEFAULT_TITLE = "배드민턴 대진표";
const GRADES = ["A", "B", "C", "D", "초심"];

const MALE_POINTS = { A: 5, B: 4, C: 3, D: 2, 초심: 1 };
const FEMALE_POINTS = { A: 3.8, B: 2.5, C: 2.0, D: 1.5, 초심: 0.5 };

const GRADE_COLORS = {
  A: "#ef4444",
  B: "#3b82f6",
  C: "#22c55e",
  D: "#f59e0b",
  초심: "#9ca3af",
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const normalize = (s) => String(s ?? "").trim();

function makeTimestamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function getBaseScore(grade, gender) {
  return gender === "남" ? MALE_POINTS[grade] ?? 3 : FEMALE_POINTS[grade] ?? 2;
}

function isManualScore(player) {
  return (
    player.scoreOverride !== null &&
    player.scoreOverride !== undefined &&
    player.scoreOverride !== ""
  );
}

function getAppliedScore(player) {
  return isManualScore(player)
    ? Number(player.scoreOverride)
    : getBaseScore(player.grade, player.gender);
}

function playerShortName(name) {
  return String(name ?? "").slice(0, 5);
}

function scheduleName(name) {
  const t = String(name ?? "");
  if (t.length >= 4) return `${t.slice(0, 2)}\n${t.slice(2)}`;
  return t;
}

function formatScore(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "";
  return x % 1 === 0 ? String(x.toFixed(0)) : x.toFixed(1);
}

function gradeColor(grade) {
  return GRADE_COLORS[grade] || "#9ca3af";
}

function getType(team) {
  const male = team.filter((p) => p.gender === "남").length;
  if (male === 2) return "남복";
  if (male === 1) return "혼복";
  return "여복";
}

function teamScore(team) {
  return team.reduce((sum, p) => sum + getAppliedScore(p), 0);
}

// 남복 vs 혼복 금지, 남복 vs 여복 금지
function forbiddenMatch(typeA, typeB) {
  const mixedVsMale =
    (typeA === "혼복" && typeB === "남복") ||
    (typeA === "남복" && typeB === "혼복");

  const maleVsFemale =
    (typeA === "남복" && typeB === "여복") ||
    (typeA === "여복" && typeB === "남복");

  return mixedVsMale || maleVsFemale;
}

function weakerMixedRuleOk(team, weaker) {
  if (!weaker) return true;
  const male = team.find((p) => p.gender === "남");
  const female = team.find((p) => p.gender === "여");
  if (male && female) return getAppliedScore(male) >= getAppliedScore(female);
  return true;
}

function pairKey(a, b) {
  return [a, b].sort().join("::");
}

function buildPlayerMap(players) {
  const m = new Map();
  players.forEach((p) => m.set(p.id, p));
  return m;
}

function buildNameCountMap(players) {
  const map = new Map();
  players.forEach((p) => {
    const key = normalize(p.name);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function getAssignedCountMap(schedule) {
  const map = new Map();
  if (!schedule?.rounds) return map;
  schedule.rounds.forEach((r) => {
    r.matches.forEach((m) => {
      [...m.teamAIds, ...m.teamBIds].forEach((id) => {
        map.set(id, (map.get(id) || 0) + 1);
      });
    });
  });
  return map;
}

function evalFourPlayers(four, options, partnerHistory, opponentHistory) {
  const [a, b, c, d] = four;
  const splits = [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];

  let best = null;
  let bestPenalty = Infinity;

  for (const split of splits) {
    const typeA = getType(split.teamA);
    const typeB = getType(split.teamB);

    if (forbiddenMatch(typeA, typeB)) continue;

    const scoreA = teamScore(split.teamA);
    const scoreB = teamScore(split.teamB);
    const diff = Math.abs(scoreA - scoreB);

    // 점수차 절대 강제
    if (diff > options.maxDiff) continue;

    const mixedVsFemale =
      (typeA === "혼복" && typeB === "여복") ||
      (typeA === "여복" && typeB === "혼복");

    if (mixedVsFemale) {
      const mixedScore = typeA === "혼복" ? scoreA : scoreB;
      const femaleScore = typeA === "여복" ? scoreA : scoreB;
      const gap = femaleScore - mixedScore;
      if (gap < options.mixedVsFemaleGapMin || gap > options.mixedVsFemaleGapMax) {
        continue;
      }
    }

    const teamAWeaker = scoreA < scoreB;
    const teamBWeaker = scoreB < scoreA;

    if (!(scoreA === scoreB || weakerMixedRuleOk(split.teamA, teamAWeaker))) continue;
    if (!(scoreA === scoreB || weakerMixedRuleOk(split.teamB, teamBWeaker))) continue;

    const partnerAKey = pairKey(split.teamA[0].id, split.teamA[1].id);
    const partnerBKey = pairKey(split.teamB[0].id, split.teamB[1].id);

    const partnerRepeatA = partnerHistory.get(partnerAKey) || 0;
    const partnerRepeatB = partnerHistory.get(partnerBKey) || 0;

    let partnerPenalty = 0;
    if (partnerRepeatA >= 1) partnerPenalty += 18 + partnerRepeatA * 18;
    if (partnerRepeatB >= 1) partnerPenalty += 18 + partnerRepeatB * 18;

    let opponentPenalty = 0;
    for (const pA of split.teamA) {
      for (const pB of split.teamB) {
        const repeat = opponentHistory.get(pairKey(pA.id, pB.id)) || 0;
        if (repeat >= 1) opponentPenalty += 15 + repeat * 15;
      }
    }

    const penalty = diff * 10 + partnerPenalty + opponentPenalty;

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
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

function buildRound(players, courts, options, partnerHistory, opponentHistory, assignedMap, shortagePriority) {
  let available = players.filter((p) => (assignedMap.get(p.id) || 0) < p.targetGames);
  if (available.length < 4) return [];

  available = [...available].sort((a, b) => {
    const remainA = a.targetGames - (assignedMap.get(a.id) || 0);
    const remainB = b.targetGames - (assignedMap.get(b.id) || 0);

    if (shortagePriority && remainA !== remainB) return remainB - remainA;
    if (
      shortagePriority &&
      (assignedMap.get(a.id) || 0) !== (assignedMap.get(b.id) || 0)
    ) {
      return (assignedMap.get(a.id) || 0) - (assignedMap.get(b.id) || 0);
    }

    const scoreGap = getAppliedScore(b) - getAppliedScore(a);
    if (scoreGap !== 0) return scoreGap;
    return a.name.localeCompare(b.name);
  });

  const matches = [];
  const usedIds = new Set();

  for (let court = 1; court <= courts; court++) {
    const candidates = available.filter((p) => !usedIds.has(p.id));
    if (candidates.length < 4) break;

    const anchors = candidates.slice(0, Math.min(8, candidates.length));
    let bestCandidate = null;

    for (const anchor of anchors) {
      const others = candidates.filter((p) => p.id !== anchor.id).slice(0, 16);

      for (let i = 0; i < others.length; i++) {
        for (let j = i + 1; j < others.length; j++) {
          for (let k = j + 1; k < others.length; k++) {
            const four = [anchor, others[i], others[j], others[k]];
            const result = evalFourPlayers(four, options, partnerHistory, opponentHistory);
            if (!result) continue;

            if (!bestCandidate || result.penalty < bestCandidate.penalty) {
              bestCandidate = { court, ...result };
            }
          }
        }
      }
    }

    if (!bestCandidate) break;

    matches.push(bestCandidate);
    [...bestCandidate.teamA, ...bestCandidate.teamB].forEach((p) =>
      usedIds.add(p.id)
    );
  }

  return matches;
}

function generateSchedule(players, settings) {
  const assignedMap = new Map(players.map((p) => [p.id, 0]));
  const partnerHistory = new Map();
  const opponentHistory = new Map();
  const rounds = [];

  const options = {
    maxDiff: Number(settings.maxDiff) || 1.0,
    mixedVsFemaleGapMin: Number(settings.mixedVsFemaleGapMin) || 1,
    mixedVsFemaleGapMax: Number(settings.mixedVsFemaleGapMax) || 2,
  };

  let guard = 0;
  while (guard < 300) {
    guard += 1;

    if (settings.maxRounds && rounds.length >= settings.maxRounds) break;

    const remaining = players.filter((p) => (assignedMap.get(p.id) || 0) < p.targetGames);
    if (remaining.length < 4) break;

    const matches = buildRound(
      players,
      settings.courts,
      options,
      partnerHistory,
      opponentHistory,
      assignedMap,
      settings.shortagePriority
    );

    if (!matches.length) break;

    matches.forEach((m) => {
      [...m.teamA, ...m.teamB].forEach((p) => {
        assignedMap.set(p.id, (assignedMap.get(p.id) || 0) + 1);
      });

      const partnerA = pairKey(m.teamA[0].id, m.teamA[1].id);
      const partnerB = pairKey(m.teamB[0].id, m.teamB[1].id);

      partnerHistory.set(partnerA, (partnerHistory.get(partnerA) || 0) + 1);
      partnerHistory.set(partnerB, (partnerHistory.get(partnerB) || 0) + 1);

      for (const a of m.teamA) {
        for (const b of m.teamB) {
          const key = pairKey(a.id, b.id);
          opponentHistory.set(key, (opponentHistory.get(key) || 0) + 1);
        }
      }
    });

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
  }

  return {
    title: settings.title || DEFAULT_TITLE,
    createdAt: new Date().toISOString(),
    rounds,
  };
}

function toSummary(players, assignedMap) {
  return players
    .map((p) => {
      const assigned = assignedMap.get(p.id) || 0;
      return {
        ...p,
        assigned,
        diff: assigned - p.targetGames,
      };
    })
    .sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      return a.name.localeCompare(b.name);
    });
}

function downloadPlayersJson(players) {
  const blob = new Blob([JSON.stringify(players, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `players_backup_${makeTimestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportScheduleExcel(schedule, playerMap, title) {
  const rows = [];
  schedule.rounds.forEach((round) => {
    round.matches.forEach((m) => {
      const a = m.teamAIds.map((id) => playerMap.get(id)?.name || "");
      const b = m.teamBIds.map((id) => playerMap.get(id)?.name || "");

      rows.push({
        제목: title,
        라운드: round.title,
        코트: `${m.court}코트`,
        타입: `${m.typeA} vs ${m.typeB}`,
        "TEAM A 1": a[0] || "",
        "TEAM A 2": a[1] || "",
        "TEAM B 1": b[0] || "",
        "TEAM B 2": b[1] || "",
        "TEAM A 합": formatScore(m.scoreA),
        "TEAM B 합": formatScore(m.scoreB),
        "점수차 Δ": formatScore(m.diff),
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "대진표");
  XLSX.writeFile(wb, `${title}_${makeTimestamp()}.xlsx`);
}

async function exportSchedulePpt(schedule, players, settings) {
  if (!schedule?.rounds?.length) return;

  const playerMap = buildPlayerMap(players);
  const pptx = new PptxGenJS();

  pptx.layout =
    settings.pptOrientation === "portrait" ? "LAYOUT_STANDARD" : "LAYOUT_WIDE";
  pptx.author = "ChatGPT";
  pptx.title = settings.title || DEFAULT_TITLE;
  pptx.lang = "ko-KR";

  const pageW = settings.pptOrientation === "portrait" ? 10 : 13.333;
  const pageH = 7.5;
  const margin = 0.35;
  const headerH = 0.65;
  const title = settings.title || DEFAULT_TITLE;

  for (const round of schedule.rounds) {
    const slide = pptx.addSlide();
    slide.background = { color: "F8FBFF" };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: pageW,
      h: headerH,
      fill: { color: "0F3F6B" },
      line: { color: "0F3F6B" },
    });

    slide.addText(`🏸 ${title}`, {
      x: margin,
      y: 0.12,
      w: pageW - margin * 2,
      h: 0.22,
      color: "FFFFFF",
      bold: true,
      fontSize: 20,
      fontFace: "Malgun Gothic",
      margin: 0,
    });

    slide.addText(
      `${new Date(schedule.createdAt).toLocaleDateString("ko-KR")} | ${settings.courts}코트 | ${round.title}`,
      {
        x: margin,
        y: 0.38,
        w: pageW - margin * 2,
        h: 0.18,
        color: "DCE8F5",
        fontSize: 9,
        fontFace: "Malgun Gothic",
        margin: 0,
      }
    );

    slide.addText(round.title, {
      x: margin,
      y: headerH + 0.05,
      w: pageW - margin * 2,
      h: 0.28,
      color: "0F3F6B",
      bold: true,
      fontSize: 15,
      align: "center",
      margin: 0,
    });

    const cols = 2;
    const gapX = 0.18;
    const gapY = 0.16;
    const topY = headerH + 0.42;
    const contentW = pageW - margin * 2;
    const cardW = (contentW - gapX) / cols;
    const rows = Math.ceil(round.matches.length / cols);
    const availableH = pageH - topY - 0.28;
    const cardH = Math.min(1.9, (availableH - gapY * (rows - 1)) / Math.max(rows, 1));

    round.matches.forEach((m, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = margin + col * (cardW + gapX);
      const y = topY + row * (cardH + gapY);

      const teamA = m.teamAIds.map((id) => playerMap.get(id)).filter(Boolean);
      const teamB = m.teamBIds.map((id) => playerMap.get(id)).filter(Boolean);

      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: cardW,
        h: cardH,
        rectRadius: 0.08,
        fill: { color: "FFFFFF" },
        line: { color: "BFD2E8", pt: 1 },
      });

      slide.addText(`${m.court}코트`, {
        x: x + 0.1,
        y: y + 0.08,
        w: 0.72,
        h: 0.18,
        color: "FFFFFF",
        bold: true,
        fontSize: 10,
        align: "center",
        fill: { color: "0F3F6B" },
        margin: 0,
      });

      slide.addText(`${m.typeA} vs ${m.typeB}`, {
        x: x + 0.9,
        y: y + 0.1,
        w: 1.2,
        h: 0.14,
        color: "5B6D85",
        fontSize: 8.5,
        margin: 0,
      });

      slide.addText(`Δ ${formatScore(m.diff)}`, {
        x: x + cardW - 0.85,
        y: y + 0.08,
        w: 0.72,
        h: 0.18,
        color: "6D28D9",
        bold: true,
        fontSize: 11,
        align: "center",
        fill: { color: "F5F3FF" },
        line: { color: "C4B5FD", pt: 1 },
        margin: 0,
      });

      const leftX = x + 0.1;
      const topBlockY = y + 0.38;
      const boxW = (cardW - 0.45) / 2;
      const boxH = cardH - 0.52;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: leftX,
        y: topBlockY,
        w: boxW,
        h: boxH,
        rectRadius: 0.06,
        fill: { color: "F8FBFF" },
        line: { color: "D8E6F4", pt: 1 },
      });

      slide.addText("TEAM A", {
        x: leftX + 0.08,
        y: topBlockY + 0.04,
        w: boxW - 0.16,
        h: 0.12,
        color: "475569",
        bold: true,
        fontSize: 8.5,
        margin: 0,
      });

      teamA.forEach((p, i) => {
        slide.addShape(pptx.ShapeType.ellipse, {
          x: leftX + 0.08,
          y: topBlockY + 0.22 + i * 0.22,
          w: 0.08,
          h: 0.08,
          fill: { color: gradeColor(p.grade).replace("#", "") },
          line: { color: gradeColor(p.grade).replace("#", ""), pt: 1 },
        });

        slide.addText(scheduleName(p.name), {
          x: leftX + 0.19,
          y: topBlockY + 0.19 + i * 0.21,
          w: boxW - 0.25,
          h: 0.18,
          color: "0F172A",
          bold: true,
          fontSize: 10.5,
          margin: 0,
        });
      });

      slide.addText(`TEAM A ${formatScore(m.scoreA)}`, {
        x: leftX + 0.08,
        y: topBlockY + boxH - 0.22,
        w: boxW - 0.16,
        h: 0.16,
        color: "0F172A",
        bold: true,
        fontSize: 11.5,
        align: "center",
        margin: 0,
      });

      slide.addText("VS", {
        x: leftX + boxW + 0.03,
        y: topBlockY + boxH / 2 - 0.1,
        w: 0.18,
        h: 0.16,
        color: "334155",
        bold: true,
        fontSize: 12,
        align: "center",
        margin: 0,
      });

      const rightX = leftX + boxW + 0.25;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: rightX,
        y: topBlockY,
        w: boxW,
        h: boxH,
        rectRadius: 0.06,
        fill: { color: "F8FBFF" },
        line: { color: "D8E6F4", pt: 1 },
      });

      slide.addText("TEAM B", {
        x: rightX + 0.08,
        y: topBlockY + 0.04,
        w: boxW - 0.16,
        h: 0.12,
        color: "475569",
        bold: true,
        fontSize: 8.5,
        margin: 0,
      });

      teamB.forEach((p, i) => {
        slide.addShape(pptx.ShapeType.ellipse, {
          x: rightX + 0.08,
          y: topBlockY + 0.22 + i * 0.22,
          w: 0.08,
          h: 0.08,
          fill: { color: gradeColor(p.grade).replace("#", "") },
          line: { color: gradeColor(p.grade).replace("#", ""), pt: 1 },
        });

        slide.addText(scheduleName(p.name), {
          x: rightX + 0.19,
          y: topBlockY + 0.19 + i * 0.21,
          w: boxW - 0.25,
          h: 0.18,
          color: "0F172A",
          bold: true,
          fontSize: 10.5,
          margin: 0,
        });
      });

      slide.addText(`TEAM B ${formatScore(m.scoreB)}`, {
        x: rightX + 0.08,
        y: topBlockY + boxH - 0.22,
        w: boxW - 0.16,
        h: 0.16,
        color: "0F172A",
        bold: true,
        fontSize: 11.5,
        align: "center",
        margin: 0,
      });
    });
  }

  await pptx.writeFile({
    fileName: `${title}_${makeTimestamp()}.pptx`,
  });
}

export default function App() {
  const loaded = loadState();

  const [title, setTitle] = useState(loaded?.title || DEFAULT_TITLE);
  const [players, setPlayers] = useState(loaded?.players || []);
  const [schedule, setSchedule] = useState(loaded?.schedule || null);

  const [courts, setCourts] = useState(loaded?.courts || 4);
  const [defaultTargetGames, setDefaultTargetGames] = useState(
    loaded?.defaultTargetGames || 3
  );
  const [maxRoundsInput, setMaxRoundsInput] = useState(
    loaded?.maxRoundsInput || ""
  );
  const [shortagePriority, setShortagePriority] = useState(
    loaded?.shortagePriority || false
  );

  const [maxDiff, setMaxDiff] = useState(loaded?.maxDiff || 1.0);
  const [mixedVsFemaleGapMin, setMixedVsFemaleGapMin] = useState(
    loaded?.mixedVsFemaleGapMin || 1
  );
  const [mixedVsFemaleGapMax, setMixedVsFemaleGapMax] = useState(
    loaded?.mixedVsFemaleGapMax || 2
  );

  const [pptOrientation, setPptOrientation] = useState(
    loaded?.pptOrientation || "landscape"
  );

  const [newPlayer, setNewPlayer] = useState({
    name: "",
    gender: "남",
    grade: "C",
    targetGames: 3,
  });

  const [expandedRounds, setExpandedRounds] = useState(
    loaded?.schedule?.rounds?.map((r) => r.id) || []
  );

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
      pptOrientation,
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
    pptOrientation,
  ]);

  useEffect(() => {
    setSchedule(null);
    setExpandedRounds([]);
  }, [
    courts,
    maxRoundsInput,
    shortagePriority,
    maxDiff,
    mixedVsFemaleGapMin,
    mixedVsFemaleGapMax,
    pptOrientation,
    title,
  ]);

  const playerMap = useMemo(() => buildPlayerMap(players), [players]);
  const nameCountMap = useMemo(() => buildNameCountMap(players), [players]);
  const assignedMap = useMemo(() => getAssignedCountMap(schedule), [schedule]);
  const summary = useMemo(() => toSummary(players, assignedMap), [players, assignedMap]);

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

  function resetScoreToAuto(id) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, scoreOverride: null } : p))
    );
  }

  function applyTargetToAll() {
    const value = clamp(Number(defaultTargetGames) || 3, 1, 30);
    setPlayers((prev) => prev.map((p) => ({ ...p, targetGames: value })));
  }

  function buildScheduleNow() {
    const maxRounds =
      maxRoundsInput === ""
        ? null
        : clamp(Number(maxRoundsInput) || 1, 1, 999);

    const result = generateSchedule(players, {
      title,
      courts: clamp(Number(courts) || 4, 1, 10),
      maxRounds,
      shortagePriority,
      maxDiff,
      mixedVsFemaleGapMin,
      mixedVsFemaleGapMax,
    });

    setSchedule(result);
    setExpandedRounds(result.rounds.map((r) => r.id));
  }

  function toggleRound(id) {
    setExpandedRounds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function expandAll() {
    if (!schedule?.rounds) return;
    setExpandedRounds(schedule.rounds.map((r) => r.id));
  }

  function collapseAll() {
    setExpandedRounds([]);
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

          const gender =
            normalize(row["성별"] || row["gender"]) === "여" ? "여" : "남";
          const gradeRaw = normalize(row["급수"] || row["grade"]);
          const grade = GRADES.includes(gradeRaw) ? gradeRaw : "C";
          const targetGames = clamp(
            Number(row["목표경기"] || row["targetGames"] || 3),
            1,
            30
          );
          const applied = row["적용점수"] || row["score"] || "";
          const scoreOverride =
            applied === "" || applied === null || applied === undefined
              ? null
              : Number(applied);

          return {
            id: uid(),
            name,
            gender,
            grade,
            targetGames,
            scoreOverride: Number.isFinite(Number(scoreOverride))
              ? Number(scoreOverride)
              : null,
          };
        })
        .filter(Boolean);

      setPlayers((prev) => [...prev, ...mapped]);
    } catch {
      alert("엑셀 업로드에 실패했어.");
    }
  }

  async function handleJsonImport(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        alert("JSON 형식이 올바르지 않아.");
        return;
      }

      const mode = window.prompt("1=기존 유지+추가 / 2=전체 교체", "1");

      const imported = parsed
        .map((p) => ({
          id: uid(),
          name: normalize(p.name),
          gender: p.gender === "여" ? "여" : "남",
          grade: GRADES.includes(p.grade) ? p.grade : "C",
          targetGames: clamp(Number(p.targetGames) || 3, 1, 30),
          scoreOverride:
            p.scoreOverride === null ||
            p.scoreOverride === undefined ||
            p.scoreOverride === ""
              ? null
              : Number(p.scoreOverride),
        }))
        .filter((p) => p.name);

      if (mode === "2") {
        setPlayers(imported);
      } else {
        setPlayers((prev) => [...prev, ...imported]);
      }
    } catch {
      alert("JSON 불러오기에 실패했어.");
    }
  }

  function clearAll() {
    if (!window.confirm("선수/설정/대진표를 모두 삭제할까?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setPlayers([]);
    setSchedule(null);
    setTitle(DEFAULT_TITLE);
    setCourts(4);
    setDefaultTargetGames(3);
    setMaxRoundsInput("");
    setShortagePriority(false);
    setExpandedRounds([]);
    setPptOrientation("landscape");
    setMaxDiff(1.0);
  }

  async function exportPpt() {
    await exportSchedulePpt(schedule, players, {
      title,
      courts,
      pptOrientation,
    });
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
        const a = m.teamAIds.map((id) => playerMap.get(id)?.name || "").join(", ");
        const b = m.teamBIds.map((id) => playerMap.get(id)?.name || "").join(", ");
        lines.push(
          `${m.court}코트 | ${a} VS ${b} | ${formatScore(m.scoreA)}:${formatScore(m.scoreB)} | Δ${formatScore(m.diff)}`
        );
      });
      lines.push("");
    });

    navigator.clipboard.writeText(lines.join("\n"));
    alert("대진표 텍스트를 복사했어.");
  }

  return (
    <div className="app">
      <style>{css}</style>

      <div className="shell">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">🏸</div>
            <div>
              <div className="brand-title">배드민턴 밸런스 매치 v14</div>
              <div className="brand-sub">배경 겹침 해결 통합 버전</div>
            </div>
          </div>
        </header>

        <section className="panel">
          <div className="panel-title">설정</div>

          <div className="settings-grid">
            <label className="field field-wide">
              <span>대진표 제목</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={DEFAULT_TITLE}
              />
            </label>

            <label className="field">
              <span>코트 수</span>
              <input
                type="number"
                min={1}
                max={10}
                value={courts}
                onChange={(e) =>
                  setCourts(clamp(Number(e.target.value) || 4, 1, 10))
                }
              />
            </label>

            <label className="field">
              <span>기본 목표경기</span>
              <input
                type="number"
                min={1}
                max={30}
                value={defaultTargetGames}
                onChange={(e) =>
                  setDefaultTargetGames(clamp(Number(e.target.value) || 3, 1, 30))
                }
              />
            </label>

            <div className="field">
              <span>전원 적용</span>
              <button onClick={applyTargetToAll}>전원 적용</button>
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

            <label className="field">
              <span>PPT 방향</span>
              <select
                value={pptOrientation}
                onChange={(e) => setPptOrientation(e.target.value)}
              >
                <option value="landscape">가로</option>
                <option value="portrait">세로</option>
              </select>
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
            <button className="primary" onClick={buildScheduleNow}>
              대진표 생성
            </button>
            <button onClick={() => fileInputRef.current?.click()}>
              엑셀 업로드
            </button>
            <button onClick={() => downloadPlayersJson(players)}>
              명단 백업(JSON)
            </button>
            <button onClick={() => jsonInputRef.current?.click()}>
              명단 복원(JSON)
            </button>
            <button className="danger" onClick={clearAll}>
              전체삭제
            </button>

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

        <div className="content">
          <section className="panel">
            <div className="panel-title">선수 등록 / 관리</div>

            <div className="add-row">
              <input
                className="name-input"
                value={newPlayer.name}
                onChange={(e) =>
                  setNewPlayer((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="이름"
              />
              <select
                value={newPlayer.gender}
                onChange={(e) =>
                  setNewPlayer((prev) => ({ ...prev, gender: e.target.value }))
                }
              >
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
              <select
                value={newPlayer.grade}
                onChange={(e) =>
                  setNewPlayer((prev) => ({ ...prev, grade: e.target.value }))
                }
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={30}
                value={newPlayer.targetGames}
                onChange={(e) =>
                  setNewPlayer((prev) => ({
                    ...prev,
                    targetGames: clamp(Number(e.target.value) || 3, 1, 30),
                  }))
                }
              />
              <button className="primary" onClick={addPlayer}>
                추가
              </button>
            </div>

            <div className="player-list">
              {players.length === 0 && <div className="empty">선수가 아직 없어.</div>}

              {players.map((p) => {
                const dup = (nameCountMap.get(normalize(p.name)) || 0) > 1;
                const assigned = assignedMap.get(p.id) || 0;

                return (
                  <div className="player-card" key={p.id}>
                    <div className="player-top">
                      <div className="player-name-wrap">
                        <input
                          className="player-name"
                          value={p.name}
                          onChange={(e) =>
                            updatePlayer(p.id, { name: e.target.value })
                          }
                          title={p.name}
                        />
                        {dup && <span className="dup">⚠</span>}
                      </div>

                      <span
                        className="grade-pill"
                        style={{
                          color: gradeColor(p.grade),
                          borderColor: `${gradeColor(p.grade)}66`,
                          backgroundColor: `${gradeColor(p.grade)}18`,
                        }}
                      >
                        {p.gender} {p.grade}
                      </span>

                      <button
                        className="icon danger"
                        onClick={() => removePlayer(p.id)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="player-bottom">
                      <div className="mini">
                        <span>목</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={p.targetGames}
                          onChange={(e) =>
                            updatePlayer(p.id, {
                              targetGames: clamp(
                                Number(e.target.value) || 3,
                                1,
                                30
                              ),
                            })
                          }
                        />
                      </div>

                      <div className="mini score-mini">
                        <span>점</span>
                        <input
                          type="number"
                          step="0.1"
                          value={isManualScore(p) ? p.scoreOverride : getAppliedScore(p)}
                          onChange={(e) =>
                            updatePlayer(p.id, {
                              scoreOverride:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                        <span
                          className={`mode ${isManualScore(p) ? "manual" : "auto"}`}
                        >
                          {isManualScore(p) ? "수동" : "자동"}
                        </span>
                        {isManualScore(p) && (
                          <button
                            className="icon tiny"
                            onClick={() => resetScoreToAuto(p.id)}
                          >
                            ↺
                          </button>
                        )}
                      </div>

                      <div className="mini readonly">
                        <span>출</span>
                        <div>{assigned}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="schedule-head">
              <div>
                <div className="panel-title">대진표</div>
                <div className="muted">
                  {title || DEFAULT_TITLE} · {courts}코트 ·{" "}
                  {schedule?.rounds?.length || 0}라운드
                </div>
              </div>

              <div className="toolbar compact">
                <button onClick={expandAll}>모두 펼치기</button>
                <button onClick={collapseAll}>모두 접기</button>
                <button onClick={copyScheduleText}>텍스트 복사</button>
                <button
                  onClick={() =>
                    schedule &&
                    exportScheduleExcel(schedule, playerMap, title || DEFAULT_TITLE)
                  }
                >
                  엑셀 저장
                </button>
                <button className="primary" onClick={exportPpt}>
                  PPT 저장
                </button>
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-title">출전 현황 요약</div>
              <div className="summary-wrap">
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
                            <span style={{ color: gradeColor(row.grade) }}>●</span>
                            {playerShortName(row.name)}
                            {(nameCountMap.get(normalize(row.name)) || 0) > 1 && (
                              <span className="dup-inline">⚠</span>
                            )}
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
            </div>

            {!schedule?.rounds?.length ? (
              <div className="empty">대진표를 생성해줘.</div>
            ) : (
              <div className="round-list">
                {schedule.rounds.map((round) => {
                  const opened = expandedRounds.includes(round.id);
                  return (
                    <div className="round-box" key={round.id}>
                      <button
                        className="round-toggle"
                        onClick={() => toggleRound(round.id)}
                      >
                        <span>
                          {opened ? "▼" : "▶"} {round.title}
                        </span>
                        <span>{round.matches.length} matches</span>
                      </button>

                      {opened && (
                        <div className="court-grid">
                          {round.matches.map((m) => {
                            const teamA = m.teamAIds
                              .map((id) => playerMap.get(id))
                              .filter(Boolean);
                            const teamB = m.teamBIds
                              .map((id) => playerMap.get(id))
                              .filter(Boolean);

                            return (
                              <div className="court-card" key={m.id}>
                                <div className="court-top">
                                  <div className="court-no">{m.court}코트</div>
                                  <div className="court-type">
                                    {m.typeA} vs {m.typeB}
                                  </div>
                                </div>

                                <div className="diff-big">
                                  점수차 Δ {formatScore(m.diff)}
                                </div>

                                <div className="team-card">
                                  <div className="team-label">TEAM A</div>
                                  <div className="team-list">
                                    {teamA.map((p) => (
                                      <div className="team-row" key={p.id}>
                                        <span
                                          className="dot"
                                          style={{
                                            backgroundColor: gradeColor(p.grade),
                                          }}
                                        />
                                        <span className="team-name">
                                          {scheduleName(p.name)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="sum-big">
                                    TEAM A {formatScore(m.scoreA)}
                                  </div>
                                </div>

                                <div className="vs">VS</div>

                                <div className="team-card">
                                  <div className="team-label">TEAM B</div>
                                  <div className="team-list">
                                    {teamB.map((p) => (
                                      <div className="team-row" key={p.id}>
                                        <span
                                          className="dot"
                                          style={{
                                            backgroundColor: gradeColor(p.grade),
                                          }}
                                        />
                                        <span className="team-name">
                                          {scheduleName(p.name)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="sum-big">
                                    TEAM B {formatScore(m.scoreB)}
                                  </div>
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
  --line:rgba(255,255,255,.10);
  --text:#eaf1ff;
  --muted:#9fb2d5;
  --danger:#ef4444;
}

*{box-sizing:border-box}

html, body, #root{
  width:100%;
  max-width:100%;
  overflow-x:hidden;
}

body{
  margin:0;
  background:
    radial-gradient(circle at top left, rgba(37,194,160,.10), transparent 26%),
    radial-gradient(circle at top right, rgba(25,82,216,.12), transparent 22%),
    var(--bg);
  color:var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  overflow-x:hidden;
}

button,input,select{font:inherit}

.app{
  min-height:100vh;
  width:100%;
  max-width:100%;
  overflow-x:hidden;
}

.shell{
  width:100%;
  max-width:1380px;
  margin:0 auto;
  padding:16px;
  overflow-x:hidden;
}

.header{
  border:1px solid var(--line);
  background:linear-gradient(135deg, rgba(37,194,160,.10), rgba(25,82,216,.10));
  border-radius:18px;
  padding:16px;
  margin-bottom:14px;
}

.brand{
  display:flex;
  align-items:center;
  gap:12px;
}

.brand-icon{
  width:44px;
  height:44px;
  border-radius:14px;
  display:grid;
  place-items:center;
  background:rgba(37,194,160,.14);
  border:1px solid rgba(37,194,160,.25);
}

.brand-title{font-size:28px;font-weight:900}
.brand-sub{font-size:13px;color:var(--muted);margin-top:4px}

.panel{
  background:rgba(15,27,49,.94);
  border:1px solid var(--line);
  border-radius:18px;
  padding:14px;
  box-shadow:0 16px 40px rgba(0,0,0,.18);
}

.panel-title{
  font-size:18px;
  font-weight:900;
  margin-bottom:10px;
}

.muted{
  color:var(--muted);
  font-size:13px;
}

.settings-grid{
  display:grid;
  grid-template-columns:repeat(4, minmax(0,1fr));
  gap:10px;
  width:100%;
  min-width:0;
}

.field{
  display:flex;
  flex-direction:column;
  gap:6px;
}

.field span{
  font-size:12px;
  color:var(--muted);
}

.field input,.field select{
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
  width:100%;
  min-width:0;
}

.field button{
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
  cursor:pointer;
  width:100%;
}

.field-wide{grid-column:span 2}

.toggle{
  margin-top:20px;
  display:flex;
  align-items:center;
  gap:10px;
  border:1px solid var(--line);
  border-radius:12px;
  background:#091526;
  padding:10px 12px;
  min-height:44px;
  min-width:0;
}

.toolbar{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:12px;
  width:100%;
}

.toolbar.compact{
  margin-top:0;
}

.toolbar button{
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
  cursor:pointer;
  min-width:0;
}

.toolbar button.primary{
  background:linear-gradient(135deg, rgba(37,194,160,.18), rgba(25,82,216,.18));
  border-color:rgba(37,194,160,.28);
}

.toolbar button.danger{
  background:rgba(239,68,68,.10);
  border-color:rgba(239,68,68,.32);
}

.content{
  display:grid;
  grid-template-columns:minmax(320px, 420px) minmax(0, 1fr);
  gap:14px;
  margin-top:14px;
  width:100%;
  min-width:0;
}

.add-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) 70px 82px 82px 80px;
  gap:8px;
  margin-bottom:12px;
  width:100%;
  min-width:0;
}

.add-row input,.add-row select,.add-row button{
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
  min-width:0;
}

.add-row button.primary{
  background:linear-gradient(135deg, rgba(37,194,160,.18), rgba(25,82,216,.18));
  border-color:rgba(37,194,160,.28);
}

.name-input{min-width:0}

.player-list{
  display:flex;
  flex-direction:column;
  gap:10px;
  min-width:0;
}

.player-card{
  border:1px solid var(--line);
  background:#0b172b;
  border-radius:14px;
  padding:10px;
  min-width:0;
}

.player-top,.player-bottom{
  display:flex;
  align-items:center;
  gap:8px;
}

.player-bottom{
  margin-top:8px;
  flex-wrap:wrap;
}

.player-name-wrap{
  display:flex;
  align-items:center;
  gap:6px;
  flex:1;
  min-width:0;
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

.dup{color:#fbbf24;font-weight:900}
.dup-inline{color:#fbbf24}

.grade-pill{
  border:1px solid;
  border-radius:999px;
  padding:7px 10px;
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
  background:rgba(239,68,68,.10);
  border-color:rgba(239,68,68,.32);
}

.icon.tiny{
  padding:5px 8px;
  font-size:12px;
}

.mini{
  display:flex;
  align-items:center;
  gap:6px;
  min-width:0;
}

.mini > span{
  font-size:12px;
  color:var(--muted);
  min-width:16px;
}

.mini input{
  width:4.2ch;
  border:1px solid var(--line);
  background:#091526;
  color:var(--text);
  border-radius:10px;
  padding:7px 8px;
  text-align:center;
}

.score-mini input{width:5.5ch}

.mode{
  font-size:11px;
  padding:5px 7px;
  border-radius:999px;
  font-weight:800;
}

.mode.auto{
  background:rgba(37,194,160,.12);
  color:#7ee4cf;
}

.mode.manual{
  background:rgba(245,158,11,.16);
  color:#fbbf24;
}

.readonly div{
  min-width:28px;
  border:1px solid var(--line);
  background:#091526;
  border-radius:10px;
  padding:7px 8px;
  text-align:center;
}

.schedule-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  margin-bottom:12px;
}

.summary-box{
  border:1px solid var(--line);
  background:#0b172b;
  border-radius:14px;
  padding:12px;
  margin-bottom:12px;
  min-width:0;
}

.summary-title{font-weight:900;margin-bottom:8px}

.summary-wrap{
  overflow-x:auto;
  max-width:100%;
}

.summary-table{
  width:100%;
  min-width:380px;
  border-collapse:collapse;
}

.summary-table th,.summary-table td{
  padding:8px 10px;
  border-bottom:1px solid rgba(255,255,255,.06);
  text-align:left;
  font-size:13px;
}

.summary-table th{color:var(--muted)}

.name-cell{
  display:inline-flex;
  align-items:center;
  gap:4px;
}

.ok{color:#86efac;font-weight:800}
.warn{color:#fbbf24;font-weight:800}
.bad{color:#f87171;font-weight:800}

.round-list{
  display:flex;
  flex-direction:column;
  gap:12px;
  min-width:0;
}

.round-box{
  border:1px solid var(--line);
  background:#0b172b;
  border-radius:16px;
  overflow:hidden;
  min-width:0;
}

.round-toggle{
  width:100%;
  border:none;
  background:linear-gradient(90deg, rgba(37,194,160,.10), rgba(25,82,216,.08));
  color:var(--text);
  padding:12px 14px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  font-weight:900;
  cursor:pointer;
}

.court-grid{
  display:grid;
  grid-template-columns:1fr;
  gap:12px;
  padding:12px;
  min-width:0;
}

.court-card{
  border:1px solid var(--line);
  background:
    radial-gradient(circle at top left, rgba(25,82,216,.15), transparent 30%),
    #091526;
  border-radius:16px;
  padding:12px;
  min-width:0;
}

.court-top{
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:10px;
  flex-wrap:wrap;
}

.court-no{
  background:rgba(37,194,160,.15);
  border:1px solid rgba(37,194,160,.32);
  color:#7ee4cf;
  border-radius:999px;
  padding:6px 10px;
  font-weight:900;
}

.court-type{
  font-size:12px;
  color:var(--muted);
}

.diff-big{
  margin-bottom:12px;
  padding:10px 12px;
  border-radius:14px;
  background:linear-gradient(135deg, rgba(109,40,217,.22), rgba(124,58,237,.10));
  border:1px solid rgba(196,181,253,.35);
  color:#ddd6fe;
  font-weight:900;
  font-size:20px;
  text-align:center;
}

.team-card{
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

.team-list{
  display:flex;
  flex-direction:column;
  gap:6px;
}

.team-row{
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

.team-name{
  white-space:pre-line;
  line-height:1.15;
  font-weight:900;
  font-size:18px;
}

.vs{
  text-align:center;
  color:var(--muted);
  font-weight:900;
  margin:10px 0;
  letter-spacing:1px;
}

.sum-big{
  margin-top:10px;
  font-size:20px;
  font-weight:900;
}

.empty{
  color:var(--muted);
  text-align:center;
  padding:20px;
}

.panel,
.settings-grid,
.add-row,
.player-list,
.summary-box,
.round-list,
.round-box,
.court-grid,
.court-card{
  min-width:0;
}

input, select, button{
  max-width:100%;
}

@media (max-width: 960px){
  .shell{
    padding:10px;
  }

  .brand-title{
    font-size:18px;
    line-height:1.2;
    word-break:keep-all;
  }

  .brand-sub{
    font-size:12px;
  }

  .settings-grid{
    grid-template-columns:1fr;
    gap:10px;
  }

  .field-wide{
    grid-column:span 1;
  }

  .content{
    grid-template-columns:1fr;
    gap:12px;
  }

  .schedule-head{
    flex-direction:column;
  }

  .toolbar{
    width:100%;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
  }

  .toolbar.compact{
    width:100%;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
  }

  .toolbar button,
  .toolbar.compact button{
    width:100%;
    min-width:0;
    padding:10px 8px;
    font-size:14px;
  }

  .add-row{
    grid-template-columns:1fr 1fr;
  }

  .add-row .name-input{
    grid-column:1 / -1;
  }

  .add-row button{
    grid-column:1 / -1;
  }

  .panel{
    padding:12px;
  }

  .player-name{
    width:5.5ch;
    min-width:5.5ch;
    max-width:5.5ch;
  }

  .court-grid{
    grid-template-columns:1fr;
  }

  .court-card{
    padding:10px;
  }

  .team-name{
    font-size:16px;
  }

  .sum-big{
    font-size:18px;
  }

  .diff-big{
    font-size:18px;
    padding:8px 10px;
  }
}

@media (min-width: 961px){
  .court-grid{
    grid-template-columns:1fr 1fr;
  }
}
`;