import React from "react";
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

  roundSection: {
    border: "1px solid #dbeafe",
    borderRadius: 24,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
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

  roundTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  roundTitle: {
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },

  roundMeta: {
    fontSize: 14,
    fontWeight: 700,
    opacity: 0.96,
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

export default function ScheduleBoard({
  roundItems = [],
  modeLabel = "",
  onChangeScoreA,
  onChangeScoreB,
  onSaveScore,
  onResetScore,
}) {
  if (!Array.isArray(roundItems) || roundItems.length === 0) {
    return (
      <div style={styles.emptyCard}>
        <h3 style={styles.emptyTitle}>대진표를 생성하세요</h3>
        <p style={styles.emptyText}>
          좌측 PlayerManager에서 선수 등록과 조건 입력 후 대진표 생성을 누르면 오른쪽
          영역에 ROUND별 경기 카드가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.roundsList}>
      {roundItems.map((round, roundIndex) => (
        <section key={round?.id || roundIndex} style={styles.roundSection}>
          <div style={styles.roundHeader}>
            <div style={styles.roundTitleWrap}>
              <div style={styles.roundTitle} className="app-round-title">
                {round?.label || `ROUND ${roundIndex + 1}`}
              </div>
              <div style={styles.roundMeta}>{asArray(round?.matches).length}경기 진행</div>
            </div>

            <div style={styles.roundCount}>총 {asArray(round?.matches).length}경기</div>
          </div>

          <div style={styles.matchGrid}>
            {asArray(round?.matches).map((match, matchIndex) => {
              const matchId = match?.id || match?.matchId || `${roundIndex}-${matchIndex}`;

              return (
                <MatchCard
                  key={matchId}
                  match={match}
                  matchIndex={matchIndex}
                  modeLabel={modeLabel}
                  onChangeScoreA={(value) => onChangeScoreA?.(matchId, value)}
                  onChangeScoreB={(value) => onChangeScoreB?.(matchId, value)}
                  onSaveScore={() => onSaveScore?.(matchId)}
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