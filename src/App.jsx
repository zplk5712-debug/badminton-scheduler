import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";

/**
 * Badminton Scheduler - All-in-one App.jsx
 * Features: (1) Share, (5) Balanced play counts, (6) Fixed/Banned partners,
 * (8) Regeneration options, (9) Save/Load snapshots, (10) Court screen mode,
 * + Desktop responsive layout.
 *
 * Notes:
 * - This includes a heuristic/DFS matcher with your constraints:
 *   - forbid XD vs MD, forbid MD vs WD
 *   - allow XD vs WD only if (WD score - XD score) in [gapMin, gapMax]
 *   - max score difference <= MAX_DIFF
 *   - mixed-balance rule on weaker mixed team: maleScore >= femaleScore
 * - When constraints are too tight, it may fail to build a round; it will stop with a message.
 */

const STORAGE_KEY = "bm_scheduler_v10_state";
const SNAP_KEY = "bm_scheduler_v10_snapshots";

const GRADES = ["A", "B", "C", "D", "초심"];
const MALE_POINTS = { A: 5, B: 4, C: 3, D: 2, 초심: 1 };
const FEMALE_POINTS = { A: 3.8, B: 2.5, C: 2.0, D: 1.5, 초심: 0.5 };

const DEFAULT_COURTS = 4;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const safeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** ---------- domain helpers ---------- */
function baseScore(grade, genderMF) {
  const g = grade || "C";
  if (genderMF === "M") return MALE_POINTS[g] ?? 3;
  return FEMALE_POINTS[g] ?? 2;
}

function appliedScore(p) {
  const cs = p.customScore;
  if (typeof cs === "number" && Number.isFinite(cs)) return cs;
  return baseScore(p.grade, p.gender);
}

function teamType(team) {
  const male = team.filter((p) => p.gender === "M").length;
  if (male === 2) return "MD"; // 남복
  if (male === 1) return "XD"; // 혼복
  return "WD"; // 여복
}

function sumTeam(team) {
  return team.reduce((s, p) => s + appliedScore(p), 0);
}

function isForbiddenMatchup(typeA, typeB) {
  const mixedVsMale = (typeA === "XD" && typeB === "MD") || (typeA === "MD" && typeB === "XD");
  const maleVsFemale = (typeA === "MD" && typeB === "WD") || (typeA === "WD" && typeB === "MD");
  return mixedVsMale || maleVsFemale;
}

function mixedBalanceOK(team, isWeakerTeam) {
  if (!isWeakerTeam) return true;
  const male = team.find((p) => p.gender === "M");
  const female = team.find((p) => p.gender === "F");
  if (male && female) return appliedScore(male) >= appliedScore(female);
  return true;
}

function buildAllSplits(a, b, c, d) {
  return [
    { teamA: [a, d], teamB: [b, c] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, b], teamB: [c, d] },
  ];
}

function normalizeName(s) {
  return String(s ?? "").trim();
}

/** Partner constraints */
function getNameToId(players) {
  const map = new Map();
  players.forEach((p) => map.set(normalizeName(p.name), p.id));
  return map;
}

function parseBannedNames(text) {
  return String(text ?? "")
    .split(",")
    .map((x) => normalizeName(x))
    .filter(Boolean);
}

function violatesPartnerRules(team, fixedPartnerIdByPlayer, bannedPartnerIdsByPlayer) {
  if (!team || team.length !== 2) return true;
  const [p1, p2] = team;

  // fixed partner: if p1 fixed partner exists, must be p2
  const fp1 = fixedPartnerIdByPlayer.get(p1.id);
  const fp2 = fixedPartnerIdByPlayer.get(p2.id);
  if (fp1 && fp1 !== p2.id) return true;
  if (fp2 && fp2 !== p1.id) return true;

  // banned partner: if p2 is in p1 banned or vice versa
  const b1 = bannedPartnerIdsByPlayer.get(p1.id) || new Set();
  const b2 = bannedPartnerIdsByPlayer.get(p2.id) || new Set();
  if (b1.has(p2.id) || b2.has(p1.id)) return true;

  return false;
}

/** ---------- scheduling core ---------- */
function pickBestMatchFromFour(four, opts, fixedPartnerIdByPlayer, bannedPartnerIdsByPlayer) {
  const [a, b, c, d] = four;
  let best = null;
  let bestPenalty = Infinity;

  for (const sp of buildAllSplits(a, b, c, d)) {
    const typeA = teamType(sp.teamA);
    const typeB = teamType(sp.teamB);

    if (isForbiddenMatchup(typeA, typeB)) continue;

    // partner constraints
    if (violatesPartnerRules(sp.teamA, fixedPartnerIdByPlayer, bannedPartnerIdsByPlayer)) continue;
    if (violatesPartnerRules(sp.teamB, fixedPartnerIdByPlayer, bannedPartnerIdsByPlayer)) continue;

    const scoreA = sumTeam(sp.teamA);
    const scoreB = sumTeam(sp.teamB);
    const diff = Math.abs(scoreA - scoreB);
    if (diff > opts.maxDiff) continue;

    // XD vs WD gap constraint (WD - XD in [gapMin, gapMax])
    const mixedVsFemale = (typeA === "XD" && typeB === "WD") || (typeA === "WD" && typeB === "XD");
    if (mixedVsFemale) {
      const mixedScore = typeA === "XD" ? scoreA : scoreB;
      const femaleScore = typeA === "WD" ? scoreA : scoreB;
      const gap = femaleScore - mixedScore;
      if (gap < opts.mixedVsFemaleGapMin || gap > opts.mixedVsFemaleGapMax) continue;
    }

    // weaker-team mixed balance rule
    const isTeamAWeaker = scoreA < scoreB;
    const isTeamBWeaker = scoreB < scoreA;
    const validA = scoreA === scoreB ? true : mixedBalanceOK(sp.teamA, isTeamAWeaker);
    const validB = scoreA === scoreB ? true : mixedBalanceOK(sp.teamB, isTeamBWeaker);

    let penalty = 0;
    if (!validA || !validB) penalty += 2000;
    penalty += diff * 10;

    // option: female doubles priority (prefer WD matches)
    if (opts.femaleDoublesPriority) {
      const wdCount = (typeA === "WD" ? 1 : 0) + (typeB === "WD" ? 1 : 0);
      penalty -= wdCount * 4; // reward WD a bit
    }

    // option: prefer mixed ratio (global target is handled at round-level, but we can slightly reward XD presence)
    if (opts.preferMixed) {
      const xdCount = (typeA === "XD" ? 1 : 0) + (typeB === "XD" ? 1 : 0);
      penalty -= xdCount * 2;
    }

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { ...sp, scoreA, scoreB, diff, typeA, typeB, penalty };
    }
  }

  return best;
}

