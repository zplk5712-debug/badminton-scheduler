import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

/**
 * 배드민턴 밸런스 매치 - 모바일 중심 UI
 * 포함 기능:
 * 1) 선수정보 로컬 저장(localStorage) - 삭제 전까지 유지
 * 2) 엑셀(xlsx)로 선수 명단 일괄 업로드
 * 3) 코트 수 변경 가능
 * 4) 개인 목표 게임 수 변경 가능
 * 5) 라운드별(ROUND) 카드형 대진표 표시
 * 6) (중요) 이름 가로쓰기 고정(세로 깨짐 방지)
 *
 * 스냅샷(html-to-image) 기능은 제거됨
 */

// ===================== 유틸 / 기본값 =====================
const STORAGE_KEY = "badminton_scheduler_players_v9";
const SETTINGS_KEY = "badminton_scheduler_settings_v9";

// 급수 -> 기본 점수 (원하면 여기만 조정)
const DEFAULT_SCORE_BY_GRADE = {
  A: 5.0,
  B: 4.0,
  C: 3.0,
  D: 2.0,
  E: 1.0,
};

// 여성은 한 단계 아래로 본다: 점수 보정(단계/점수 방식 둘 중 택)
// 여기서는 "점수 - 1.0" 보정(최소 1.0)
function effectiveScore(player) {
  const base =
    player.customScore !== "" && player.customScore != null
      ? Number(player.customScore)
      : Number(player.baseScore ?? DEFAULT_SCORE_BY_GRADE[player.grade] ?? 3);

  if (player.gender === "여") return Math.max(1.0, base - 1.0);
  return base;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatScore(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "";
  return x % 1 === 0 ? x.toFixed(0) : x.toFixed(1);
}

// ===================== 대진 생성(휴리스틱) =====================
/**
 * 제약(최대한 유지):
 * - 기본: 2대2 복식만 생성
 * - 남복 vs 남복 / 여복 vs 여복 / 혼복(남+여 vs 남+여) 허용
 * - 혼복을 각 선수의 3게임 중 1~2경기 들어가도록 "가급적" 유도
 * - 밸런스: 팀 점수 합(유효점수) 차이를 줄이도록
 * - 한 라운드에 한 선수는 1번만 출전(중복 방지)
 *
 * ⚠️ 네가 예전에 만들었던 “더 강한 제약/특수 규칙”이 더 있다면
 * 그 규칙은 이 함수에 추가하면 됨(구조는 이미 맞춰놨어).
 */

function makePairs(players, courts, preferMixed = true) {
  // 현재 라운드에 쓸 후보 (아직 게임 남은 사람)
  const candidates = players.filter((p) => p.played < p.targetGames);

  // 라운드에서 코트 수 * 4명 필요
  const need = courts * 4;
  if (candidates.length < 4) return { matches: [], usedIds: new Set() };

  // 라운드에 투입할 선수 뽑기:
  // - 남은게임 많은 사람 우선
  // - (preferMixed) 혼복 유도를 위해 남/여 균형도 고려
  const sorted = [...candidates].sort((a, b) => {
    const ra = (a.targetGames - a.played);
    const rb = (b.targetGames - b.played);
    if (rb !== ra) return rb - ra;
    return effectiveScore(b) - effectiveScore(a);
  });

  const picked = [];
  const used = new Set();

  // 성비 균형 잡기(혼복 유도)
  const males = sorted.filter((p) => p.gender === "남");
  const females = sorted.filter((p) => p.gender === "여");

  if (preferMixed && males.length >= 2 && females.length >= 2) {
    // 코트당 남2/여2가 이상적 → courts만큼 반복해서 채워보기
    const needCourts = Math.min(courts, Math.floor(males.length / 2), Math.floor(females.length / 2));
    for (let i = 0; i < needCourts; i++) {
      for (let k = 0; k < 2; k++) {
        const m = males.find((x) => !used.has(x.id));
        if (m) { picked.push(m); used.add(m.id); }
      }
      for (let k = 0; k < 2; k++) {
        const f = females.find((x) => !used.has(x.id));
        if (f) { picked.push(f); used.add(f.id); }
      }
    }
  }

  // 부족하면 남은 사람으로 채우기
  for (const p of sorted) {
    if (picked.length >= need) break;
    if (used.has(p.id)) continue;
    picked.push(p);
    used.add(p.id);
  }

  // 4명 단위로 매치 구성
  const groupCount = Math.floor(picked.length / 4);
  const groups = [];
  for (let i = 0; i < groupCount; i++) {
    groups.push(picked.slice(i * 4, i * 4 + 4));
  }

  // 그룹 내 팀 나누기(밸런스 최소화)
  const matches = groups.map((g) => {
    // 4명: a,b,c,d
    const [a, b, c, d] = g;
    const combos = [
      { t1: [a, b], t2: [c, d] },
      { t1: [a, c], t2: [b, d] },
      { t1: [a, d], t2: [b, c] },
    ];

    // 허용되는 매치인지 체크 (혼복/동성복)
    function isValidTeam(team) {
      const genders = team.map((x) => x.gender);
      const m = genders.filter((x) => x === "남").length;
      const f = genders.filter((x) => x === "여").length;
      // 2명 팀에서: 남2, 여2, 혼(1:1)만 허용
      return (m === 2 && f === 0) || (m === 0 && f === 2) || (m === 1 && f === 1);
    }
    function isValidMatch(t1, t2) {
      // 팀 자체가 유효해야 하고,
      // 남+여(혼팀) vs 남+여(혼팀) 허용,
      // 남복 vs 남복, 여복 vs 여복 허용,
      // 남복 vs 여복은 피하기(요청 조건)
      const t1m = t1.filter((x) => x.gender === "남").length;
      const t2m = t2.filter((x) => x.gender === "남").length;
      const t1type = t1m === 2 ? "남복" : t1m === 0 ? "여복" : "혼복";
      const t2type = t2m === 2 ? "남복" : t2m === 0 ? "여복" : "혼복";
      if (t1type === "남복" && t2type === "여복") return false;
      if (t1type === "여복" && t2type === "남복") return false;
      return true;
    }

    const valid = combos
      .filter((c) => isValidTeam(c.t1) && isValidTeam(c.t2) && isValidMatch(c.t1, c.t2))
      .map((c) => {
        const s1 = c.t1.reduce((sum, p) => sum + effectiveScore(p), 0);
        const s2 = c.t2.reduce((sum, p) => sum + effectiveScore(p), 0);
        return { ...c, s1, s2, diff: Math.abs(s1 - s2) };
      });

    // 혹시 유효 조합이 하나도 없으면(극단 케이스), 그냥 diff 최소로
    const pool = valid.length ? valid : combos.map((c) => {
      const s1 = c.t1.reduce((sum, p) => sum + effectiveScore(p), 0);
      const s2 = c.t2.reduce((sum, p) => sum + effectiveScore(p), 0);
      return { ...c, s1, s2, diff: Math.abs(s1 - s2) };
    });

    pool.sort((x, y) => x.diff - y.diff);
    return pool[0];
  });

  // 코트 수만큼 자르기
  const finalMatches = matches.slice(0, courts);

  const usedIds = new Set();
  finalMatches.forEach((m) => {
    m.t1.forEach((p) => usedIds.add(p.id));
    m.t2.forEach((p) => usedIds.add(p.id));
  });

  return { matches: finalMatches, usedIds };
}

function generateRounds(players, courts) {
  // 깊은 복사(played 업데이트용)
  const list = players.map((p) => ({ ...p, played: p.played ?? 0 }));

  const rounds = [];
  let guard = 0;

  // 혼복 목표(1~2경기)를 "가급적" 맞추기 위해
  // preferMixed를 초반 라운드에 더 강하게 적용
  while (guard < 2000) {
    guard++;

    const still = list.filter((p) => p.played < p.targetGames);
    if (still.length < 4) break;

    // 혼복 유도: 남/여가 충분할 때는 true
    const males = still.filter((p) => p.gender === "남").length;
    const females = still.filter((p) => p.gender === "여").length;
    const preferMixed = males >= 2 && females >= 2;

    const { matches, usedIds } = makePairs(list, courts, preferMixed);
    if (!matches.length) break;

    // 라운드 확정 -> played 증가
    usedIds.forEach((id) => {
      const p = list.find((x) => x.id === id);
      if (p) p.played += 1;
    });

    rounds.push({
      id: uid(),
      matches: matches.map((m, idx) => ({
        id: uid(),
        court: idx + 1,
        t1: m.t1.map((p) => p.id),
        t2: m.t2.map((p) => p.id),
        s1: m.s1,
        s2: m.s2,
        diff: m.diff,
      })),
    });

    // 안전장치: 라운드가 너무 많아지면 중단
    if (rounds.length > 80) break;
  }

  return { rounds, finalPlayers: list };
}

// ===================== 메인 컴포넌트 =====================
export default function App() {
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);

  const [courts, setCourts] = useState(4);

  // 신규 등록 폼
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("남");
  const [newGrade, setNewGrade] = useState("C");
  const [newTargetGames, setNewTargetGames] = useState(3);
  const [newCustomScore, setNewCustomScore] = useState("");

  // ===================== 로컬 저장/불러오기 =====================
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (raw) setPlayers(JSON.parse(raw));
      if (rawSettings) {
        const s = JSON.parse(rawSettings);
        if (s?.courts) setCourts(s.courts);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    } catch {}
  }, [players]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ courts }));
    } catch {}
  }, [courts]);

  // ===================== 계산 =====================
  const stats = useMemo(() => {
    const total = players.length;
    const male = players.filter((p) => p.gender === "남").length;
    const female = players.filter((p) => p.gender === "여").length;
    const remaining = players.reduce((sum, p) => sum + (p.targetGames - (p.played ?? 0)), 0);
    return { total, male, female, remaining };
  }, [players]);

  const playerById = useMemo(() => {
    const m = new Map();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  // ===================== 액션 =====================
  function addPlayer() {
    const name = newName.trim();
    if (!name) return;

    const base = DEFAULT_SCORE_BY_GRADE[newGrade] ?? 3;
    const p = {
      id: uid(),
      name,
      gender: newGender,
      grade: newGrade,
      baseScore: base,
      customScore: newCustomScore === "" ? "" : Number(newCustomScore),
      targetGames: clamp(Number(newTargetGames) || 3, 1, 10),
      played: 0,
    };
    setPlayers((prev) => [p, ...prev]);
    setNewName("");
    setNewCustomScore("");
  }

  function removePlayer(id) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function clearAllPlayers() {
    if (!confirm("선수 전체를 삭제할까요? (되돌릴 수 없음)")) return;
    setPlayers([]);
    setRounds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function resetPlayed() {
    setPlayers((prev) => prev.map((p) => ({ ...p, played: 0 })));
    setRounds([]);
  }

  function updatePlayer(id, patch) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function generate() {
    // played는 현재값 반영해서 생성
    const { rounds: r } = generateRounds(players, clamp(Number(courts) || 4, 1, 12));
    setRounds(r);

    // 생성 결과에 따라 played를 업데이트(라운드에 나온 횟수만큼)
    const playedCount = new Map();
    r.forEach((rd) => {
      rd.matches.forEach((m) => {
        [...m.t1, ...m.t2].forEach((pid) => {
          playedCount.set(pid, (playedCount.get(pid) || 0) + 1);
        });
      });
    });

    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        played: clamp((p.played ?? 0) + (playedCount.get(p.id) || 0), 0, 999),
      }))
    );
  }

  // ===================== 엑셀 업로드 =====================
  async function handleExcelUpload(file) {
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    /**
     * 기대 컬럼(대소문자/공백 조금은 허용):
     * - 이름 / name
     * - 성별 / gender  (남/여)
     * - 급수 / grade   (A~E)
     * - 목표경기 / targetGames
     * - 커스텀점수 / customScore (선택)
     */
    const norm = (s) => String(s).trim().toLowerCase();

    const mapped = rows
      .map((row) => {
        const keys = Object.keys(row);
        const pick = (aliases) => {
          const k = keys.find((kk) => aliases.includes(norm(kk)));
          return k ? row[k] : "";
        };

        const name = String(pick(["이름", "name"])).trim();
        if (!name) return null;

        const genderRaw = String(pick(["성별", "gender"])).trim();
        const gender = genderRaw === "여" ? "여" : "남";

        const gradeRaw = String(pick(["급수", "grade"])).trim().toUpperCase();
        const grade = ["A", "B", "C", "D", "E"].includes(gradeRaw) ? gradeRaw : "C";

        const tgRaw = pick(["목표경기", "targetgames", "target_games"]);
        const targetGames = clamp(Number(tgRaw) || 3, 1, 10);

        const csRaw = pick(["커스텀점수", "customscore", "custom_score"]);
        const customScore = csRaw === "" ? "" : Number(csRaw);

        const baseScore = DEFAULT_SCORE_BY_GRADE[grade] ?? 3;

        return {
          id: uid(),
          name,
          gender,
          grade,
          baseScore,
          customScore: Number.isFinite(customScore) ? customScore : "",
          targetGames,
          played: 0,
        };
      })
      .filter(Boolean);

    if (!mapped.length) {
      alert("엑셀에서 선수 데이터를 못 찾았어. 컬럼명이 맞는지 확인해줘!");
      return;
    }

    // 기존 리스트에 합치기(이름 중복은 그대로 허용)
    setPlayers((prev) => [...mapped, ...prev]);
  }

  // ===================== UI =====================
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <div style={styles.badge}>🏸</div>
          <div>
            <div style={styles.title}>배드민턴 밸런스 매치 v9</div>
            <div style={styles.sub}>
              코트 {courts}개 · 선수 {stats.total}명(남 {stats.male}, 여 {stats.female})
            </div>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <label style={styles.label}>
            코트 수
            <input
              type="number"
              value={courts}
              onChange={(e) => setCourts(clamp(Number(e.target.value) || 4, 1, 12))}
              style={styles.inputSmall}
              min={1}
              max={12}
            />
          </label>

          <button style={styles.btnPrimary} onClick={generate}>
            🎯 대진표 생성
          </button>
          <button style={styles.btnGhost} onClick={resetPlayed}>
            ↺ 출전횟수 초기화
          </button>
          <button style={styles.btnDanger} onClick={clearAllPlayers}>
            🗑️ 전체삭제
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* 선수 관리 */}
        <section style={styles.card}>
          <div style={styles.cardTitle}>👥 선수 등록 / 관리</div>

          <div style={styles.excelRow}>
            <label style={styles.fileBtn}>
              📄 엑셀 업로드
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => handleExcelUpload(e.target.files?.[0])}
              />
            </label>

            <div style={styles.hint}>
              컬럼 예: <b>이름, 성별(남/여), 급수(A~E), 목표경기</b> (커스텀점수 선택)
            </div>
          </div>

          <div style={styles.formRow}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름"
              style={styles.input}
            />
            <select value={newGender} onChange={(e) => setNewGender(e.target.value)} style={styles.select}>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
            <select value={newGrade} onChange={(e) => setNewGrade(e.target.value)} style={styles.select}>
              {["A", "B", "C", "D", "E"].map((g) => (
                <option key={g} value={g}>
                  {g}급
                </option>
              ))}
            </select>

            <input
              type="number"
              value={newTargetGames}
              onChange={(e) => setNewTargetGames(clamp(Number(e.target.value) || 3, 1, 10))}
              style={styles.inputSmall}
              min={1}
              max={10}
              title="개인 목표 게임 수"
            />

            <input
              value={newCustomScore}
              onChange={(e) => setNewCustomScore(e.target.value)}
              placeholder="커스텀점수(선택)"
              style={styles.inputSmallWide}
            />

            <button style={styles.btnPrimary} onClick={addPlayer}>
              ➕ 추가
            </button>
          </div>

          <div style={styles.tableHead}>
            <div style={{ ...styles.th, flex: 2 }}>이름(가로고정)</div>
            <div style={{ ...styles.th, flex: 1 }}>성별</div>
            <div style={{ ...styles.th, flex: 1 }}>급수</div>
            <div style={{ ...styles.th, flex: 1 }}>커스텀</div>
            <div style={{ ...styles.th, flex: 1 }}>적용점수</div>
            <div style={{ ...styles.th, flex: 1 }}>목표</div>
            <div style={{ ...styles.th, flex: 1 }}>출전</div>
            <div style={{ ...styles.th, width: 60, textAlign: "right" }}>삭제</div>
          </div>

          <div style={styles.list}>
            {players.map((p) => {
              const eff = effectiveScore(p);
              return (
                <div key={p.id} style={styles.row}>
                  {/* ✅ 이름 가로쓰기 고정(세로 깨짐 방지) */}
                  <input
                    value={p.name}
                    onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                    style={{ ...styles.nameInput, ...styles.noWrapText }}
                  />

                  <select
                    value={p.gender}
                    onChange={(e) => updatePlayer(p.id, { gender: e.target.value })}
                    style={styles.select}
                  >
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>

                  <select
                    value={p.grade}
                    onChange={(e) => updatePlayer(p.id, { grade: e.target.value, baseScore: DEFAULT_SCORE_BY_GRADE[e.target.value] })}
                    style={styles.select}
                  >
                    {["A", "B", "C", "D", "E"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>

                  <input
                    value={p.customScore ?? ""}
                    onChange={(e) => updatePlayer(p.id, { customScore: e.target.value === "" ? "" : Number(e.target.value) })}
                    style={styles.inputSmallWide}
                    placeholder="(비움)"
                  />

                  <div style={styles.pill}>{formatScore(eff)}</div>

                  <input
                    type="number"
                    value={p.targetGames}
                    onChange={(e) => updatePlayer(p.id, { targetGames: clamp(Number(e.target.value) || 3, 1, 10) })}
                    style={styles.inputSmall}
                    min={1}
                    max={10}
                  />

                  <div style={styles.pillDim}>{p.played ?? 0}</div>

                  <button style={styles.iconBtn} onClick={() => removePlayer(p.id)} title="삭제">
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* 대진표 */}
        <section style={styles.card}>
          <div style={styles.cardTitle}>🏆 대진표 (라운드별)</div>

          {!rounds.length ? (
            <div style={styles.empty}>
              아직 생성된 대진표가 없어. <b>“대진표 생성”</b>을 눌러봐!
            </div>
          ) : (
            <div style={styles.rounds}>
              {rounds.map((rd, rIdx) => (
                <div key={rd.id} style={styles.roundBlock}>
                  <div style={styles.roundTitle}>ROUND {rIdx + 1}</div>

                  <div style={styles.matchGrid}>
                    {rd.matches.map((m) => {
                      const t1 = m.t1.map((id) => playerById.get(id)).filter(Boolean);
                      const t2 = m.t2.map((id) => playerById.get(id)).filter(Boolean);

                      const t1Type = teamType(t1);
                      const t2Type = teamType(t2);
                      const label = `${t1Type} vs ${t2Type}`;

                      return (
                        <div key={m.id} style={styles.matchCard}>
                          <div style={styles.matchTop}>
                            <div style={styles.courtBadge}>{m.court}코트</div>
                            <div style={styles.matchTag}>{label}</div>
                            <div style={styles.diffPill}>Δ {formatScore(m.diff)}</div>
                          </div>

                          <div style={styles.teams}>
                            <TeamBox title="TEAM A" players={t1} sum={m.s1} />
                            <div style={styles.vs}>VS</div>
                            <TeamBox title="TEAM B" players={t2} sum={m.s2} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer style={styles.footer}>
        <div style={styles.footerText}>
          ✅ 선수정보는 <b>삭제하기 전까지 자동 저장</b>돼. (브라우저 localStorage)
          <br />
          ✅ 이름이 세로로 깨지면: 이 버전은 <b>이름 가로쓰기(줄바꿈 금지)</b>를 강제 적용했어.
        </div>
      </footer>
    </div>
  );
}

// ===================== 서브 컴포넌트 =====================
function teamType(team) {
  const m = team.filter((p) => p.gender === "남").length;
  const f = team.length - m;
  if (m === 2) return "남복";
  if (f === 2) return "여복";
  return "혼복";
}

function TeamBox({ title, players, sum }) {
  return (
    <div style={styles.teamBox}>
      <div style={styles.teamTitle}>{title}</div>

      <div style={styles.teamList}>
        {players.map((p) => (
          <div key={p.id} style={styles.playerLine}>
            {/* ✅ 이름 가로쓰기 고정 */}
            <span style={{ ...styles.playerName, ...styles.noWrapText }}>
              {p.name}
            </span>

            <span style={styles.playerMeta}>
              {p.gender}/{p.grade}({formatScore(effectiveScore(p))})
            </span>
          </div>
        ))}
      </div>

      <div style={styles.teamSum}>합 {formatScore(sum)}</div>
    </div>
  );
}

// ===================== 스타일 =====================
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(60,220,160,0.18), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(110,80,255,0.15), transparent 55%), #0b1220",
    color: "#eaf1ff",
    padding: "16px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Apple SD Gothic Neo, Noto Sans KR, sans-serif",
  },

  header: {
    maxWidth: 1200,
    margin: "0 auto 14px auto",
    padding: "14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    backdropFilter: "blur(10px)",
  },
  titleRow: { display: "flex", gap: 12, alignItems: "center" },
  badge: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "rgba(60,220,160,0.12)",
    border: "1px solid rgba(60,220,160,0.22)",
    fontSize: 20,
  },
  title: { fontSize: 26, fontWeight: 900, letterSpacing: -0.5 },
  sub: { fontSize: 13, opacity: 0.8, marginTop: 3 },

  settingsRow: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  label: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 },

  grid: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  card: {
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    backdropFilter: "blur(10px)",
    padding: 14,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 10, opacity: 0.95 },

  excelRow: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 },
  fileBtn: {
    cursor: "pointer",
    userSelect: "none",
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(80,140,255,0.14)",
    border: "1px solid rgba(80,140,255,0.26)",
    fontWeight: 800,
    fontSize: 13,
  },
  hint: { fontSize: 12, opacity: 0.75, lineHeight: 1.35 },

  formRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 },

  input: {
    flex: 1,
    minWidth: 150,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    color: "#eaf1ff",
    outline: "none",
  },
  inputSmall: {
    width: 82,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    color: "#eaf1ff",
    outline: "none",
  },
  inputSmallWide: {
    width: 140,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    color: "#eaf1ff",
    outline: "none",
  },
  select: {
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    color: "#eaf1ff",
    outline: "none",
  },

  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(60,220,160,0.35)",
    background: "rgba(60,220,160,0.16)",
    color: "#eaf1ff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf1ff",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,110,0.35)",
    background: "rgba(255,90,110,0.12)",
    color: "#eaf1ff",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableHead: {
    display: "flex",
    gap: 8,
    padding: "8px 8px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 8,
  },
  th: { flex: 1 },

  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "8px 8px",
    borderRadius: 14,
    background: "rgba(0,0,0,0.16)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  // ✅ 이름 가로쓰기 핵심 스타일(줄바꿈 금지)
  noWrapText: {
    whiteSpace: "nowrap",
    wordBreak: "keep-all",
    overflow: "hidden",
    textOverflow: "ellipsis",
    writingMode: "horizontal-tb",
    textOrientation: "mixed",
  },

  nameInput: {
    flex: 2,
    minWidth: 140,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    color: "#eaf1ff",
    outline: "none",
  },

  pill: {
    width: 74,
    textAlign: "center",
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(110,80,255,0.14)",
    border: "1px solid rgba(110,80,255,0.25)",
    fontWeight: 900,
    fontSize: 13,
  },
  pillDim: {
    width: 74,
    textAlign: "center",
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontWeight: 900,
    fontSize: 13,
    opacity: 0.9,
  },
  iconBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf1ff",
    cursor: "pointer",
    fontWeight: 900,
  },

  empty: { padding: 14, opacity: 0.75, lineHeight: 1.45 },

  rounds: { display: "flex", flexDirection: "column", gap: 14 },
  roundBlock: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  roundTitle: { fontSize: 14, fontWeight: 900, letterSpacing: 1, opacity: 0.85, marginBottom: 10 },

  matchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, 1fr)",
    gap: 10,
  },

  matchCard: {
    borderRadius: 18,
    padding: 12,
    background: "linear-gradient(180deg, rgba(9,16,33,0.85), rgba(10,14,24,0.75))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  },
  matchTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  courtBadge: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(60,220,160,0.12)",
    border: "1px solid rgba(60,220,160,0.26)",
    fontWeight: 900,
    fontSize: 12,
  },
  matchTag: { fontSize: 12, opacity: 0.8, flex: 1 },
  diffPill: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(110,80,255,0.14)",
    border: "1px solid rgba(110,80,255,0.25)",
    fontWeight: 900,
    fontSize: 12,
  },

  teams: { display: "grid", gridTemplateColumns: "1fr 60px 1fr", alignItems: "stretch", gap: 10 },
  vs: {
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    letterSpacing: 2,
    opacity: 0.55,
  },

  teamBox: {
    borderRadius: 16,
    padding: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },
  teamTitle: { fontSize: 12, fontWeight: 900, opacity: 0.8 },
  teamList: { display: "flex", flexDirection: "column", gap: 6 },
  playerLine: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
  },

  // ✅ 이름 가로쓰기 + 줄바꿈 금지 + 너무 길면 ... 처리
  playerName: {
    fontSize: 16,
    fontWeight: 950,
    flex: 1,
    minWidth: 0,
  },
  playerMeta: { fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" },

  teamSum: { marginTop: 6, fontSize: 12, opacity: 0.8, fontWeight: 900, textAlign: "right" },

  footer: { maxWidth: 1200, margin: "14px auto 0 auto", opacity: 0.85 },
  footerText: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    lineHeight: 1.5,
    fontSize: 12,
  },
};

// 반응형: 폭 넓으면 코트 카드 2열
if (typeof window !== "undefined") {
  const mq = window.matchMedia("(min-width: 860px)");
  const apply = () => {
    styles.grid.gridTemplateColumns = mq.matches ? "1fr 1.2fr" : "1fr";
    styles.matchGrid.gridTemplateColumns = mq.matches ? "repeat(2, 1fr)" : "repeat(1, 1fr)";
  };
  apply();
  mq.addEventListener?.("change", apply);
}