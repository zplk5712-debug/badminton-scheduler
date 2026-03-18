import React, { useEffect, useState } from "react";
import MatchCard from "./MatchCard";

const styles = {
  emptyCard: {
    padding: "54px 24px",
    borderRadius: 24,
    border: "1px dashed #cbd5e1",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    textAlign: "center",
  },

  emptyTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
  },

  emptyText: {
    margin: "12px auto 0",
    maxWidth: 520,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#64748b",
    fontWeight: 600,
  },

  roundsList: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  courtList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 18,
  },

  roundSection: {
    border: "1px solid #dbeafe",
    borderRadius: 24,
    overflow: "hidden",
    background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
    boxShadow: "0 10px 24px rgba(30,41,59,0.04)",
  },

  courtSection: {
    border: "1px solid #dbeafe",
    borderRadius: 24,
    overflow: "hidden",
    background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
    boxShadow: "0 10px 24px rgba(30,41,59,0.04)",
  },

  roundHeader: {
    padding: "16px 18px",
    background: "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  courtHeader: {
    padding: "16px 18px",
    background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  courtHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  roundTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  courtTitleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  roundTitle: {
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },

  courtTitle: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },

  roundMeta: {
    fontSize: 14,
    fontWeight: 700,
    opacity: 0.96,
  },

  courtMeta: {
    fontSize: 13,
    fontWeight: 700,
    opacity: 0.92,
  },

  roundCount: {
    minHeight: 36,
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.24)",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 800,
  },

  courtBody: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  courtMatchBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  courtRoundBadge: {
    alignSelf: "flex-start",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 900,
  },

  collapseButton: {
    minHeight: 36,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  collapsedHint: {
    padding: "14px 16px 18px",
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
  },

  matchGrid: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 16,
  },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRoundLabel(round, roundIndex) {
  return round?.label || `ROUND ${roundIndex + 1}`;
}

function buildCourtItems(roundItems = []) {
  const byCourt = new Map();

  asArray(roundItems).forEach((round, roundIndex) => {
    asArray(round?.matches).forEach((match, matchIndex) => {
      const courtNo = Number(match?.court) || matchIndex + 1;
      const courtLabel = match?.courtLabel || `코트 ${courtNo}`;
      const teamName = String(match?.teamName || match?.homeTeamName || "").trim();
      const entry = byCourt.get(courtNo) || {
        id: `court-${courtNo}`,
        courtNo,
        courtLabel,
        teamName,
        items: [],
      };

      if (!entry.teamName && teamName) {
        entry.teamName = teamName;
      }

      entry.items.push({
        roundLabel: getRoundLabel(round, roundIndex),
        match,
        matchIndex,
      });
      byCourt.set(courtNo, entry);
    });
  });

  return Array.from(byCourt.values()).sort((a, b) => a.courtNo - b.courtNo);
}