function buildRoundByDFS(pool, opts, fixedPartnerIdByPlayer, bannedPartnerIdsByPlayer) {
  const totalCourts = opts.courts;
  if (pool.length < totalCourts * 4) return null;

  const used = new Set();
  const matches = [];

  // Balanced play count: players with fewer gamesPlayed first
  const ordered = [...pool].sort((x, y) => {
    if (x.gamesPlayed !== y.gamesPlayed) return x.gamesPlayed - y.gamesPlayed;
    // slight randomness to explore
    return 0.5 - Math.random();
  });

  const pickFirstUnusedIndex = () => {
    for (let i = 0; i < ordered.length; i++) if (!used.has(ordered[i].id)) return i;
    return -1;
  };

  const dfs = (courtIndex) => {
    if (courtIndex === totalCourts) return true;

    const firstIdx = pickFirstUnusedIndex();
    if (firstIdx === -1) return false;

    const p1 = ordered[firstIdx];
    used.add(p1.id);

    for (let i = 0; i < ordered.length; i++) {
      const p2 = ordered[i];
      if (used.has(p2.id)) continue;
      used.add(p2.id);

      for (let j = i + 1; j < ordered.length; j++) {
        const p3 = ordered[j];
        if (used.has(p3.id)) continue;
        used.add(p3.id);

        for (let k = j + 1; k < ordered.length; k++) {
          const p4 = ordered[k];
          if (used.has(p4.id)) continue;

          const best = pickBestMatchFromFour([p1, p2, p3, p4], opts, fixedPartnerIdByPlayer, bannedPartnerIdsByPlayer);
          if (best && best.penalty < 1000) {
            used.add(p4.id);

            const matchType = `${teamType(best.teamA)}vs${teamType(best.teamB)}`;
            matches.push({
              courtId: courtIndex + 1,
              teamA: best.teamA,
              teamB: best.teamB,
              scoreA: best.scoreA,
              scoreB: best.scoreB,
              diff: best.diff,
              matchType,
            });

            if (dfs(courtIndex + 1)) return true;

            matches.pop();
            used.delete(p4.id);
          }
        }

        used.delete(p3.id);
      }

      used.delete(p2.id);
    }

    used.delete(p1.id);
    return false;
  };

  return dfs(0) ? matches : null;
}

function calcTargetRounds(players, courts) {
  const totalPlayerGames = players.reduce((sum, p) => sum + Number(p.maxGames || 0), 0);
  const totalMatches = Math.floor(totalPlayerGames / 4);
  return Math.floor(totalMatches / courts);
}

function scheduleToRounds(schedule) {
  // schedule: [{id, matches:[{courtId, teamA, teamB,...}]}]
  return (schedule || []).map((r) => ({
    round: r.id,
    courts: (r.matches || []).map((m) => ({
      court: m.courtId,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      diff: m.diff,
      typeA: teamType(m.teamA),
      typeB: teamType(m.teamB),
    })),
  }));
}

/** ---------- UI helpers ---------- */
function formatTypeLabel(t) {
  if (t === "MD") return "남복";
  if (t === "WD") return "여복";
  if (t === "XD") return "혼복";
  return t || "-";
}

function badgeColorByType(t) {
  if (t === "XD") return { bg: "rgba(41,209,166,0.12)", bd: "rgba(41,209,166,0.30)", tx: "rgba(41,209,166,0.98)" };
  if (t === "WD") return { bg: "rgba(255,92,122,0.10)", bd: "rgba(255,92,122,0.28)", tx: "rgba(255,92,122,0.95)" };
  return { bg: "rgba(124,92,255,0.12)", bd: "rgba(124,92,255,0.30)", tx: "rgba(124,92,255,0.98)" };
}

