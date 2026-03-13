import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대", "60대", "70대 이상"];
const GRADE_OPTIONS = ["A", "B", "C", "D", "E"];

const SCORE_BY_GRADE = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
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

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toLowerCase();
  if (["m", "male", "man", "남", "남자"].includes(raw)) return "M";
  if (["f", "female", "woman", "여", "여자"].includes(raw)) return "F";
  return "U";
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
    return `${index + 1}. ${names.join(", ")}${type ? ` (${type})` : ""}`;
  }
  return `${index + 1}.`;
}

function parseAgeFromAgeGroup(ageGroup) {
  const matched = String(ageGroup || "").match(/\d+/);
  if (!matched) return 30;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export default function PlayerManager({
  mode,
  modeLabel,
  players,
  setPlayers,
  nextId,
  onBack,
  onGenerate,
  activeTab,
  setActiveTab,
  targetMatchCount,
  setTargetMatchCount,
  courtCount,
  setCourtCount,
  leagueInfo,
  winningScore = 25,
}) {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    gender: "M",
    grade: "C",
    ageGroup: "40대",
  });

  const safePlayers = useMemo(() => players || [], [players]);
  const leagueTeams = useMemo(() => safeArray(leagueInfo?.teams), [leagueInfo]);

  const handleAddPlayer = () => {
    if (!form.name.trim()) return;

    const newPlayer = {
      id: nextId,
      name: form.name.trim(),
      gender: form.gender,
      grade: form.grade,
      ageGroup: form.ageGroup,
      age: parseAgeFromAgeGroup(form.ageGroup),
      baseScore: SCORE_BY_GRADE[form.grade] ?? 0,
    };

    setPlayers([...safePlayers, newPlayer]);

    setForm({
      name: "",
      gender: "M",
      grade: "C",
      ageGroup: "40대",
    });
  };

  const handleDeletePlayer = (id) => {
    setPlayers(safePlayers.filter((p) => p.id !== id));
  };

  const handleTemplateDownload = () => {
    const rows = [
      { Name: "Player A", Gender: "M", Grade: "C", AgeGroup: "40대" },
      { Name: "Player B", Gender: "F", Grade: "D", AgeGroup: "30대" },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "선수");
    XLSX.writeFile(wb, "선수등록템플릿.xlsx");
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const list = rows
      .map((row, i) => ({
        id: i + 1,
        name: String(row["이름"] || row.Name || "").trim(),
        gender: String(row["성별"] || row.Gender || "").trim() || "M",
        grade: String(row["급수"] || row.Grade || "").trim() || "C",
        ageGroup: String(row["연령대"] || row.AgeGroup || "").trim() || "40대",
        age:
          Number(row["나이"] || row.Age || 0) ||
          parseAgeFromAgeGroup(String(row["연령대"] || row.AgeGroup || "").trim() || "40대"),
        baseScore: SCORE_BY_GRADE[String(row["급수"] || row.Grade || "").trim()] ?? 0,
      }))
      .filter((player) => player.name);

    setPlayers(list);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const safeTargetMatchCount = Math.max(1, Number(targetMatchCount) || 1);
  const safeCourtCount = Math.max(1, Number(courtCount) || 1);

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
              <div style={styles.formRow1}>
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

              <div style={styles.formRow2}>
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
                  <label style={styles.label}>목표 경기</label>
                  <input
                    type="number"
                    min="1"
                    style={styles.input}
                    value={safeTargetMatchCount}
                    onChange={(e) =>
                      setTargetMatchCount(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
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
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>선수 목록 ({safePlayers.length})</h2>

              <div style={styles.listHeaderRight}>
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

                <span style={styles.miniLabel}>코트수</span>
                <input
                  style={styles.miniInput}
                  type="number"
                  min="1"
                  value={safeCourtCount}
                  onChange={(e) => setCourtCount(Math.max(1, Number(e.target.value) || 1))}
                />

                <button style={styles.resetButton} onClick={() => setPlayers([])}>
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

                  return (
                    <div key={team?.id || `team-${teamIndex}`} style={styles.teamCard}>
                      <div style={styles.teamCardHead}>
                        <div style={styles.teamName}>{team?.name || `팀 ${teamIndex + 1}`}</div>
                        <div style={styles.teamMeta}>
                          {team?.ageBand || ""} · {teamPlayers.length}명
                        </div>
                      </div>

                      {teamPairs.length > 0 ? (
                        <div style={styles.pairBlock}>
                          {teamPairs.map((pair, pairIndex) => (
                            <div
                              key={pair?.id || `${team?.id}-pair-${pairIndex}`}
                              style={styles.pairLine}
                            >
                              {getPairLabel(pair, pairIndex)}
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

                      {safeArray(team?.leftovers).length > 0 ? (
                        <div style={styles.reserveText}>
                          예비:{" "}
                          {safeArray(team?.leftovers)
                            .map(getPlayerName)
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
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
                <br />
                목표 경기: {safeTargetMatchCount}
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

                    return (
                      <div key={team?.id || `team-${teamIndex}`} style={styles.teamCard}>
                        <div style={styles.teamCardHead}>
                          <div style={styles.teamName}>{team?.name || `팀 ${teamIndex + 1}`}</div>
                          <div style={styles.teamMeta}>
                            {team?.ageBand || ""} · {teamPlayers.length}명
                          </div>
                        </div>

                        {teamPairs.length > 0 ? (
                          <div style={styles.pairBlock}>
                            {teamPairs.map((pair, pairIndex) => (
                              <div
                                key={pair?.id || `${team?.id}-pair-${pairIndex}`}
                                style={styles.pairLine}
                              >
                                {getPairLabel(pair, pairIndex)}
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

                        {safeArray(team?.leftovers).length > 0 ? (
                          <div style={styles.reserveText}>
                            예비:{" "}
                            {safeArray(team?.leftovers)
                              .map(getPlayerName)
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

