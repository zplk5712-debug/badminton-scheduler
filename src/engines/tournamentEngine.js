import { buildPairCandidates, selectMatchesFromPairs } from "./matchEngineUtils";

export function buildTournamentSchedule(players) {
  const pairs = buildPairCandidates(players, { requireEvents: true }).sort(
    (a, b) => a.score - b.score
  );

  const matches = selectMatchesFromPairs(pairs, {
    sameType: true,
    sameGrade: true,
    maxDiff: 1.0,
    label: "대회 경기",
  });

  return matches.length ? [{ id: 1, title: "ROUND 1", matches }] : [];
}