export default function ScheduleBoard({
  roundItems = [],
  modeLabel = "",
  onChangeScoreA,
  onChangeScoreB,
  onResetScore,
  groupByCourt = false,
  compact = false,
}) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const [collapsedCourts, setCollapsedCourts] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!Array.isArray(roundItems) || roundItems.length === 0) {
    return (
      <div style={styles.emptyCard}>
        <h3 style={styles.emptyTitle}>대진표를 생성하세요</h3>
        <p style={styles.emptyText}>
          왼쪽 PlayerManager에서 선수 등록과 조건 입력 후 대진표 생성을 누르면 오른쪽 영역에 경기 카드가 표시됩니다.
        </p>
      </div>
    );
  }

  if (groupByCourt) {
    const courtItems = buildCourtItems(roundItems);

    return (
      <div
        style={{
          ...styles.courtList,
          gridTemplateColumns: compact ? "repeat(auto-fit, minmax(220px, 1fr))" : styles.courtList.gridTemplateColumns,
          gap: compact ? 8 : styles.courtList.gap,
        }}
      >
        {courtItems.map((court) => {
          const isCollapsed = isMobile && !!collapsedCourts[court.id];

          return (
            <section key={court.id} style={styles.courtSection}>
              <div
                style={{
                  ...styles.courtHeader,
                  padding: compact ? "8px 10px" : styles.courtHeader.padding,
                }}
              >
                <div style={styles.courtTitleWrap}>
                  <div style={{ ...styles.courtTitle, fontSize: compact ? 18 : styles.courtTitle.fontSize }}>
                    {court.courtLabel}
                  </div>
                  <div style={{ ...styles.courtMeta, fontSize: compact ? 10 : styles.courtMeta.fontSize }}>
                    {court.teamName ? `${court.teamName} 전용 코트` : "코트별 경기 진행"}
                  </div>
                </div>
                <div style={styles.courtHeaderActions}>
                  <div style={{ ...styles.roundCount, minHeight: compact ? 24 : styles.roundCount.minHeight, fontSize: compact ? 10 : styles.roundCount.fontSize }}>
                    총 {court.items.length}경기
                  </div>
                  {isMobile ? (
                    <button
                      type="button"
                      style={{
                        ...styles.collapseButton,
                        minHeight: compact ? 28 : styles.collapseButton.minHeight,
                        padding: compact ? "0 10px" : styles.collapseButton.padding,
                        fontSize: compact ? 10 : styles.collapseButton.fontSize,
                      }}
                      onClick={() =>
                        setCollapsedCourts((prev) => ({
                          ...prev,
                          [court.id]: !prev[court.id],
                        }))
                      }
                    >
                      {isCollapsed ? "코트 펼치기" : "코트 접기"}
                    </button>
                  ) : null}
                </div>
              </div>

              {isCollapsed ? (
                <div style={styles.collapsedHint}>{court.courtLabel} 경기가 접혀 있습니다.</div>
              ) : (
                <div style={{ ...styles.courtBody, padding: compact ? 8 : styles.courtBody.padding, gap: compact ? 6 : styles.courtBody.gap }}>
                  {court.items.map((item, itemIndex) => {
                    const match = item.match;
                    const matchId = match?.id || match?.matchId || `${court.id}-${item.roundLabel}-${itemIndex}`;

                    return (
                      <div key={matchId} style={{ ...styles.courtMatchBlock, gap: compact ? 4 : styles.courtMatchBlock.gap }}>
                        <div
                          style={{
                            ...styles.courtRoundBadge,
                            minHeight: compact ? 22 : styles.courtRoundBadge.minHeight,
                            padding: compact ? "0 6px" : styles.courtRoundBadge.padding,
                            fontSize: compact ? 9 : styles.courtRoundBadge.fontSize,
                          }}
                        >
                          {item.roundLabel}
                        </div>
                        <MatchCard
                          match={match}
                          matchIndex={item.matchIndex}
                          modeLabel={modeLabel}
                          compact={compact}
                          onChangeScoreA={(value) => onChangeScoreA?.(matchId, value)}
                          onChangeScoreB={(value) => onChangeScoreB?.(matchId, value)}
                          onResetScore={() => onResetScore?.(matchId)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ ...styles.roundsList, gap: compact ? 10 : styles.roundsList.gap }}>
      {roundItems.map((round, roundIndex) => (
        <section key={round?.id || roundIndex} style={styles.roundSection}>
          <div
            style={{
              ...styles.roundHeader,
              padding: compact ? "8px 10px" : styles.roundHeader.padding,
            }}
          >
            <div style={styles.roundTitleWrap}>
              <div style={{ ...styles.roundTitle, fontSize: compact ? 18 : styles.roundTitle.fontSize }} className="app-round-title">
                {round?.label || `ROUND ${roundIndex + 1}`}
              </div>
              <div style={{ ...styles.roundMeta, fontSize: compact ? 10 : styles.roundMeta.fontSize }}>
                {asArray(round?.matches).length}경기 진행
              </div>
            </div>

            <div style={{ ...styles.roundCount, minHeight: compact ? 24 : styles.roundCount.minHeight, fontSize: compact ? 10 : styles.roundCount.fontSize }}>
              총 {asArray(round?.matches).length}경기
            </div>
          </div>

          <div
            style={{
              ...styles.matchGrid,
              padding: compact ? 8 : styles.matchGrid.padding,
              gridTemplateColumns: compact ? "repeat(auto-fit, minmax(220px, 1fr))" : styles.matchGrid.gridTemplateColumns,
              gap: compact ? 8 : styles.matchGrid.gap,
            }}
          >
            {asArray(round?.matches).map((match, matchIndex) => {
              const matchId = match?.id || match?.matchId || `${roundIndex}-${matchIndex}`;

              return (
                <MatchCard
                  key={matchId}
                  match={match}
                  matchIndex={matchIndex}
                  modeLabel={modeLabel}
                  compact={compact}
                  onChangeScoreA={(value) => onChangeScoreA?.(matchId, value)}
                  onChangeScoreB={(value) => onChangeScoreB?.(matchId, value)}
                  onResetScore={() => onResetScore?.(matchId)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
