import React from "react";
import ScoreInput from "./ScoreInput";

const styles = {
  matchCard: {
    border: "1px solid #dbeafe",
    borderRadius: 24,
    overflow: "hidden",
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(30,41,59,0.07)",
  },

  matchHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fbff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  courtBadge: {
    padding: "7px 14px",
    borderRadius: 999,
    background: "#111827",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    lineHeight: 1,
  },

  typeBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
    background: "#ffffff",
  },

  matchBody: {
    padding: 14,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 12,
    alignItems: "center",
  },

  teamCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "16px 12px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    textAlign: "center",
    minHeight: 108,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  teamMain: {
    fontSize: 21,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.35,
    wordBreak: "keep-all",
    whiteSpace: "pre-line",
  },

  teamSub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.45,
    wordBreak: "keep-all",
    whiteSpace: "pre-line",
  },

  vsWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  vsCircle: {
    width: 70,
    height: 70,
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 30% 30%, #334155 0%, #111827 68%, #020617 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 20,
    letterSpacing: "0.06em",
    boxShadow: "0 12px 24px rgba(2,6,23,0.24)",
  },

  matchFooter: {
    padding: "12px 14px",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  footerMeta: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
  },
};

function getTeamMembers(team) {
  if (!team) return [];
  if (Array.isArray(team)) return team;
  if (Array.isArray(team.players)) return team.players;
  if (Array.isArray(team.members)) return team.members;
  if (Array.isArray(team.team)) return team.team;
  return [];
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || "";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function splitNames(value) {
  return String(value || "")
    .split(/[\/,\-|]+/)
    .map((name) => normalizeText(name))
    .filter(Boolean);
}

function isDuplicateTeamLabel(main, sub) {
  const normalizedMain = normalizeText(main);
  const normalizedSub = normalizeText(sub);
  if (!normalizedSub) return true;
  if (normalizedMain === normalizedSub) return true;

  const mainNames = splitNames(main).sort();
  const subNames = splitNames(sub).sort();
  if (mainNames.length === 0 || mainNames.length !== subNames.length) return false;

  return mainNames.every((name, index) => name === subNames[index]);
}

function normalizeTeamDisplay(team, fallbackLabel) {
  if (!team) return { main: fallbackLabel, sub: "" };

  if (typeof team === "string") {
    return { main: team, sub: "" };
  }

  const members = getTeamMembers(team).map(getPlayerName).filter(Boolean);
  const teamName = team.name || team.teamName || team.label || team.title || "";

  if (members.length === 1) {
    const sub = teamName && !isDuplicateTeamLabel(members[0], teamName) ? teamName : "";
    return {
      main: members[0],
      sub,
    };
  }

  if (members.length >= 2) {
    const main = members.slice(0, 2).join(" / ");
    const subCandidate = members.slice(2).join(" / ") || teamName || "";
    return {
      main,
      sub: isDuplicateTeamLabel(main, subCandidate) ? "" : subCandidate,
    };
  }

  if (teamName) {
    return { main: teamName, sub: "" };
  }

  return { main: fallbackLabel, sub: "" };
}

function getCourtLabel(match, index) {
  const raw =
    match?.courtLabel ??
    match?.courtName ??
    match?.court ??
    match?.courtId ??
    match?.courtNumber ??
    match?.courtNo;

  if (raw === undefined || raw === null || raw === "") {
    return `코트 ${index + 1}`;
  }

  if (typeof raw === "number") {
    return `코트 ${raw}`;
  }

  const text = String(raw).trim();
  if (text.includes("코트")) return text;
  return `코트 ${text}`;
}

function getMatchType(match, modeLabel) {
  return (
    match?.gameType ||
    match?.pairType ||
    match?.matchType ||
    match?.matchLabel ||
    match?.type ||
    match?.category ||
    modeLabel ||
    "경기"
  );
}

function getScoreText(match) {
  if (match?.scoreText) return String(match.scoreText);

  if (
    typeof match?.teamAScore !== "undefined" &&
    typeof match?.teamBScore !== "undefined" &&
    match?.teamAScore !== null &&
    match?.teamBScore !== null &&
    match?.teamAScore !== "" &&
    match?.teamBScore !== ""
  ) {
    return `${match.teamAScore} : ${match.teamBScore}`;
  }

  if (typeof match?.scoreA !== "undefined" && typeof match?.scoreB !== "undefined") {
    if (
      match.scoreA === null ||
      match.scoreB === null ||
      match.scoreA === "" ||
      match.scoreB === ""
    ) {
      return "점수 입력";
    }
    return `${match.scoreA} : ${match.scoreB}`;
  }

  if (
    typeof match?.leftScore !== "undefined" &&
    typeof match?.rightScore !== "undefined" &&
    match?.leftScore !== null &&
    match?.rightScore !== null &&
    match?.leftScore !== "" &&
    match?.rightScore !== ""
  ) {
    return `${match.leftScore} : ${match.rightScore}`;
  }

  if (typeof match?.score !== "undefined" && match.score !== null && match.score !== "") {
    return String(match.score);
  }

  return "점수 입력";
}

export default function MatchCard({
  match,
  matchIndex = 0,
  modeLabel = "",
  onChangeScoreA,
  onChangeScoreB,
  onSaveScore,
  onResetScore,
}) {
  const teamA = normalizeTeamDisplay(
    match?.teamA || match?.leftTeam || match?.homeTeam || match?.team1,
    "TEAM A"
  );

  const teamB = normalizeTeamDisplay(
    match?.teamB || match?.rightTeam || match?.awayTeam || match?.team2,
    "TEAM B"
  );

  const courtLabel = getCourtLabel(match, matchIndex);
  const matchType = getMatchType(match, modeLabel);
  const scoreText = getScoreText(match);

  return (
    <article style={styles.matchCard}>
      <div style={styles.matchHeader}>
        <div style={styles.courtBadge}>{courtLabel}</div>
        <div style={styles.typeBadge}>{matchType}</div>
      </div>

      <div style={styles.matchBody} className="app-match-body">
        <div style={styles.teamCard}>
          <div style={styles.teamMain}>{teamA.main || "TEAM A"}</div>
          {teamA.sub ? <div style={styles.teamSub}>{teamA.sub}</div> : null}
        </div>

        <div style={styles.vsWrap}>
          <div style={styles.vsCircle} className="app-vs-circle">
            VS
          </div>
        </div>

        <div style={styles.teamCard}>
          <div style={styles.teamMain}>{teamB.main || "TEAM B"}</div>
          {teamB.sub ? <div style={styles.teamSub}>{teamB.sub}</div> : null}
        </div>
      </div>

      <div style={styles.matchFooter}>
        <ScoreInput
          scoreText={scoreText}
          scoreAInput={match?.scoreAInput ?? ""}
          scoreBInput={match?.scoreBInput ?? ""}
          onChangeScoreA={onChangeScoreA}
          onChangeScoreB={onChangeScoreB}
          onSave={onSaveScore}
          onReset={onResetScore}
        />
        <div style={styles.footerMeta}>경기 {matchIndex + 1}</div>
      </div>
    </article>
  );
}