/** ---------- App ---------- */
export default function App() {
  const [tab, setTab] = useState("players"); // players | schedule | court
  const [isDesktop, setIsDesktop] = useState(false);

  // core settings (8)
  const [courts, setCourts] = useState(DEFAULT_COURTS);
  const [maxDiff, setMaxDiff] = useState(1.0);
  const [mixedRatio, setMixedRatio] = useState(60); // 0~100, try to have XD matches
  const [femaleDoublesPriority, setFemaleDoublesPriority] = useState(true);
  const [mixedVsFemaleGapMin, setMixedVsFemaleGapMin] = useState(1);
  const [mixedVsFemaleGapMax, setMixedVsFemaleGapMax] = useState(2);

  // players
  const [players, setPlayers] = useState(() => {
    const st = loadJSON(STORAGE_KEY, null);
    if (st?.players && Array.isArray(st.players)) return st.players;
    return [];
  });

  // schedule
  const [schedule, setSchedule] = useState(() => {
    const st = loadJSON(STORAGE_KEY, null);
    if (st?.schedule && Array.isArray(st.schedule)) return st.schedule;
    return [];
  });

  // snapshots (9)
  const [snapshots, setSnapshots] = useState(() => loadJSON(SNAP_KEY, []));
  const [snapshotPick, setSnapshotPick] = useState("");

  // court mode (10)
  const [courtRound, setCourtRound] = useState(1);

  // share (1)
  const scheduleRef = useRef(null);

  // player form
  const [inputs, setInputs] = useState({
    name: "",
    gender: "M",
    grade: "C",
    maxGames: 3,
    customScore: "",
  });

  // desktop detect
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // load persisted settings
  useEffect(() => {
    const st = loadJSON(STORAGE_KEY, null);
    if (!st) return;
    if (typeof st.courts === "number") setCourts(st.courts);
    if (typeof st.maxDiff === "number") setMaxDiff(st.maxDiff);
    if (typeof st.mixedRatio === "number") setMixedRatio(st.mixedRatio);
    if (typeof st.femaleDoublesPriority === "boolean") setFemaleDoublesPriority(st.femaleDoublesPriority);
    if (typeof st.mixedVsFemaleGapMin === "number") setMixedVsFemaleGapMin(st.mixedVsFemaleGapMin);
    if (typeof st.mixedVsFemaleGapMax === "number") setMixedVsFemaleGapMax(st.mixedVsFemaleGapMax);
    if (typeof st.courtRound === "number") setCourtRound(st.courtRound);
  }, []);

  // persist state (9)
  useEffect(() => {
    saveJSON(STORAGE_KEY, {
      players,
      schedule,
      courts,
      maxDiff,
      mixedRatio,
      femaleDoublesPriority,
      mixedVsFemaleGapMin,
      mixedVsFemaleGapMax,
      courtRound,
    });
  }, [players, schedule, courts, maxDiff, mixedRatio, femaleDoublesPriority, mixedVsFemaleGapMin, mixedVsFemaleGapMax, courtRound]);

  useEffect(() => {
    saveJSON(SNAP_KEY, snapshots);
  }, [snapshots]);

  const stats = useMemo(() => {
    const m = players.filter((p) => p.gender === "M").length;
    const f = players.filter((p) => p.gender === "F").length;
    return { total: players.length, m, f };
  }, [players]);

  const targetRounds = useMemo(() => calcTargetRounds(players, courts), [players, courts]);

  const playersSorted = useMemo(() => {
    return [...players].sort((a, b) => (a.grade === b.grade ? a.name.localeCompare(b.name) : GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade)));
  }, [players]);

  /** ---------- Players CRUD + constraints fields ---------- */
  function addPlayer() {
    const name = normalizeName(inputs.name);
    if (!name) return alert("이름을 입력하세요.");

    const parsedCustom =
      inputs.customScore === "" || inputs.customScore === null
        ? null
        : Number.isFinite(Number(inputs.customScore))
        ? Number(inputs.customScore)
        : null;

    const parsedMaxGames = Number.isFinite(Number(inputs.maxGames)) ? clamp(Number(inputs.maxGames), 1, 20) : 3;

    const newP = {
      id: safeId(),
      name,
      gender: inputs.gender,
      grade: inputs.grade,
      maxGames: parsedMaxGames,
      customScore: parsedCustom,
      // (6) partner constraints
      fixedPartnerName: "", // store by name (simple for users)
      bannedPartnersText: "", // comma-separated names
    };

    setPlayers((prev) => [...prev, newP]);
    setInputs({ ...inputs, name: "", customScore: "" });
  }

  function updatePlayer(id, patch) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePlayer(id) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function resetAllData() {
    const ok = window.confirm("저장된 선수/대진표/설정/스냅샷까지 모두 초기화할까요?");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SNAP_KEY);
    setPlayers([]);
    setSchedule([]);
    setSnapshots([]);
    setSnapshotPick("");
    setTab("players");
    setCourtRound(1);
  }

  /** ---------- Build partner maps (6) ---------- */
  const partnerMaps = useMemo(() => {
    const nameToId = getNameToId(players);

    // fixedPartnerIdByPlayer: Map(playerId => partnerId)
    const fixed = new Map();
    // bannedPartnerIdsByPlayer: Map(playerId => Set(partnerIds))
    const banned = new Map();

    players.forEach((p) => {
      const fpName = normalizeName(p.fixedPartnerName);
      if (fpName && nameToId.has(fpName)) fixed.set(p.id, nameToId.get(fpName));

      const bannedNames = parseBannedNames(p.bannedPartnersText);
      const set = new Set();
      bannedNames.forEach((bn) => {
        if (nameToId.has(bn)) set.add(nameToId.get(bn));
      });
      banned.set(p.id, set);
    });

    return { fixedPartnerIdByPlayer: fixed, bannedPartnerIdsByPlayer: banned };
  }, [players]);

  /** ---------- Schedule generation (5)(8) ---------- */
  function generateSchedule() {
    if (players.length < courts * 4) {
      alert(`인원이 부족합니다. ${courts}코트면 최소 ${courts * 4}명이 필요해요.`);
      return;
    }

    const opts = {
      courts,
      maxDiff: Number(maxDiff) || 1.0,
      preferMixed: mixedRatio >= 50,
      mixedVsFemaleGapMin: Number(mixedVsFemaleGapMin) || 1,
      mixedVsFemaleGapMax: Number(mixedVsFemaleGapMax) || 2,
      femaleDoublesPriority: !!femaleDoublesPriority,
    };

    const MAX_TRY_PER_ROUND = 350;
    const CANDIDATE_POOL_SIZE = 24;

    // working players
    let currentPlayers = players.map((p) => ({
      ...p,
      gamesPlayed: 0,
    }));

    const rounds = [];
    const roundsTarget = calcTargetRounds(players, courts);
    const roundsGoal = Math.max(1, roundsTarget);

    // Rough round-level mixed ratio guidance:
    // We'll just set opts.preferMixed based on mixedRatio and let scoring bias.
    // (Strict global ratio requires more complex tracking; this keeps it stable and fast.)
    for (let r = 1; r <= roundsGoal; r++) {
      let roundMatches = null;

      for (let t = 0; t < MAX_TRY_PER_ROUND; t++) {
        const candidatesAll = currentPlayers.filter((p) => p.gamesPlayed < (p.maxGames ?? 3));
        if (candidatesAll.length < courts * 4) break;

        // Balanced play count: fewer gamesPlayed first
        const candidates = [...candidatesAll]
          .sort((a, b) => {
            if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
            return 0.5 - Math.random();
          })
          .slice(0, Math.min(CANDIDATE_POOL_SIZE, candidatesAll.length));

        roundMatches = buildRoundByDFS(
          candidates,
          opts,
          partnerMaps.fixedPartnerIdByPlayer,
          partnerMaps.bannedPartnerIdsByPlayer
        );

        if (roundMatches) break;
      }

      if (!roundMatches) {
        alert(
          `⚠️ ${r}라운드에서 ${courts}코트 매칭을 만들지 못했습니다.\n` +
            `가능한 원인:\n` +
            `- 점수차(≤${opts.maxDiff})가 너무 빡셈\n` +
            `- 파트너 금지/고정이 과도함\n` +
            `- 혼복vs여복 갭(${opts.mixedVsFemaleGapMin}~${opts.mixedVsFemaleGapMax}) 조건\n` +
            `- 남/여 구성상 조합 부족`
        );
        break;
      }

      // update gamesPlayed
      roundMatches.forEach((m) => {
        [...m.teamA, ...m.teamB].forEach((p) => {
          const idx = currentPlayers.findIndex((cp) => cp.id === p.id);
          if (idx !== -1) currentPlayers[idx].gamesPlayed += 1;
        });
      });

      rounds.push({ id: r, matches: roundMatches });
    }

    setSchedule(rounds);
    setTab("schedule");
    setCourtRound(1);
  }

  /** ---------- Export/Share (1) ---------- */
  function scheduleAsText() {
    if (!schedule.length) return "대진표가 없습니다.";
    let out = [];
    out.push(`🏸 배드민턴 대진표 (${schedule.length}R / ${courts}코트)`);
    out.push(`- 점수차 ≤ ${Number(maxDiff).toFixed(1)}`);
    out.push(`- 혼복비중(가이드): ${mixedRatio}%`);
    out.push("");

    schedule.forEach((r) => {
      out.push(`=== ROUND ${r.id} ===`);
      r.matches.forEach((m) => {
        const tA = `${m.teamA[0].name}+${m.teamA[1].name}`;
        const tB = `${m.teamB[0].name}+${m.teamB[1].name}`;
        out.push(`코트${m.courtId}: ${tA}  vs  ${tB}  (Δ${m.diff.toFixed(1)})`);
      });
      out.push("");
    });

    return out.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("복사 완료!");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("복사 완료!");
    }
  }

  async function shareLink() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "배드민턴 대진표", url });
        return;
      } catch {
        // ignore and fallback to copy
      }
    }
    await copyText(url);
  }

  async function shareScheduleText() {
    await copyText(scheduleAsText());
  }

  async function exportScheduleImage() {
    if (!scheduleRef.current) return alert("대진표가 없습니다.");
    try {
      const dataUrl = await toPng(scheduleRef.current, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `대진표_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();

      // optional share
      // (Android Chrome sometimes supports sharing files; keeping it simple: download only)
    } catch (e) {
      alert("이미지 저장 실패: " + (e?.message || "알 수 없는 오류"));
    }
  }

  /** ---------- Excel ---------- */
  function downloadExcel() {
    if (!schedule.length) return alert("생성된 대진표가 없습니다.");

    const excelData = [];
    schedule.forEach((round) => {
      round.matches.forEach((match) => {
        excelData.push({
          라운드: `${round.id}R`,
          코트: `${match.courtId}코트`,
          "팀A 선수1": match.teamA[0].name,
          "팀A 선수2": match.teamA[1].name,
          "팀B 선수1": match.teamB[0].name,
          "팀B 선수2": match.teamB[1].name,
          점수차: match.diff.toFixed(1),
          타입: `${formatTypeLabel(teamType(match.teamA))} vs ${formatTypeLabel(teamType(match.teamB))}`,
        });
      });
      excelData.push({});
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 7 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 7 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "대진표");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `배드민턴_대진표_${date}.xlsx`);
  }

  /** ---------- Snapshots (9) ---------- */
  function saveSnapshot() {
    const name = prompt("저장 이름을 입력하세요 (예: 3/5 교류전)");
    if (!name) return;

    const snap = {
      id: safeId(),
      name,
      savedAt: new Date().toISOString(),
      state: {
        players,
        schedule,
        courts,
        maxDiff,
        mixedRatio,
        femaleDoublesPriority,
        mixedVsFemaleGapMin,
        mixedVsFemaleGapMax,
        courtRound,
      },
    };
    setSnapshots((prev) => [snap, ...prev].slice(0, 50));
    alert("스냅샷 저장 완료!");
  }

  function loadSnapshot(id) {
    const s = snapshots.find((x) => x.id === id);
    if (!s) return;
    const ok = confirm(`"${s.name}" 스냅샷을 불러올까요?\n(현재 내용은 덮어씁니다)`);
    if (!ok) return;

    const st = s.state;
    if (Array.isArray(st.players)) setPlayers(st.players);
    if (Array.isArray(st.schedule)) setSchedule(st.schedule);
    if (typeof st.courts === "number") setCourts(st.courts);
    if (typeof st.maxDiff === "number") setMaxDiff(st.maxDiff);
    if (typeof st.mixedRatio === "number") setMixedRatio(st.mixedRatio);
    if (typeof st.femaleDoublesPriority === "boolean") setFemaleDoublesPriority(st.femaleDoublesPriority);
    if (typeof st.mixedVsFemaleGapMin === "number") setMixedVsFemaleGapMin(st.mixedVsFemaleGapMin);
    if (typeof st.mixedVsFemaleGapMax === "number") setMixedVsFemaleGapMax(st.mixedVsFemaleGapMax);
    if (typeof st.courtRound === "number") setCourtRound(st.courtRound);

    setTab("players");
    alert("불러오기 완료!");
  }

  function deleteSnapshot(id) {
    const s = snapshots.find((x) => x.id === id);
    if (!s) return;
    const ok = confirm(`"${s.name}" 스냅샷을 삭제할까요?`);
    if (!ok) return;
    setSnapshots((prev) => prev.filter((x) => x.id !== id));
    if (snapshotPick === id) setSnapshotPick("");
  }

  /** ---------- UI blocks ---------- */
  const playersUI = (
    <>
      <Card title="선수 등록" subtitle="이름/급수/성별/목표경기 + 파트너(고정/금지) 설정 가능">
        <div className="grid2">
          <input
            className="in"
            placeholder="이름 입력"
            value={inputs.name}
            onChange={(e) => setInputs({ ...inputs, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          />
          <select className="in" value={inputs.gender} onChange={(e) => setInputs({ ...inputs, gender: e.target.value })}>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </div>
        <div className="grid3 mt10">
          <select className="in" value={inputs.grade} onChange={(e) => setInputs({ ...inputs, grade: e.target.value })}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            className="in"
            type="number"
            min={1}
            max={20}
            value={inputs.maxGames}
            onChange={(e) => setInputs({ ...inputs, maxGames: e.target.value })}
          />
          <input
            className="in"
            type="number"
            step="0.1"
            placeholder="커스텀점수(선택)"
            value={inputs.customScore}
            onChange={(e) => setInputs({ ...inputs, customScore: e.target.value })}
          />
        </div>

        <div className="row mt10">
          <button className="btn primary" onClick={addPlayer}>
            ✅ 추가
          </button>
          <button className="btn ghost" onClick={generateSchedule}>
            🏆 대진표 생성
          </button>
        </div>

        <div className="hint mt10">
          · 기본점수: 남({MALE_POINTS[inputs.grade]}) / 여({FEMALE_POINTS[inputs.grade]}) · 커스텀점수 입력 시 우선 적용
        </div>
      </Card>

      <Card title="재생성 옵션" subtitle="(8) 점수차, 혼복비중, 여복우선, 혼복vs여복 갭(1~2)">
        <div className="grid3">
          <Field label="코트 수">
            <select className="in" value={courts} onChange={(e) => setCourts(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}코트
                </option>
              ))}
            </select>
          </Field>

          <Field label={`점수차 ≤ ${Number(maxDiff).toFixed(1)}`}>
            <input
              className="in"
              type="range"
              min="0.0"
              max="3.0"
              step="0.1"
              value={maxDiff}
              onChange={(e) => setMaxDiff(Number(e.target.value))}
            />
          </Field>

          <Field label={`혼복 비중(가이드) ${mixedRatio}%`}>
            <input
              className="in"
              type="range"
              min="0"
              max="100"
              step="5"
              value={mixedRatio}
              onChange={(e) => setMixedRatio(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid3 mt10">
          <Field label="여복 우선">
            <label className="toggle">
              <input type="checkbox" checked={femaleDoublesPriority} onChange={(e) => setFemaleDoublesPriority(e.target.checked)} />
              <span>{femaleDoublesPriority ? "ON" : "OFF"}</span>
            </label>
          </Field>

          <Field label="혼복vs여복 갭 최소">
            <input className="in" type="number" min="0" max="5" value={mixedVsFemaleGapMin} onChange={(e) => setMixedVsFemaleGapMin(Number(e.target.value))} />
          </Field>

          <Field label="혼복vs여복 갭 최대">
            <input className="in" type="number" min="0" max="5" value={mixedVsFemaleGapMax} onChange={(e) => setMixedVsFemaleGapMax(Number(e.target.value))} />
          </Field>
        </div>

        <div className="hint mt10">
          · 제약: ⛔ 혼복vs남복 / ⛔ 남복vs여복 / ✅ 혼복vs여복(여복-혼복 {mixedVsFemaleGapMin}~{mixedVsFemaleGapMax})
          · 목표 라운드(자동): {targetRounds}R
        </div>
      </Card>

      <Card
        title={`등록 선수 (${stats.total}명 · 남 ${stats.m} / 여 ${stats.f})`}
        subtitle="(6) 고정 파트너: 상대 이름 입력 · 금지 파트너: 이름들을 콤마로 입력 (예: 홍길동,김철수)"
        right={
          <button className="btn danger" onClick={resetAllData} title="모두 초기화">
            🧹 전체 초기화
          </button>
        }
      >
        {players.length === 0 ? (
          <Empty text="선수가 없습니다. 위에서 추가하세요." />
        ) : isDesktop ? (
          <div className="tableWrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>성별</th>
                  <th>급수</th>
                  <th>적용점수</th>
                  <th>목표경기</th>
                  <th>고정파트너(이름)</th>
                  <th>금지파트너(이름들)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {playersSorted.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input className="in mini" value={p.name} onChange={(e) => updatePlayer(p.id, { name: e.target.value })} />
                    </td>
                    <td>
                      <select className="in mini" value={p.gender} onChange={(e) => updatePlayer(p.id, { gender: e.target.value })}>
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="in mini"
                        value={p.grade}
                        onChange={(e) => updatePlayer(p.id, { grade: e.target.value })}
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontWeight: 900 }}>{appliedScore(p).toFixed(1)}</td>
                    <td>
                      <input
                        className="in mini"
                        type="number"
                        min={1}
                        max={20}
                        value={p.maxGames ?? 3}
                        onChange={(e) => updatePlayer(p.id, { maxGames: clamp(Number(e.target.value) || 3, 1, 20) })}
                      />
                    </td>
                    <td>
                      <input
                        className="in mini"
                        value={p.fixedPartnerName ?? ""}
                        onChange={(e) => updatePlayer(p.id, { fixedPartnerName: e.target.value })}
                        placeholder="예: 김정수"
                      />
                    </td>
                    <td>
                      <input
                        className="in mini"
                        value={p.bannedPartnersText ?? ""}
                        onChange={(e) => updatePlayer(p.id, { bannedPartnersText: e.target.value })}
                        placeholder="예: 김정수,홍지현"
                      />
                    </td>
                    <td>
                      <button className="btn danger small" onClick={() => removePlayer(p.id)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="stack">
            {playersSorted.map((p) => (
              <div key={p.id} className="playerCard">
                <div className="row space">
                  <input className="in" value={p.name} onChange={(e) => updatePlayer(p.id, { name: e.target.value })} />
                  <button className="btn danger small" onClick={() => removePlayer(p.id)}>
                    삭제
                  </button>
                </div>

                <div className="grid3 mt10">
                  <select className="in" value={p.gender} onChange={(e) => updatePlayer(p.id, { gender: e.target.value })}>
                    <option value="M">남</option>
                    <option value="F">여</option>
                  </select>

                  <select className="in" value={p.grade} onChange={(e) => updatePlayer(p.id, { grade: e.target.value })}>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>

                  <input
                    className="in"
                    type="number"
                    min={1}
                    max={20}
                    value={p.maxGames ?? 3}
                    onChange={(e) => updatePlayer(p.id, { maxGames: clamp(Number(e.target.value) || 3, 1, 20) })}
                  />
                </div>

                <div className="mt10 hint">
                  적용점수: <b>{appliedScore(p).toFixed(1)}</b>
                </div>

                <div className="mt10">
                  <div className="label">고정 파트너(이름)</div>
                  <input
                    className="in"
                    value={p.fixedPartnerName ?? ""}
                    onChange={(e) => updatePlayer(p.id, { fixedPartnerName: e.target.value })}
                    placeholder="예: 김정수"
                  />
                </div>

                <div className="mt10">
                  <div className="label">금지 파트너(이름들, 콤마)</div>
                  <input
                    className="in"
                    value={p.bannedPartnersText ?? ""}
                    onChange={(e) => updatePlayer(p.id, { bannedPartnersText: e.target.value })}
                    placeholder="예: 김정수,홍지현"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="스냅샷 저장/불러오기" subtitle="(9) 현재 선수/설정/대진표를 통째로 저장">
        <div className="row">
          <button className="btn primary" onClick={saveSnapshot}>
            💾 스냅샷 저장
          </button>

          <select className="in" value={snapshotPick} onChange={(e) => setSnapshotPick(e.target.value)} style={{ flex: 1 }}>
            <option value="">(선택) 저장된 스냅샷</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {new Date(s.savedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div className="row mt10">
          <button className="btn ghost" disabled={!snapshotPick} onClick={() => loadSnapshot(snapshotPick)}>
            불러오기
          </button>
          <button className="btn danger" disabled={!snapshotPick} onClick={() => deleteSnapshot(snapshotPick)}>
            삭제
          </button>
        </div>

        <div className="hint mt10">· 스냅샷은 브라우저(휴대폰)에 저장됩니다. 브라우저 데이터 삭제하면 사라질 수 있어요.</div>
      </Card>
    </>
  );

  const scheduleUI = (
    <>
      <div ref={scheduleRef}>
        <Card
          title={`대진표 (${schedule.length}R)`}
          subtitle="(5) 출전 균등화 · (6) 파트너 제약 · (8) 옵션 반영"
          right={
            <div className="row">
              <button className="btn ghost" onClick={generateSchedule}>
                🔄 재생성
              </button>
              <button className="btn primary" onClick={() => setTab("court")}>
                🎥 코트모드
              </button>
            </div>
          }
        >
          {schedule.length === 0 ? (
            <Empty text="대진표가 없습니다. 선수 탭에서 생성하세요." />
          ) : (
            <div className="stack">
              {schedule.map((r) => (
                <div key={r.id} className="roundCard">
                  <div className="roundHead">
                    <div className="roundTitle">ROUND {r.id}</div>
                    <div className="roundSub">{r.matches.length} matches</div>
                  </div>

                  <div className="gridSchedule">
                    {r.matches.map((m, idx) => {
                      const tA = teamType(m.teamA);
                      const tB = teamType(m.teamB);
                      const cA = badgeColorByType(tA);
                      const cB = badgeColorByType(tB);

                      return (
                        <div key={idx} className="matchCard">
                          <div className="matchTop">
                            <div className="courtPill">{m.courtId}코트</div>
                            <div className="typeRow">
                              <span className="typePill" style={{ background: cA.bg, borderColor: cA.bd, color: cA.tx }}>
                                {formatTypeLabel(tA)}
                              </span>
                              <span className="typePill" style={{ background: cB.bg, borderColor: cB.bd, color: cB.tx }}>
                                {formatTypeLabel(tB)}
                              </span>
                              <span className="diffPill">Δ {m.diff.toFixed(1)}</span>
                            </div>
                          </div>

                          <div className="teamsRow">
                            <TeamBox team={m.teamA} sum={m.scoreA} />
                            <div className="vs">VS</div>
                            <TeamBox team={m.teamB} sum={m.scoreB} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="내보내기 & 공유" subtitle="(1) 링크/대진표 텍스트 공유 + 이미지/엑셀 저장">
        <div className="row">
          <button className="btn ghost" onClick={shareLink}>
            🔗 링크 공유/복사
          </button>
          <button className="btn ghost" onClick={shareScheduleText}>
            📝 대진표 텍스트 복사
          </button>
        </div>

        <div className="row mt10">
          <button className="btn primary" onClick={exportScheduleImage}>
            🖼️ 이미지 저장(PNG)
          </button>
          <button className="btn primary" onClick={downloadExcel}>
            📊 엑셀 저장
          </button>
        </div>

        <div className="hint mt10">· 단톡방 공유는 “텍스트 복사”가 가장 빠릅니다. (붙여넣기만 하면 됨)</div>
      </Card>
    </>
  );

  const roundsForCourtMode = useMemo(() => scheduleToRounds(schedule), [schedule]);

  const courtUI = (
    <>
      <Card
        title="코트 화면 모드"
        subtitle="(10) 현장용 큰 글씨 · 라운드 선택"
        right={
          <button className="btn ghost" onClick={() => setTab("schedule")}>
            ⬅️ 돌아가기
          </button>
        }
      >
        {roundsForCourtMode.length === 0 ? (
          <Empty text="대진표가 없습니다." />
        ) : (
          <>
            <div className="row">
              <div className="label" style={{ minWidth: 70 }}>
                라운드
              </div>
              <select className="in" value={courtRound} onChange={(e) => setCourtRound(Number(e.target.value))} style={{ flex: 1 }}>
                {roundsForCourtMode.map((r) => (
                  <option key={r.round} value={r.round}>
                    Round {r.round}
                  </option>
                ))}
              </select>
            </div>

            <div className="courtScreen mt10">
              {(() => {
                const r = roundsForCourtMode.find((x) => x.round === courtRound) || roundsForCourtMode[0];
                return (
                  <>
                    <div className="courtScreenHead">
                      <div className="courtScreenTitle">ROUND {r.round}</div>
                      <div className="courtScreenSub">{courts}코트</div>
                    </div>

                    <div className="courtGrid">
                      {r.courts.map((c) => {
                        const tA = c.typeA;
                        const tB = c.typeB;
                        return (
                          <div key={c.court} className="courtBigCard">
                            <div className="courtBigTop">
                              <div className="courtBigNo">Court {c.court}</div>
                              <div className="courtBigTypes">
                                <span className="typePill big">{formatTypeLabel(tA)}</span>
                                <span className="typePill big">{formatTypeLabel(tB)}</span>
                              </div>
                            </div>

                            <div className="courtBigTeams">
                              <div className="bigTeam">
                                <div className="bigNames">
                                  <div>{c.teamA[0].name}</div>
                                  <div>{c.teamA[1].name}</div>
                                </div>
                              </div>
                              <div className="bigVs">VS</div>
                              <div className="bigTeam">
                                <div className="bigNames">
                                  <div>{c.teamB[0].name}</div>
                                  <div>{c.teamB[1].name}</div>
                                </div>
                              </div>
                            </div>

                            <div className="bigFoot">Δ {Number(c.diff || 0).toFixed(1)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </Card>
    </>
  );

  /** ---------- Layout ---------- */
  const header = (
    <div className="topHeader">
      <div className="brandRow">
        <div className="logo">🏸</div>
        <div>
          <div className="brandTitle">배드민턴 밸런스 매처</div>
          <div className="brandSub">
            {courts}코트 · 인원 {stats.total}명 · 목표 {targetRounds}R · 점수차 ≤ {Number(maxDiff).toFixed(1)}
          </div>
        </div>
      </div>

      {!isDesktop && (
        <div className="tabRow">
          <button className={`tabBtn ${tab === "players" ? "on" : ""}`} onClick={() => setTab("players")}>
            👥 선수
          </button>
          <button className={`tabBtn ${tab === "schedule" ? "on" : ""}`} onClick={() => setTab("schedule")}>
            🏆 대진표
          </button>
          <button className={`tabBtn ${tab === "court" ? "on" : ""}`} onClick={() => setTab("court")}>
            🎥 코트
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <StyleBlock />
      <div className="shell">
        {header}

        <div className="content">
          {isDesktop ? (
            <div className="desktopGrid">
              <div>{playersUI}</div>
              <div>
                {tab === "court" ? courtUI : scheduleUI}
                <Card title="빠른 이동" subtitle="PC에서는 우측에서 대진표/코트모드를 확인하세요">
                  <div className="row">
                    <button className="btn ghost" onClick={() => setTab("schedule")}>
                      🏆 대진표
                    </button>
                    <button className="btn primary" onClick={() => setTab("court")}>
                      🎥 코트모드
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <>
              {tab === "players" && playersUI}
              {tab === "schedule" && scheduleUI}
              {tab === "court" && courtUI}
            </>
          )}
        </div>

        {/* Mobile bottom bar */}
        {!isDesktop && (
          <div className="bottomBar">
            <button className="btn ghost" onClick={() => setTab("players")}>
              👥 선수
            </button>
            <button className="btn primary" onClick={generateSchedule}>
              🏆 생성
            </button>
            <button className="btn ghost" onClick={() => setTab("schedule")}>
              📋 대진표
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** ---------- small components ---------- */
function Card({ title, subtitle, right, children }) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="cardTitle">{title}</div>
          {subtitle && <div className="cardSub">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="empty">
      <div className="emptyTitle">{text}</div>
      <div className="emptySub">선수/옵션을 조정한 뒤 다시 생성해보세요.</div>
    </div>
  );
}

function TeamBox({ team, sum }) {
  return (
    <div className="teamBox">
      {team.map((p) => (
        <div key={p.id} className="playerLine">
          <div className="pName">{p.name}</div>
          <div className="pMeta">
            {p.gender === "M" ? "남" : "여"}/{p.grade}({appliedScore(p).toFixed(1)})
          </div>
        </div>
      ))}
      <div className="sumLine">합 {Number(sum || 0).toFixed(1)}</div>
    </div>
  );
}

/** ---------- Styles ---------- */
function StyleBlock() {
  return (
    <style>{`
      :root{
        --bg:#0b1220;
        --card:rgba(255,255,255,0.06);
        --line:rgba(255,255,255,0.10);
        --text:rgba(255,255,255,0.92);
        --muted:rgba(255,255,255,0.65);
        --accent:#7c5cff;
        --accent2:#29d1a6;
        --danger:#ff5c7a;
      }
      *{box-sizing:border-box;}
      body{margin:0;background:var(--bg);color:var(--text);font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans KR", Arial;}
      .page{min-height:100vh;background:var(--bg);}
      .shell{max-width:440px;margin:0 auto;padding:0 12px 88px;}
      .topHeader{position:sticky;top:0;z-index:10;padding:14px 0 10px;background:linear-gradient(180deg, rgba(11,18,32,0.98) 0%, rgba(11,18,32,0.85) 65%, rgba(11,18,32,0) 100%);backdrop-filter: blur(10px);}
      .brandRow{display:flex;gap:10;align-items:center;}
      .logo{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;font-size:22px;background:linear-gradient(135deg, rgba(124,92,255,0.35), rgba(41,209,166,0.20));border:1px solid rgba(255,255,255,0.10);}
      .brandTitle{font-size:20px;font-weight:1000;letter-spacing:-0.2px;}
      .brandSub{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.35;}
      .tabRow{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10;margin-top:12;}
      .tabBtn{padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,0.06);color:var(--text);font-weight:900;}
      .tabBtn.on{border-color:rgba(124,92,255,0.35);background:linear-gradient(135deg, rgba(124,92,255,0.20), rgba(41,209,166,0.10));}
      .content{padding-top:6px;}
      .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,0.25);margin-bottom:12px;}
      .cardHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10;margin-bottom:10px;}
      .cardTitle{font-size:16px;font-weight:1000;}
      .cardSub{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.35;}
      .in{width:100%;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.20);color:var(--text);font-weight:900;outline:none;}
      .in.mini{padding:8px 10px;border-radius:12px;font-weight:800;}
      .row{display:flex;gap:10;align-items:center;}
      .row.space{justify-content:space-between;}
      .grid2{display:grid;grid-template-columns:1fr 110px;gap:10;}
      .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10;}
      .mt10{margin-top:10px;}
      .hint{font-size:12px;color:var(--muted);line-height:1.45;}
      .label{font-size:12px;color:var(--muted);font-weight:900;margin-bottom:6px;}
      .field{display:grid;gap:6;}
      .btn{padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:var(--text);font-weight:1000;cursor:pointer;}
      .btn.small{padding:8px 10px;border-radius:12px;font-weight:900;}
      .btn.primary{border-color:rgba(124,92,255,0.45);background:linear-gradient(135deg, rgba(124,92,255,0.95), rgba(41,209,166,0.60));}
      .btn.ghost{background:rgba(255,255,255,0.06);}
      .btn.danger{border-color:rgba(255,92,122,0.35);background:rgba(255,92,122,0.12);}
      .btn:disabled{opacity:0.45;cursor:not-allowed;}
      .stack{display:grid;gap:10;}
      .playerCard{padding:10px;border-radius:16px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.16);}
      .empty{padding:14px;border-radius:16px;border:1px dashed rgba(255,255,255,0.18);background:rgba(0,0,0,0.16);text-align:center;}
      .emptyTitle{font-weight:1000;margin-bottom:6px;}
      .emptySub{font-size:12px;color:var(--muted);}
      .bottomBar{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;width:min(440px, calc(100% - 24px));display:grid;grid-template-columns:1fr 1fr 1fr;gap:10;padding:10px;border-radius:18px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.35);backdrop-filter: blur(12px);box-shadow:0 12px 30px rgba(0,0,0,0.35);}
      .roundCard{border-radius:18px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.16);overflow:hidden;}
      .roundHead{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:linear-gradient(135deg, rgba(124,92,255,0.16), rgba(41,209,166,0.10));}
      .roundTitle{font-weight:1000;}
      .roundSub{font-size:12px;color:var(--muted);font-weight:900;}
      .gridSchedule{display:grid;gap:10;padding:12px;}
      @media (min-width: 900px){
        .shell{max-width:1100px;padding:0 14px 24px;}
        .desktopGrid{display:grid;grid-template-columns:1.1fr 0.9fr;gap:14px;align-items:start;}
        .bottomBar{display:none;}
        .gridSchedule{grid-template-columns:1fr 1fr;}
      }
      .matchCard{border-radius:16px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);padding:12px;}
      .matchTop{display:flex;justify-content:space-between;align-items:center;gap:10;margin-bottom:10px;}
      .courtPill{font-size:12px;font-weight:1000;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.18);}
      .typeRow{display:flex;gap:8;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
      .typePill{font-size:12px;font-weight:1000;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);}
      .typePill.big{font-size:14px;padding:7px 12px;}
      .diffPill{font-size:12px;font-weight:1000;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:rgba(124,92,255,0.10);color:rgba(124,92,255,0.95);}
      .teamsRow{display:grid;grid-template-columns:1fr auto 1fr;gap:10;align-items:center;}
      .vs{font-weight:1000;opacity:0.6;}
      .teamBox{border-radius:14px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.12);padding:10px;}
      .playerLine{display:flex;justify-content:space-between;gap:8;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,0.10);}
      .playerLine:last-child{border-bottom:none;}
      .pName{font-weight:1000;}
      .pMeta{font-size:11px;color:var(--muted);font-weight:800;}
      .sumLine{margin-top:8px;font-size:12px;color:var(--muted);font-weight:1000;text-align:right;}
      .toggle{display:flex;gap:10;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.20);padding:10px 12px;border-radius:14px;font-weight:1000;}
      .tableWrap{overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.10);}
      .tbl{width:100%;border-collapse:collapse;background:rgba(0,0,0,0.10);}
      .tbl th,.tbl td{padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:12px;vertical-align:middle;}
      .tbl th{position:sticky;top:0;background:rgba(11,18,32,0.95);backdrop-filter: blur(8px);text-align:left;font-weight:1000;}
      .courtScreen{border-radius:18px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.18);padding:12px;}
      .courtScreenHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
      .courtScreenTitle{font-weight:1000;font-size:18px;}
      .courtScreenSub{font-weight:1000;color:var(--muted);}
      .courtGrid{display:grid;gap:10;}
      @media (min-width: 900px){
        .courtGrid{grid-template-columns:1fr 1fr;}
      }
      .courtBigCard{border-radius:16px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);padding:12px;}
      .courtBigTop{display:flex;justify-content:space-between;align-items:center;gap:10;}
      .courtBigNo{font-weight:1000;font-size:16px;}
      .courtBigTeams{display:grid;grid-template-columns:1fr auto 1fr;gap:10;align-items:center;margin-top:10px;}
      .bigVs{font-weight:1000;opacity:0.6;font-size:16px;}
      .bigTeam{border-radius:14px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.12);padding:12px;}
      .bigNames{font-weight:1000;font-size:18px;line-height:1.4;}
      .bigFoot{margin-top:10px;text-align:right;color:var(--muted);font-weight:1000;}
    `}</style>
  );
}