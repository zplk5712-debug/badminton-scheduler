import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image"; // npm install html-to-image

// === 기본 설정 ===
const GRADES = ["A", "B", "C", "D", "초심"];

const MALE_POINTS = { A: 5, B: 4, C: 3, D: 2, 초심: 1 };
const FEMALE_POINTS = { A: 3.8, B: 2.5, C: 2.0, D: 1.5, 초심: 0.5 };

const INITIAL_PLAYERS = [
  { id: 1, name: "김정수", gender: "남", grade: "B", maxGames: 3, customScore: null },
  { id: 2, name: "권민우", gender: "남", grade: "A", maxGames: 3, customScore: null },
  { id: 3, name: "조승민", gender: "남", grade: "A", maxGames: 3, customScore: null },
  { id: 4, name: "정동원", gender: "남", grade: "A", maxGames: 3, customScore: null },
  { id: 5, name: "이유진", gender: "여", grade: "A", maxGames: 3, customScore: null },
  { id: 6, name: "장우경", gender: "여", grade: "B", maxGames: 3, customScore: null },
  { id: 7, name: "김영경", gender: "여", grade: "B", maxGames: 3, customScore: null },
  { id: 8, name: "윤선미", gender: "여", grade: "B", maxGames: 3, customScore: null },
  { id: 9, name: "조영미", gender: "여", grade: "B", maxGames: 3, customScore: null },
  { id: 10, name: "구본근", gender: "남", grade: "B", maxGames: 3, customScore: null },
  { id: 11, name: "박정호", gender: "남", grade: "C", maxGames: 3, customScore: null },
  { id: 12, name: "김상현", gender: "남", grade: "C", maxGames: 3, customScore: null },
  { id: 13, name: "송민흡", gender: "남", grade: "C", maxGames: 3, customScore: null },
  { id: 14, name: "김혜인", gender: "여", grade: "C", maxGames: 3, customScore: null },
  { id: 15, name: "이지영", gender: "여", grade: "C", maxGames: 3, customScore: null },
  { id: 16, name: "전은경", gender: "여", grade: "C", maxGames: 3, customScore: null },
  { id: 17, name: "이혜련", gender: "여", grade: "C", maxGames: 3, customScore: null },
  { id: 18, name: "강옥희", gender: "여", grade: "D", maxGames: 3, customScore: null },
  { id: 19, name: "홍지현", gender: "여", grade: "D", maxGames: 3, customScore: null },
  { id: 20, name: "이시은", gender: "여", grade: "D", maxGames: 3, customScore: null },
  { id: 21, name: "한금옥", gender: "여", grade: "D", maxGames: 3, customScore: null },
  { id: 22, name: "하은정", gender: "여", grade: "D", maxGames: 3, customScore: null },
  { id: 23, name: "김민정", gender: "여", grade: "D", maxGames: 3, customScore: null },
  { id: 24, name: "김민혁", gender: "남", grade: "D", maxGames: 3, customScore: null },
  { id: 25, name: "이정현", gender: "남", grade: "D", maxGames: 3, customScore: null },
  { id: 26, name: "강상철", gender: "남", grade: "초심", maxGames: 3, customScore: null },
  { id: 27, name: "김원위", gender: "남", grade: "초심", maxGames: 3, customScore: null },
  { id: 28, name: "박장웅", gender: "남", grade: "초심", maxGames: 3, customScore: null },
  { id: 29, name: "유준필", gender: "남", grade: "초심", maxGames: 3, customScore: null },
  { id: 30, name: "류주현", gender: "여", grade: "초심", maxGames: 3, customScore: null },
  { id: 31, name: "김성용", gender: "남", grade: "B", maxGames: 3, customScore: null },
  { id: 32, name: "이자은", gender: "여", grade: "A", maxGames: 3, customScore: null },
];

