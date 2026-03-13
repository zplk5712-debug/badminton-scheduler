import { getPlayerScore, getTeamType, typeLabel } from "../utils";

export function buildPairCandidates(players, options = {}) {
  const pairs = [];

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i];
      const b = players[j];
      const team = [a, b];
      const type = getTeamType(team);

      if (options.sameRivalryTeam && a.rivalryTeam !== b.rivalryTeam) continue;

      if (options.requireEvents) {
        if (type === "NAM" && !(a.events?.nam && b.events?.nam)) continue;
        if (type === "YEO" && !(a.events?.yeo && b.events?.yeo)) continue;
        if (type === "HON" && !(a.events?.hon && b.events?.hon)) continue;
      }

      pairs.push({
        team,
        type,
        score: getPlayerScore(a) + getPlayerScore(b),
      });
    }
  }

  return pairs;
}

export function selectMatchesFromPairs(pairCandidates, options = {}) {
  const matches = [];
  const used = new Set();

  for (let i = 0; i < pairCandidates.length; i += 1) {
    for (let j = i + 1; j < pairCandidates.length; j += 1) {
      const pairA = pairCandidates[i];
      const pairB = pairCandidates[j];

      const ids = [...pairA.team, ...pairB.team].map((p) => p.id);
      if (new Set(ids).size < 4) continue;
      if (ids.some((id) => used.has(id))) continue;

      if (options.sameType && pairA.type !== pairB.type) continue;

      if (options.sameGrade) {
        const grades = [...pairA.team, ...pairB.team].map((p) => p.grade);
        if (new Set(grades).size !== 1) continue;
      }

      if (options.crossRivalry) {
        const uniqA = new Set(pairA.team.map((p) => p.rivalryTeam));
        const uniqB = new Set(pairB.team.map((p) => p.rivalryTeam));
        if (uniqA.size !== 1 || uniqB.size !== 1) continue;
        if (pairA.team[0].rivalryTeam === pairB.team[0].rivalryTeam) continue;
      }

      const diff = Math.abs(pairA.score - pairB.score);
      if (diff > (options.maxDiff ?? 1.5)) continue;

      matches.push({
        courtId: matches.length + 1,
        matchLabel:
          options.label ||
          `${typeLabel(pairA.type)}${
            pairA.type === pairB.type ? "" : ` vs ${typeLabel(pairB.type)}`
          }`,
        teamA: pairA.team,
        teamB: pairB.team,
        teamAName: options.crossRivalry ? pairA.team[0].rivalryTeam : "TEAM A",
        teamBName: options.crossRivalry ? pairB.team[0].rivalryTeam : "TEAM B",
        scoreA: pairA.score,
        scoreB: pairB.score,
        diff,
      });

      ids.forEach((id) => used.add(id));
      if (matches.length >= 4) return matches;
      break;
    }
  }

  return matches;
}