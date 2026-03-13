import React from "react";

const styles = {
  standingsWrap: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    borderRadius: 22,
    overflow: "hidden",
    background: "#ffffff",
  },

  standingsHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    background:
      "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(14,165,233,0.05) 100%)",
  },

  standingsTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  },

  standingsBody: {
    padding: 16,
  },

  standingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  standingsCard: {
    border: "1px solid #dcfce7",
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(240,253,244,0.98) 100%)",
    padding: 14,
  },

  standingsRank: {
    fontSize: 12,
    fontWeight: 900,
    color: "#16a34a",
    marginBottom: 8,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  standingsName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 10,
  },

  standingsMetaWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  standingsMeta: {
    minHeight: 30,
    padding: "0 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #bbf7d0",
    color: "#166534",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 800,
  },

  summaryText: {
    marginTop: 14,
    fontSize: 13,
    color: "#475569",
    fontWeight: 700,
    lineHeight: 1.6,
  },
};

export default function StandingsBoard({
  standings = [],
  summary = null,
  title = "정기전 순위 요약",
}) {
  if (!Array.isArray(standings) || standings.length === 0) {
    return null;
  }

  return (
    <div style={styles.standingsWrap}>
      <div style={styles.standingsHeader}>
        <h3 style={styles.standingsTitle}>{title}</h3>
      </div>

      <div style={styles.standingsBody}>
        <div style={styles.standingsGrid}>
          {standings.map((item, index) => {
            const teamName =
              item?.teamName || item?.name || item?.team || item?.label || `팀 ${index + 1}`;

            const win = item?.win ?? item?.wins ?? item?.victory ?? item?.victories;
            const lose = item?.lose ?? item?.loss ?? item?.losses;
            const draw = item?.draw ?? item?.draws;
            const point = item?.point ?? item?.points ?? item?.score ?? item?.leaguePoint;
            const diff = item?.pointDiff ?? item?.scoreDiff ?? item?.goalDiff ?? item?.diff;

            return (
              <article key={item?.id || `${teamName}-${index}`} style={styles.standingsCard}>
                <div style={styles.standingsRank}>Rank #{item?.rank || index + 1}</div>
                <div style={styles.standingsName}>{teamName}</div>

                <div style={styles.standingsMetaWrap}>
                  {typeof win !== "undefined" ? (
                    <div style={styles.standingsMeta}>승 {win}</div>
                  ) : null}
                  {typeof lose !== "undefined" ? (
                    <div style={styles.standingsMeta}>패 {lose}</div>
                  ) : null}
                  {typeof draw !== "undefined" ? (
                    <div style={styles.standingsMeta}>무 {draw}</div>
                  ) : null}
                  {typeof point !== "undefined" ? (
                    <div style={styles.standingsMeta}>득점 {point}</div>
                  ) : null}
                  {typeof diff !== "undefined" ? (
                    <div style={styles.standingsMeta}>득실 {diff}</div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {summary ? (
          <div style={styles.summaryText}>
            {typeof summary === "string" ? summary : JSON.stringify(summary)}
          </div>
        ) : null}
      </div>
    </div>
  );
}