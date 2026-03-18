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
    alignItems: "stretch",
  },

  teamCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "16px 12px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    minHeight: 132,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 10,
  },

  playerList: {
    display: "grid",
    gap: 10,
  },

  playerBlock: {
    display: "grid",
    gap: 2,
    textAlign: "center",
  },

  teamMain: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.3,
    wordBreak: "keep-all",
  },

  teamSub: {
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },

  teamFooter: {
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    color: "#64748b",
    letterSpacing: "-0.02em",
  },

  vsWrap: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    minWidth: 92,
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

  diffBadge: {
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    fontSize: 14,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
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
  if (Array.isArray(team.members)) return team.members;
  if (Array.isArray(team.players)) return team.players;
  if (Array.isArray(team.team)) return team.team;
  return [];
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || "";
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

function getGenderLabel(gender) {
  const raw = String(gender || "").trim().toUpperCase();
  if (raw === "M") return "남";
  if (raw === "F") return "여";
  return "-";
}

function toScoreNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatScore(value) {
  const num = toScoreNumber(value);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(1);
}

function getPlayerMeta(player) {
  if (!player || typeof player === "string") return "";

  const gender = getGenderLabel(player.gender);
  const grade = String(player.grade || "").trim();
  const score = toScoreNumber(player.baseScore);
  const parts = [];

  if (gender !== "-") parts.push(gender);
  if (grade) parts.push(grade);
  parts.push(`${formatScore(score)}점`);

  return parts.join(" / ");
}

function normalizeTeamDisplay(team, fallbackLabel) {
  const members = getTeamMembers(team);

  if (members.length > 0) {
    return {
      members: members.map((player) => ({
        name: getPlayerName(player) || fallbackLabel,
        meta: getPlayerMeta(player),
        score: toScoreNumber(player?.baseScore),
      })),
    };
  }

  if (typeof team === "string") {
    return {
      members: [{ name: team, meta: "", score: 0 }],
    };
  }

  const teamName = team?.name || team?.teamName || team?.label || team?.title || fallbackLabel;
  return {
    members: [{ name: teamName, meta: "", score: 0 }],
  };
}

function getTeamMatchScore(displayTeam) {
  return displayTeam.members.reduce((sum, member) => sum + toScoreNumber(member?.score), 0);
}

export default function MatchCard({
  match,
  matchIndex = 0,
  modeLabel = "",
  onChangeScoreA,
  onChangeScoreB,
  onResetScore,
  compact = false,
}) {
  const teamA = normalizeTeamDisplay(
    match?.teamA || match?.leftTeam || match?.homeTeam || match?.team1,
    "TEAM A"
  );
  const teamB = normalizeTeamDisplay(
    match?.teamB || match?.rightTeam || match?.awayTeam || match?.team2,
    "TEAM B"
  );

  const teamAScore = getTeamMatchScore(teamA);
  const teamBScore = getTeamMatchScore(teamB);
  const scoreDiff = Math.abs(teamAScore - teamBScore);

  const courtLabel = getCourtLabel(match, matchIndex);
  const matchType = getMatchType(match, modeLabel);
  const scoreText = getScoreText(match);

  return (
    <article
      style={{
        ...styles.matchCard,
        borderRadius: compact ? 16 : styles.matchCard.borderRadius,
      }}
    >
      <div
        style={{
          ...styles.matchHeader,
          padding: compact ? "5px 7px" : styles.matchHeader.padding,
        }}
      >
        <div
          style={{
            ...styles.courtBadge,
            padding: compact ? "3px 8px" : styles.courtBadge.padding,
            fontSize: compact ? 10 : styles.courtBadge.fontSize,
          }}
        >
          {courtLabel}
        </div>
        <div
          style={{
            ...styles.typeBadge,
            padding: compact ? "2px 7px" : styles.typeBadge.padding,
            fontSize: compact ? 9 : styles.typeBadge.fontSize,
          }}
        >
          {matchType}
        </div>
      </div>

      <div
        style={{
          ...styles.matchBody,
          padding: compact ? 5 : styles.matchBody.padding,
          gap: compact ? 5 : styles.matchBody.gap,
        }}
      >
        <div
          style={{
            ...styles.teamCard,
            borderRadius: compact ? 12 : styles.teamCard.borderRadius,
            padding: compact ? "6px 6px" : styles.teamCard.padding,
            minHeight: compact ? 58 : styles.teamCard.minHeight,
            gap: compact ? 3 : styles.teamCard.gap,
          }}
        >
          <div style={{ ...styles.playerList, gap: compact ? 2 : styles.playerList.gap }}>
            {teamA.members.map((member, memberIndex) => (
              <div key={`team-a-${memberIndex}`} style={styles.playerBlock}>
                <div
                  style={{
                    ...styles.teamMain,
                    fontSize: compact ? 12.5 : styles.teamMain.fontSize,
                    lineHeight: compact ? 1.02 : styles.teamMain.lineHeight,
                    color: compact ? "#1d4ed8" : styles.teamMain.color,
                    letterSpacing: compact ? "-0.03em" : "normal",
                  }}
                >
                  {member.name || "TEAM A"}
                </div>
                {member.meta ? (
                  <div
                    style={{
                      ...styles.teamSub,
                      fontSize: compact ? 7.5 : styles.teamSub.fontSize,
                      color: compact ? "#475569" : styles.teamSub.color,
                    }}
                  >
                    {member.meta}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div
            style={{
              ...styles.teamFooter,
              paddingTop: compact ? 3 : styles.teamFooter.paddingTop,
              fontSize: compact ? 12 : styles.teamFooter.fontSize,
            }}
          >
            {formatScore(teamAScore)}
          </div>
        </div>

        <div
          style={{
            ...styles.vsWrap,
            gap: compact ? 3 : styles.vsWrap.gap,
            minWidth: compact ? 46 : styles.vsWrap.minWidth,
          }}
        >
          <div
            style={{
              ...styles.vsCircle,
              width: compact ? 36 : styles.vsCircle.width,
              height: compact ? 36 : styles.vsCircle.height,
              fontSize: compact ? 12 : styles.vsCircle.fontSize,
            }}
            className="app-vs-circle"
          >
            VS
          </div>
          <div
            style={{
              ...styles.diffBadge,
              minHeight: compact ? 18 : styles.diffBadge.minHeight,
              padding: compact ? "0 5px" : styles.diffBadge.padding,
              fontSize: compact ? 9 : styles.diffBadge.fontSize,
            }}
          >
            {formatScore(scoreDiff)}점 차
          </div>
        </div>

        <div
          style={{
            ...styles.teamCard,
            borderRadius: compact ? 12 : styles.teamCard.borderRadius,
            padding: compact ? "6px 6px" : styles.teamCard.padding,
            minHeight: compact ? 58 : styles.teamCard.minHeight,
            gap: compact ? 3 : styles.teamCard.gap,
          }}
        >
          <div style={{ ...styles.playerList, gap: compact ? 2 : styles.playerList.gap }}>
            {teamB.members.map((member, memberIndex) => (
              <div key={`team-b-${memberIndex}`} style={styles.playerBlock}>
                <div
                  style={{
                    ...styles.teamMain,
                    fontSize: compact ? 12.5 : styles.teamMain.fontSize,
                    lineHeight: compact ? 1.02 : styles.teamMain.lineHeight,
                    color: compact ? "#1d4ed8" : styles.teamMain.color,
                    letterSpacing: compact ? "-0.03em" : "normal",
                  }}
                >
                  {member.name || "TEAM B"}
                </div>
                {member.meta ? (
                  <div
                    style={{
                      ...styles.teamSub,
                      fontSize: compact ? 7.5 : styles.teamSub.fontSize,
                      color: compact ? "#475569" : styles.teamSub.color,
                    }}
                  >
                    {member.meta}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div
            style={{
              ...styles.teamFooter,
              paddingTop: compact ? 3 : styles.teamFooter.paddingTop,
              fontSize: compact ? 12 : styles.teamFooter.fontSize,
            }}
          >
            {formatScore(teamBScore)}
          </div>
        </div>
      </div>

      <div
        style={{
          ...styles.matchFooter,
          padding: compact ? "5px 6px" : styles.matchFooter.padding,
          gap: compact ? 3 : styles.matchFooter.gap,
        }}
      >
        <ScoreInput
          scoreText={scoreText}
          scoreAInput={match?.scoreAInput ?? ""}
          scoreBInput={match?.scoreBInput ?? ""}
          onChangeScoreA={onChangeScoreA}
          onChangeScoreB={onChangeScoreB}
          onReset={onResetScore}
          compact={compact}
        />
        <div
          style={{
            ...styles.footerMeta,
            fontSize: compact ? 9 : styles.footerMeta.fontSize,
          }}
        >
          경기 {matchIndex + 1}
        </div>
      </div>
    </article>
  );
}