// === UI ===
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-lg border border-gray-100 ${className}`}>{children}</div>
);

const Button = ({ onClick, children, variant = "primary", className = "", disabled = false, type = "button" }) => {
  const base =
    "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-95";
  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-700 hover:to-blue-600 shadow-blue-200 shadow-md",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    success:
      "bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:from-emerald-700 hover:to-emerald-600 shadow-green-200 shadow-md",
    excel:
      "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-green-200 shadow-md",
    danger:
      "bg-gradient-to-r from-rose-600 to-red-500 text-white hover:from-rose-700 hover:to-red-600 shadow-red-200 shadow-md",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default function BadmintonSchedulerProV8_Full() {
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [schedule, setSchedule] = useState([]);
  const [activeTab, setActiveTab] = useState("players");
  const [inputs, setInputs] = useState({ name: "", gender: "남", grade: "C", maxGames: 3, customScore: "" });

  const scheduleRef = useRef(null);

  // ✅ 엑셀 업로드 input
  const uploadRef = useRef(null);

  // === 상수 ===
  const TOTAL_COURTS = 4;
  const MAX_DIFF = 1.0;
  const CANDIDATE_POOL_SIZE = 22;
  const MAX_TRY_PER_ROUND = 300;

  // ✅ 혼복 vs 여복 조건: 여복 - 혼복 = 1~2
  const MIXED_VS_FEMALE_GAP_MIN = 1;
  const MIXED_VS_FEMALE_GAP_MAX = 2;

  // === 유틸 ===
  const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.trunc(v)));

  // === 점수 ===
  const getBaseScore = useCallback((grade, gender) => {
    return gender === "남" ? MALE_POINTS[grade] : FEMALE_POINTS[grade];
  }, []);

  const getPlayerScore = useCallback(
    (p) => {
      const cs = p.customScore;
      if (typeof cs === "number" && Number.isFinite(cs)) return cs;
      return getBaseScore(p.grade, p.gender);
    },
    [getBaseScore]
  );

  const playersWithLiveScore = useMemo(() => {
    return players.map((p) => ({ ...p, liveScore: getPlayerScore(p) }));
  }, [players, getPlayerScore]);

  // === 선수 추가/수정 ===
  const updatePlayerField = (id, patch) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPlayer = () => {
    if (!inputs.name.trim()) return;
    const newId = players.length ? Math.max(...players.map((p) => p.id)) + 1 : 1;

    const parsedCustom =
      inputs.customScore === "" || inputs.customScore === null
        ? null
        : Number.isFinite(Number(inputs.customScore))
        ? Number(inputs.customScore)
        : null;

    const parsedMaxGames = Number.isFinite(Number(inputs.maxGames)) ? clampInt(Number(inputs.maxGames), 1, 20) : 3;

    setPlayers([
      ...players,
      {
        id: newId,
        name: inputs.name.trim(),
        gender: inputs.gender,
        grade: inputs.grade,
        maxGames: parsedMaxGames,
        customScore: parsedCustom,
      },
    ]);
    setInputs({ ...inputs, name: "", customScore: "" });
  };

  // === 팀 타입/룰 ===
  const getTeamType = (team) => {
    const maleCount = team.filter((p) => p.gender === "남").length;
    if (maleCount === 2) return "NAM";
    if (maleCount === 1) return "HON";
    return "YEO";
  };

  const checkMixedBalanceRule = (team, isWeakerTeam) => {
    if (!isWeakerTeam) return true;
    const male = team.find((p) => p.gender === "남");
    const female = team.find((p) => p.gender === "여");
    if (male && female) return male.score >= female.score;
    return true;
  };

  // 🚫 혼복 vs 남복 금지 / 🚫 남복 vs 여복 금지
  // ✅ 혼복 vs 여복은 허용(단 점수조건 강제)
  const isForbiddenMatchup = (typeA, typeB) => {
    const mixedVsMale = (typeA === "HON" && typeB === "NAM") || (typeA === "NAM" && typeB === "HON");
    const maleVsFemale = (typeA === "NAM" && typeB === "YEO") || (typeA === "YEO" && typeB === "NAM");
    return mixedVsMale || maleVsFemale;
  };

  // === 목표 라운드 계산(표시용) ===
  const calcTargetRounds = (playersArr, totalCourts) => {
    const totalPlayerGames = playersArr.reduce((sum, p) => sum + Number(p.maxGames || 0), 0);
    const totalMatches = Math.floor(totalPlayerGames / 4);
    return Math.floor(totalMatches / totalCourts);
  };

  // === DFS 매칭 헬퍼 ===
  const sumTeam = (team) => team.reduce((s, p) => s + p.score, 0);

  const buildAllTeamSplits = (a, b, c, d) => [
    { teamA: [a, d], teamB: [b, c] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, b], teamB: [c, d] },
  ];

  const pickBestMatchFromFour = (four) => {
    const [a, b, c, d] = four;
    let best = null;
    let bestPenalty = Infinity;

    for (const sp of buildAllTeamSplits(a, b, c, d)) {
      const typeA = getTeamType(sp.teamA);
      const typeB = getTeamType(sp.teamB);

      if (isForbiddenMatchup(typeA, typeB)) continue;

      const scoreA = sumTeam(sp.teamA);
      const scoreB = sumTeam(sp.teamB);
      const diff = Math.abs(scoreA - scoreB);
      if (diff > MAX_DIFF) continue;

      // ✅ 혼복 vs 여복이면: 여복-혼복 = 1~2 강제
      const isMixedVsFemale = (typeA === "HON" && typeB === "YEO") || (typeA === "YEO" && typeB === "HON");
      if (isMixedVsFemale) {
        const mixedScore = typeA === "HON" ? scoreA : scoreB;
        const femaleScore = typeA === "YEO" ? scoreA : scoreB;
        const gap = femaleScore - mixedScore;
        if (gap < MIXED_VS_FEMALE_GAP_MIN || gap > MIXED_VS_FEMALE_GAP_MAX) continue;
      }

      const isTeamAWeaker = scoreA < scoreB;
      const isTeamBWeaker = scoreB < scoreA;
      const validA = scoreA === scoreB ? true : checkMixedBalanceRule(sp.teamA, isTeamAWeaker);
      const validB = scoreA === scoreB ? true : checkMixedBalanceRule(sp.teamB, isTeamBWeaker);

      let penalty = 0;
      if (!validA || !validB) penalty += 2000;
      penalty += diff * 10;

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = { ...sp, scoreA, scoreB, diff, penalty };
      }
    }

    return best;
  };

  const buildRoundByDFS = (pool) => {
    if (pool.length < TOTAL_COURTS * 4) return null;

    const used = new Set();
    const matches = [];

    const ordered = [...pool].sort((x, y) => {
      if (x.gamesPlayed !== y.gamesPlayed) return x.gamesPlayed - y.gamesPlayed;
      return 0.5 - Math.random();
    });

    const pickFirstUnusedIndex = () => {
      for (let i = 0; i < ordered.length; i++) if (!used.has(ordered[i].id)) return i;
      return -1;
    };

    const dfs = (courtIndex) => {
      if (courtIndex === TOTAL_COURTS) return true;

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

            const best = pickBestMatchFromFour([p1, p2, p3, p4]);
            if (best && best.penalty < 1000) {
              used.add(p4.id);
              matches.push({ courtId: courtIndex + 1, ...best });

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
  };

  // === 대진표 생성 ===
  const generateSchedule = () => {
    try {
      const targetRounds = calcTargetRounds(players, TOTAL_COURTS);

      let currentPlayers = playersWithLiveScore.map((p) => ({
        ...p,
        gamesPlayed: 0,
        score: p.liveScore,
      }));

      const rounds = [];

      for (let r = 1; r <= targetRounds; r++) {
        let roundMatches = null;

        for (let t = 0; t < MAX_TRY_PER_ROUND; t++) {
          const candidatesAll = currentPlayers.filter((p) => p.gamesPlayed < p.maxGames);
          if (candidatesAll.length < TOTAL_COURTS * 4) break;

          const candidates = [...candidatesAll]
            .sort((a, b) => {
              if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
              return 0.5 - Math.random();
            })
            .slice(0, Math.min(CANDIDATE_POOL_SIZE, candidatesAll.length));

          roundMatches = buildRoundByDFS(candidates);
          if (roundMatches) break;
        }

        if (!roundMatches) {
          alert(
            `⚠️ ${r}라운드에서 4코트 매칭을 만들지 못했습니다.\n혼복vs여복(여복-혼복=1~2) 또는 점수차(≤${MAX_DIFF}) 때문에 조합이 부족할 수 있어요.`
          );
          break;
        }

        roundMatches.forEach((m) => {
          [...m.teamA, ...m.teamB].forEach((p) => {
            const idx = currentPlayers.findIndex((cp) => cp.id === p.id);
            if (idx !== -1) currentPlayers[idx].gamesPlayed += 1;
          });
        });

        rounds.push({ id: r, matches: roundMatches });
      }

      setSchedule(rounds);
      setActiveTab("schedule");
    } catch (e) {
      console.error(e);
      alert("매칭 생성 중 오류가 발생했습니다.");
    }
  };

  // === (추가 기능 1) 선수 정보 변경 시, 생성된 schedule도 자동 동기화(재생성 없이 표시 반영) ===
  const scheduleSyncGuard = useRef(false);

  const hydratePlayerFromLive = useCallback(
    (pLike) => {
      const cur = playersWithLiveScore.find((x) => x.id === pLike.id);
      if (!cur) return pLike;
      return {
        ...pLike,
        name: cur.name,
        gender: cur.gender,
        grade: cur.grade,
        score: cur.liveScore, // 표시용 점수 동기화
      };
    },
    [playersWithLiveScore]
  );

  useEffect(() => {
    if (scheduleSyncGuard.current) return;
    if (!schedule.length) return;

    scheduleSyncGuard.current = true;
    setSchedule((prev) => {
      const next = prev.map((round) => {
        const newMatches = round.matches.map((m) => {
          const teamA = m.teamA.map(hydratePlayerFromLive);
          const teamB = m.teamB.map(hydratePlayerFromLive);
          const scoreA = teamA.reduce((s, p) => s + (Number(p.score) || 0), 0);
          const scoreB = teamB.reduce((s, p) => s + (Number(p.score) || 0), 0);
          const diff = Math.abs(scoreA - scoreB);

          return { ...m, teamA, teamB, scoreA, scoreB, diff };
        });
        return { ...round, matches: newMatches };
      });
      return next;
    });
    scheduleSyncGuard.current = false;
  }, [playersWithLiveScore, hydratePlayerFromLive, schedule.length]);

  // === 엑셀 저장 ===
  const downloadExcel = () => {
    if (!schedule.length) return alert("생성된 대진표가 없습니다.");

    try {
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
            점수차: Number(match.diff).toFixed(1),
          });
        });
        excelData.push({});
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      ws["!cols"] = [{ wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "대진표");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `배드민턴_대진표_${date}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("엑셀 다운로드 오류 (xlsx 설치 확인)");
    }
  };

  // === 대진표 이미지(PNG) 저장 ===
  const downloadScheduleImage = async () => {
    if (!scheduleRef.current) return;

    try {
      const dataUrl = await toPng(scheduleRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `대진표_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      alert("이미지 저장 중 오류가 발생했습니다.");
    }
  };

  const handleStat = (g) => players.filter((p) => p.gender === g).length;

  // === (추가 기능 2) 엑셀로 선수 일괄 업로드(선수명단 갱신) ===
  // 기대 컬럼(헤더): 이름, 성별(남/여), 급수(A/B/C/D/초심), 목표경기, 커스텀점수(선택)
  const validateGender = (v) => (v === "남" || v === "여" ? v : null);
  const validateGrade = (v) => (GRADES.includes(v) ? v : null);

  const parseNumberOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const onUploadExcelPlayers = async (file) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) return alert("엑셀 시트가 없습니다.");
      const ws = wb.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }); // [{이름:..., 성별:...}, ...]
      if (!rows.length) return alert("엑셀에 데이터가 없습니다.");

      const parsed = [];
      for (const r of rows) {
        const name = String(r["이름"] ?? "").trim();
        if (!name) continue;

        const gender = validateGender(String(r["성별"] ?? "").trim());
        const grade = validateGrade(String(r["급수"] ?? "").trim());
        const maxGamesRaw = parseNumberOrNull(r["목표경기"]);
        const maxGames = Number.isFinite(maxGamesRaw) ? clampInt(maxGamesRaw, 1, 20) : 3;

        const customScoreRaw = parseNumberOrNull(r["커스텀점수"]);
        const customScore = typeof customScoreRaw === "number" ? customScoreRaw : null;

        if (!gender || !grade) {
          // 잘못된 행은 스킵
          continue;
        }

        parsed.push({ name, gender, grade, maxGames, customScore });
      }

      if (!parsed.length) {
        return alert("유효한 행이 없습니다. (이름/성별/급수 확인)");
      }

      // ✅ 이름 중복 제거(앞에 나온 것 우선)
      const seen = new Set();
      const unique = [];
      for (const p of parsed) {
        const key = p.name.trim();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(p);
      }

      const rebuilt = unique.map((p, idx) => ({ id: idx + 1, ...p }));

      // ✅ 선수 명단을 엑셀 기준으로 갱신 + 기존 대진표는 초기화(권장)
      setPlayers(rebuilt);
      setSchedule([]);
      setActiveTab("players");

      alert(`✅ 선수 ${rebuilt.length}명 업로드 완료 (대진표는 초기화됨)`);
    } catch (e) {
      console.error(e);
      alert("엑셀 업로드 중 오류가 발생했습니다. (파일 형식/헤더 확인)");
    }
  };

  const downloadPlayerTemplate = () => {
    try {
      const sample = [
        { 이름: "홍길동", 성별: "남", 급수: "C", 목표경기: 3, 커스텀점수: "" },
        { 이름: "김영희", 성별: "여", 급수: "D", 목표경기: 3, 커스텀점수: "" },
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      ws["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "선수명단");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `선수명단_템플릿_${date}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("템플릿 다운로드 오류 (xlsx 설치 확인)");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans text-slate-800">
      <header className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-indigo-900 flex items-center justify-center gap-3 mb-2">
          <span>🏸</span> 배드민턴 밸런스 매처 v8 (업그레이드)
        </h1>
        <p className="text-slate-600 font-medium text-sm md:text-base">
          <span className="text-blue-600 font-bold mr-2">[4코트 풀가동 + DFS]</span>
          <span className="text-indigo-600 font-bold">
            인원 {players.length}명 / 점수차 ≤ {MAX_DIFF.toFixed(1)} / 목표 {calcTargetRounds(players, TOTAL_COURTS)}R
          </span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          🚫 혼복vs남복 / 🚫 남복vs여복 / ✅ 혼복vs여복(여복-혼복 {MIXED_VS_FEMALE_GAP_MIN}~{MIXED_VS_FEMALE_GAP_MAX})
        </p>
      </header>

      {/* 탭 */}
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
          <button
            onClick={() => setActiveTab("players")}
            className={`px-6 md:px-8 py-3 rounded-lg font-bold transition-all ${
              activeTab === "players" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            👥 선수 관리 ({players.length})
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-6 md:px-8 py-3 rounded-lg font-bold transition-all ${
              activeTab === "schedule" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            🏆 대진표 ({schedule.length}R)
          </button>
        </div>
      </div>

      {activeTab === "players" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex-1">➕ 선수 등록</h2>

              {/* ✅ 엑셀 업로드/템플릿 */}
              <input
                ref={uploadRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  onUploadExcelPlayers(f);
                  e.target.value = ""; // 같은 파일 다시 업로드 가능하게
                }}
              />

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => uploadRef.current?.click()}
                  className="text-sm"
                >
                  📥 선수 엑셀 업로드
                </Button>
                <Button variant="excel" onClick={downloadPlayerTemplate} className="text-sm">
                  🧾 템플릿 저장
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-500 mb-1">이름</label>
                <input
                  type="text"
                  value={inputs.name}
                  onChange={(e) => setInputs({ ...inputs, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="이름 입력"
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                />
              </div>

              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-gray-500 mb-1">성별/급수/목표경기/커스텀점수(선택)</label>
                <div className="flex gap-2">
                  <select
                    value={inputs.gender}
                    onChange={(e) => setInputs({ ...inputs, gender: e.target.value })}
                    className="w-1/4 p-2.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>

                  <select
                    value={inputs.grade}
                    onChange={(e) => setInputs({ ...inputs, grade: e.target.value })}
                    className="w-1/4 p-2.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={inputs.maxGames}
                    onChange={(e) => setInputs({ ...inputs, maxGames: e.target.value })}
                    className="w-1/4 p-2.5 bg-gray-50 border border-gray-200 rounded-lg"
                  />

                  <input
                    type="number"
                    value={inputs.customScore}
                    onChange={(e) => setInputs({ ...inputs, customScore: e.target.value })}
                    className="w-1/4 p-2.5 bg-gray-50 border border-gray-200 rounded-lg"
                    placeholder="예: 3.2"
                    step="0.1"
                  />
                </div>

                <div className="text-[11px] text-slate-500 mt-1">
                  ✏️ 커스텀점수 비우면 기본점수 적용 → 남 {MALE_POINTS[inputs.grade]} / 여 {FEMALE_POINTS[inputs.grade]}
                </div>
              </div>

              <div className="md:col-span-2">
                <Button onClick={addPlayer} variant="success" className="w-full h-[42px]">
                  추가
                </Button>
              </div>

              <div className="md:col-span-2">
                <Button onClick={generateSchedule} className="w-full h-[42px]">
                  🚀 생성
                </Button>
              </div>
            </div>
          </Card>

          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-sm text-gray-500 flex justify-between items-center">
              <span>
                총 {players.length}명 (남 {handleStat("남")}, 여 {handleStat("여")})
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                ✅ 이름 수정 / ✅ 변경 시 대진표 자동 반영(재생성 없이)
              </span>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-white sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-6 py-3">이름(수정가능)</th>
                    <th className="px-6 py-3">성별</th>
                    <th className="px-6 py-3">급수</th>
                    <th className="px-6 py-3">기본점수</th>
                    <th className="px-6 py-3">커스텀점수</th>
                    <th className="px-6 py-3">적용점수</th>
                    <th className="px-6 py-3">목표경기</th>
                    <th className="px-6 py-3 text-right">삭제</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {playersWithLiveScore.map((p) => {
                    const base = getBaseScore(p.grade, p.gender);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        {/* ✅ 이름 수정 input */}
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            className="w-32 md:w-44 p-1.5 bg-gray-50 border border-gray-200 rounded-lg font-bold"
                            value={p.name}
                            onChange={(e) => updatePlayerField(p.id, { name: e.target.value })}
                            onBlur={(e) => {
                              const trimmed = e.target.value.trim();
                              if (!trimmed) return updatePlayerField(p.id, { name: p.name });

                              const duplicated = players.some((x) => x.id !== p.id && x.name.trim() === trimmed);
                              if (duplicated) {
                                alert("같은 이름이 이미 있습니다. 다른 이름으로 변경해주세요.");
                                return updatePlayerField(p.id, { name: p.name });
                              }
                              updatePlayerField(p.id, { name: trimmed });
                            }}
                          />
                        </td>

                        <td className="px-6 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              p.gender === "남" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                            }`}
                          >
                            {p.gender}
                          </span>
                        </td>

                        <td className="px-6 py-3">{p.grade}</td>

                        <td className="px-6 py-3 text-gray-500">{base}</td>

                        <td className="px-6 py-3">
                          <input
                            type="number"
                            step="0.1"
                            className="w-24 p-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                            placeholder="(비움)"
                            value={p.customScore ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") return updatePlayerField(p.id, { customScore: null });
                              const num = Number(v);
                              if (!Number.isFinite(num)) return;
                              updatePlayerField(p.id, { customScore: num });
                            }}
                          />
                          <button
                            className="ml-2 text-xs text-slate-500 hover:text-red-600"
                            onClick={() => updatePlayerField(p.id, { customScore: null })}
                            title="커스텀점수 해제"
                          >
                            ✖
                          </button>
                        </td>

                        <td className="px-6 py-3 font-semibold text-slate-700">{p.liveScore}</td>

                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="20"
                              className="w-20 p-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                              value={p.maxGames}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isFinite(v)) return;
                                updatePlayerField(p.id, { maxGames: clampInt(v, 1, 20) });
                              }}
                            />
                            <span className="text-xs text-slate-500">경기</span>
                          </div>
                        </td>

                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t bg-white flex justify-center gap-2">
              <Button onClick={generateSchedule} className="px-10 py-4 text-lg shadow-xl">
                🏸 대진표 생성
              </Button>
              <Button onClick={() => setActiveTab("schedule")} variant="secondary" className="px-6 py-4 text-lg">
                🏆 결과 보기
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-6">
          {schedule.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-xl text-gray-400">생성된 대진표가 없습니다.</p>
              <Button onClick={() => setActiveTab("players")} variant="secondary" className="mt-4">
                선수 탭으로 이동
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
                <h3 className="font-bold text-indigo-900 text-lg">
                  매칭 결과 <span className="text-indigo-600">({schedule.length} 라운드)</span>
                </h3>
                <div className="flex gap-2">
                  <Button onClick={generateSchedule} variant="primary" className="text-sm">
                    🔄 재생성
                  </Button>
                  <Button onClick={downloadExcel} variant="excel" className="text-sm">
                    📊 엑셀 저장
                  </Button>
                  <Button onClick={downloadScheduleImage} variant="secondary" className="text-sm">
                    🖼️ 이미지 저장
                  </Button>
                </div>
              </div>

              {/* ✅ 이 영역이 이미지로 저장됩니다 */}
              <div ref={scheduleRef} className="grid gap-6">
                {schedule.map((round) => (
                  <div key={round.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
                      <span className="font-bold">ROUND {round.id}</span>
                      <span className="text-xs bg-slate-700 px-2 py-1 rounded">{round.matches.length} matches</span>
                    </div>

                    <div className="p-4 grid gap-4 md:grid-cols-2">
                      {round.matches.map((match, idx) => (
                        <div key={idx} className="relative bg-slate-50 rounded-lg border border-gray-200 p-3">
                          <div className="absolute top-0 left-0 bg-slate-600 text-white text-[10px] px-2 py-0.5 rounded-br rounded-tl font-bold">
                            {match.courtId}코트
                          </div>

                          <div className="flex items-center justify-between mt-3 gap-2">
                            <div
                              className={`flex-1 p-2 rounded border-l-4 ${
                                match.scoreA < match.scoreB ? "bg-orange-50 border-orange-400" : "bg-white border-blue-500"
                              }`}
                            >
                              {match.teamA.map((p) => (
                                <div key={p.id} className="text-center mb-1">
                                  <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {p.gender}/{p.grade}({Number(p.score).toFixed(1)})
                                  </div>
                                </div>
                              ))}
                              <div className="text-center text-xs font-bold text-gray-400 mt-1 border-t pt-1">
                                {Number(match.scoreA).toFixed(1)}
                              </div>
                            </div>

                            <div className="flex flex-col items-center">
                              <span className="font-black text-gray-300 italic text-sm">VS</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  Number(match.diff) === 0 ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"
                                }`}
                              >
                                {Number(match.diff) === 0 ? "Perfect" : `${Number(match.diff).toFixed(1)}차`}
                              </span>
                            </div>

                            <div
                              className={`flex-1 p-2 rounded border-r-4 ${
                                match.scoreB < match.scoreA ? "bg-orange-50 border-orange-400" : "bg-white border-red-500"
                              }`}
                            >
                              {match.teamB.map((p) => (
                                <div key={p.id} className="text-center mb-1">
                                  <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {p.gender}/{p.grade}({Number(p.score).toFixed(1)})
                                  </div>
                                </div>
                              ))}
                              <div className="text-center text-xs font-bold text-gray-400 mt-1 border-t pt-1">
                                {Number(match.scoreB).toFixed(1)}
                              </div>
                            </div>
                          </div>
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
  );
}