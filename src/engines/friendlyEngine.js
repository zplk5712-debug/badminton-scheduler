import { buildPairCandidates, selectMatchesFromPairs } from "./matchEngineUtils";

export function buildFriendlySchedule(players) {
  const pairs = buildPairCandidates(players).sort((a, b) => a.score - b.score);

  const matches = selectMatchesFromPairs(pairs, {
    sameType: false,
    maxDiff: 1.5,
    label: "친선전 복식",
  });

  return matches.length ? [{ id: 1, title: "ROUND 1", matches }] : [];
}