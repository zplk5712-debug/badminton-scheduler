import React from "react";

const styles = {
  wrap: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  scoreBadge: {
    padding: "7px 16px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 15,
    lineHeight: 1.2,
    minHeight: 36,
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box",
  },

  input: {
    width: 72,
    height: 38,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box",
    outline: "none",
  },

  colon: {
    fontSize: 18,
    fontWeight: 900,
    color: "#334155",
    lineHeight: 1,
  },

  resetButton: {
    minHeight: 38,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
};

function toSafeValue(value) {
  if (value === null || typeof value === "undefined") return "";
  return String(value);
}

export default function ScoreInput({
  scoreText = "점수 입력",
  scoreAInput = "",
  scoreBInput = "",
  onChangeScoreA,
  onChangeScoreB,
  onReset,
  disabled = false,
  compact = false,
}) {
  const handleChangeA = (event) => {
    const nextValue = String(event.target.value || "").replace(/[^\d]/g, "");
    if (typeof onChangeScoreA === "function") onChangeScoreA(nextValue);
  };

  const handleChangeB = (event) => {
    const nextValue = String(event.target.value || "").replace(/[^\d]/g, "");
    if (typeof onChangeScoreB === "function") onChangeScoreB(nextValue);
  };

  return (
    <div style={{ ...styles.wrap, gap: compact ? 4 : styles.wrap.gap }}>
      <div
        style={{
          ...styles.scoreBadge,
          padding: compact ? "3px 8px" : styles.scoreBadge.padding,
          fontSize: compact ? 11 : styles.scoreBadge.fontSize,
          minHeight: compact ? 26 : styles.scoreBadge.minHeight,
        }}
      >
        {scoreText}
      </div>

      <input
        type="text"
        inputMode="numeric"
        value={toSafeValue(scoreAInput)}
        onChange={handleChangeA}
        style={{
          ...styles.input,
          width: compact ? 46 : styles.input.width,
          height: compact ? 26 : styles.input.height,
          borderRadius: compact ? 8 : styles.input.borderRadius,
          padding: compact ? "0 4px" : styles.input.padding,
          fontSize: compact ? 12 : styles.input.fontSize,
        }}
        disabled={disabled}
      />

      <div style={{ ...styles.colon, fontSize: compact ? 13 : styles.colon.fontSize }}>:</div>

      <input
        type="text"
        inputMode="numeric"
        value={toSafeValue(scoreBInput)}
        onChange={handleChangeB}
        style={{
          ...styles.input,
          width: compact ? 46 : styles.input.width,
          height: compact ? 26 : styles.input.height,
          borderRadius: compact ? 8 : styles.input.borderRadius,
          padding: compact ? "0 4px" : styles.input.padding,
          fontSize: compact ? 12 : styles.input.fontSize,
        }}
        disabled={disabled}
      />

      <button
        type="button"
        style={{
          ...styles.resetButton,
          minHeight: compact ? 26 : styles.resetButton.minHeight,
          padding: compact ? "0 7px" : styles.resetButton.padding,
          borderRadius: compact ? 8 : styles.resetButton.borderRadius,
          fontSize: compact ? 10 : styles.resetButton.fontSize,
        }}
        onClick={onReset}
        disabled={disabled}
      >
        초기화
      </button>
    </div>
  );
}
