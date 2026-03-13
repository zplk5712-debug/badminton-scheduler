import { buildPairCandidates, selectMatchesFromPairs } from "./matchEngineUtils";

export function buildRivalrySchedule(players) {
  const pairs = buildPairCandidates(players, { sameRivalryTeam: true }).sort(
    (a, b) => a.score - b.score
  );

  const matches = selectMatchesFromPairs(pairs, {
    sameType: true,
    crossRivalry: true,
    maxDiff: 1.5,
    label: "대항전 경기",
  });

  return matches.length ? [{ id: 1, title: "ROUND 1", matches }] : [];
}