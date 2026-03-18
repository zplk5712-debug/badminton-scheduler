const MALE_SCORE_BY_GRADE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const FEMALE_SCORE_BY_GRADE = { A: 3.8, B: 2.5, C: 1.8, D: 0.9, E: 0.5 };

const PAIR_TYPE_MALE = "\uB0A8\uBCF5";
const PAIR_TYPE_FEMALE = "\uC5EC\uBCF5";
const PAIR_TYPE_MIXED = "\uD63C\uBCF5";
const TYPE_ORDER = {
  [PAIR_TYPE_MALE]: 0,
  [PAIR_TYPE_FEMALE]: 1,
  [PAIR_TYPE_MIXED]: 2,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toLowerCase();
  if (["m", "male", "man", "boy", "\uB0A8", "\uB0A8\uC790"].includes(raw)) return "M";
  if (["f", "female", "woman", "girl", "\uC5EC", "\uC5EC\uC790"].includes(raw)) return "F";
  return "U";
}

function getPlayerName(player) {
  return String(player?.name || "").trim();
}

function getBaseScore(player) {
  if (typeof player?.baseScore === "number" && Number.isFinite(player.baseScore)) {
    return player.baseScore;
  }

  const grade = String(player?.grade || "").trim().toUpperCase();
  return normalizeGender(player?.gender) === "F"
    ? FEMALE_SCORE_BY_GRADE[grade] ?? 0
    : MALE_SCORE_BY_GRADE[grade] ?? 0;
}

function getPairType(players) {
  const genders = asArray(players).map((player) => normalizeGender(player?.gender));
  const maleCount = genders.filter((gender) => gender === "M").length;
  const femaleCount = genders.filter((gender) => gender === "F").length;

  if (maleCount === 2) return PAIR_TYPE_MALE;
  if (femaleCount === 2) return PAIR_TYPE_FEMALE;
  return PAIR_TYPE_MIXED;
}

function normalizeRivalryPlayers(players) {
  return asArray(players)
    .map((player, index) => ({
      ...player,
      id: String(player?.id || `player-${index + 1}`),
      name: getPlayerName(player),
      rivalryTeam: String(player?.rivalryTeam || "A\uD300").trim() || "A\uD300",
      ageGroup: String(player?.ageGroup || "").trim() || "40\uB300",
      grade: String(player?.grade || "").trim().toUpperCase() || "C",
      gender: normalizeGender(player?.gender),
      baseScore: getBaseScore(player),
    }))
    .filter((player) => player.name);
}

function pairBalancedPlayers(players, rivalryTeam, pairType) {
  const sorted = [...players].sort((a, b) => {
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    return String(a.name).localeCompare(String(b.name), "ko");
  });

  const pairs = [];
  let pairIndex = 1;

  while (sorted.length >= 2) {
    const high = sorted.shift();
    const low = sorted.pop();
    const pairPlayers = [high, low].filter(Boolean);
    if (pairPlayers.length < 2) break;

    pairs.push({
      id: `${rivalryTeam}-${pairType}-${pairIndex}`,
      label: pairPlayers.map((player) => player.name).join(" / "),
      rivalryTeam,
      ageGroup: String(pairPlayers[0]?.ageGroup || "").trim() || "40\uB300",
      grade: String(pairPlayers[0]?.grade || "").trim().toUpperCase() || "C",
      players: pairPlayers,
      pairType,
      score: Number(pairPlayers.reduce((sum, player) => sum + player.baseScore, 0).toFixed(1)),
    });
    pairIndex += 1;
  }

  return { pairs, leftovers: sorted };
}

function buildAutoTeamPairs(players) {
  const normalizedPlayers = normalizeRivalryPlayers(players);
  const teamBuckets = new Map();

  normalizedPlayers.forEach((player) => {
    const bucket = teamBuckets.get(player.rivalryTeam) || [];
    bucket.push(player);
    teamBuckets.set(player.rivalryTeam, bucket);
  });

  return Array.from(teamBuckets.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "ko"))
    .flatMap(([teamName, teamPlayers]) => {
      const malePlayers = teamPlayers.filter((player) => player.gender === "M");
      const femalePlayers = teamPlayers.filter((player) => player.gender === "F");

      const maleResult = pairBalancedPlayers(malePlayers, teamName, PAIR_TYPE_MALE);
      const femaleResult = pairBalancedPlayers(femalePlayers, teamName, PAIR_TYPE_FEMALE);

      const mixedSource = [...maleResult.leftovers, ...femaleResult.leftovers].sort((a, b) => {
        if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
        return String(a.name).localeCompare(String(b.name), "ko");
      });

      const mixedPairs = [];
      let mixedIndex = 1;

      while (
        mixedSource.some((player) => player.gender === "M") &&
        mixedSource.some((player) => player.gender === "F")
      ) {
        const maleIndex = mixedSource.findIndex((player) => player.gender === "M");
        const femaleIndex = mixedSource.findIndex((player) => player.gender === "F");
        if (maleIndex < 0 || femaleIndex < 0) break;

        const malePlayer = mixedSource.splice(maleIndex, 1)[0];
        const adjustedFemaleIndex = femaleIndex > maleIndex ? femaleIndex - 1 : femaleIndex;
        const femalePlayer = mixedSource.splice(adjustedFemaleIndex, 1)[0];
        const pairPlayers = [malePlayer, femalePlayer];

        mixedPairs.push({
          id: `${teamName}-${PAIR_TYPE_MIXED}-${mixedIndex}`,
          label: pairPlayers.map((player) => player.name).join(" / "),
          rivalryTeam: teamName,
          ageGroup: String(pairPlayers[0]?.ageGroup || "").trim() || "40\uB300",
          grade: String(pairPlayers[0]?.grade || "").trim().toUpperCase() || "C",
          players: pairPlayers,
          pairType: PAIR_TYPE_MIXED,
          score: Number(pairPlayers.reduce((sum, player) => sum + player.baseScore, 0).toFixed(1)),
        });
        mixedIndex += 1;
      }

      return [...maleResult.pairs, ...femaleResult.pairs, ...mixedPairs];
    })
    .sort((a, b) => {
      const teamCompare = String(a.rivalryTeam).localeCompare(String(b.rivalryTeam), "ko");
      if (teamCompare !== 0) return teamCompare;

      const typeCompare = (TYPE_ORDER[a.pairType] ?? 99) - (TYPE_ORDER[b.pairType] ?? 99);
      if (typeCompare !== 0) return typeCompare;

      if (a.score !== b.score) return b.score - a.score;
      return String(a.label).localeCompare(String(b.label), "ko");
    });
}

function createMatch(pairA, pairB, roundNo, courtNo) {
  const sameType = pairA.pairType === pairB.pairType;
  const matchType = sameType ? pairA.pairType : `${pairA.pairType}/${pairB.pairType}`;
  return {
    id: `rivalry-match-${roundNo}-${courtNo}-${pairA.id}-${pairB.id}`,
    matchType,
    matchLabel: `\uB300\uD56D\uC804 ${matchType}`,
    teamA: pairA.players,
    teamB: pairB.players,
    teamAName: pairA.rivalryTeam,
    teamBName: pairB.rivalryTeam,
    court: courtNo,
    courtId: courtNo,
    courtLabel: `\uCF54\uD2B8 ${courtNo}`,
    scoreAInput: "",
    scoreBInput: "",
    meta: {
      stage: "\uB300\uD56D\uC804",
      pairAId: pairA.id,
      pairBId: pairB.id,
      pairType: matchType,
      roundNo,
      sameType,
    },
  };
}

function getExpectedTotalMatchCount(pairs, targetMatchCount) {
  const activePlayerCount = asArray(pairs).reduce(
    (sum, pair) => sum + asArray(pair?.players).length,
    0
  );
  return Math.ceil((activePlayerCount * targetMatchCount) / 4);
}

export function buildRivalrySchedule(players, options = {}) {
  const targetMatchCount = Math.max(1, Number(options?.targetMatchCount) || 1);
  const courtCount = Math.max(1, Number(options?.courtCount) || 1);
  const fixedPairs = buildAutoTeamPairs(players);

  if (fixedPairs.length < 2) return [];

  const rivalryTeams = Array.from(new Set(fixedPairs.map((pair) => pair.rivalryTeam))).sort((a, b) =>
    String(a).localeCompare(String(b), "ko")
  );
  if (rivalryTeams.length < 2) return [];

  const teamAName = rivalryTeams[0];
  const teamBName = rivalryTeams[1];
  const groupedByType = [PAIR_TYPE_MALE, PAIR_TYPE_FEMALE, PAIR_TYPE_MIXED].map((pairType) => ({
    pairType,
    teamA: fixedPairs.filter(
      (pair) => pair.rivalryTeam === teamAName && pair.pairType === pairType
    ),
    teamB: fixedPairs.filter(
      (pair) => pair.rivalryTeam === teamBName && pair.pairType === pairType
    ),
  }));

  const pairGames = new Map(fixedPairs.map((pair) => [pair.id, 0]));
  const matchupCounts = new Map();
  const rounds = [];
  const expectedTotalMatches = getExpectedTotalMatchCount(fixedPairs, targetMatchCount);
  const maxRoundCount = Math.max(
    targetMatchCount,
    Math.ceil(expectedTotalMatches / courtCount) * 4,
    fixedPairs.length * targetMatchCount
  );

  let roundNo = 1;

  while (roundNo <= maxRoundCount) {
    const hasRemainingPairs = fixedPairs.some(
      (pair) => (pairGames.get(pair.id) || 0) < targetMatchCount
    );
    if (!hasRemainingPairs) break;

    const usedInRound = new Set();
    const matches = [];
    const nextCoverageTarget =
      fixedPairs.some((pair) => (pairGames.get(pair.id) || 0) < 1)
        ? 1
        : targetMatchCount > 1 && fixedPairs.some((pair) => (pairGames.get(pair.id) || 0) < 2)
        ? 2
        : targetMatchCount;

    while (matches.length < courtCount) {
      const sameTypeCandidates = groupedByType
        .sort((a, b) => (TYPE_ORDER[a.pairType] ?? 99) - (TYPE_ORDER[b.pairType] ?? 99))
        .flatMap((bucket) =>
          bucket.teamA.flatMap((pairA) =>
            bucket.teamB.map((pairB) => ({
              pairA,
              pairB,
              pairType: bucket.pairType,
              sameType: true,
              typePenalty: 0,
              diff: Math.abs(pairA.score - pairB.score),
              maxGames: Math.max(pairGames.get(pairA.id) || 0, pairGames.get(pairB.id) || 0),
              totalGames: (pairGames.get(pairA.id) || 0) + (pairGames.get(pairB.id) || 0),
              matchupCount:
                matchupCounts.get(`${pairA.id}::${pairB.id}`) ||
                matchupCounts.get(`${pairB.id}::${pairA.id}`) ||
                0,
            }))
          )
        );

      const crossTypeCandidates = fixedPairs
        .filter((pair) => pair.rivalryTeam === teamAName)
        .flatMap((pairA) =>
          fixedPairs
            .filter((pair) => pair.rivalryTeam === teamBName)
            .map((pairB) => ({
              pairA,
              pairB,
              pairType: `${pairA.pairType}/${pairB.pairType}`,
              sameType: pairA.pairType === pairB.pairType,
              typePenalty: pairA.pairType === pairB.pairType ? 0 : 1,
              diff: Math.abs(pairA.score - pairB.score),
              maxGames: Math.max(pairGames.get(pairA.id) || 0, pairGames.get(pairB.id) || 0),
              totalGames: (pairGames.get(pairA.id) || 0) + (pairGames.get(pairB.id) || 0),
              matchupCount:
                matchupCounts.get(`${pairA.id}::${pairB.id}`) ||
                matchupCounts.get(`${pairB.id}::${pairA.id}`) ||
                0,
            }))
        )
        .filter((candidate) => candidate.typePenalty > 0);

      const candidates = [...sameTypeCandidates, ...crossTypeCandidates]
        .filter(
          (candidate) =>
            !usedInRound.has(candidate.pairA.id) && !usedInRound.has(candidate.pairB.id)
        )
        .sort((a, b) => {
          const aGamesA = pairGames.get(a.pairA.id) || 0;
          const aGamesB = pairGames.get(a.pairB.id) || 0;
          const bGamesA = pairGames.get(b.pairA.id) || 0;
          const bGamesB = pairGames.get(b.pairB.id) || 0;
          const aCoverage = Math.max(0, nextCoverageTarget - aGamesA) + Math.max(0, nextCoverageTarget - aGamesB);
          const bCoverage = Math.max(0, nextCoverageTarget - bGamesA) + Math.max(0, nextCoverageTarget - bGamesB);
          if (aCoverage !== bCoverage) return bCoverage - aCoverage;
          if (a.typePenalty !== b.typePenalty) return a.typePenalty - b.typePenalty;
          if (a.maxGames !== b.maxGames) return a.maxGames - b.maxGames;
          if (a.totalGames !== b.totalGames) return a.totalGames - b.totalGames;
          if (a.matchupCount !== b.matchupCount) return a.matchupCount - b.matchupCount;
          if (a.diff !== b.diff) return a.diff - b.diff;
          return String(a.pairType).localeCompare(String(b.pairType), "ko");
        });

      const next = candidates[0];
      if (!next) break;

      const courtNo = matches.length + 1;
      matches.push(createMatch(next.pairA, next.pairB, roundNo, courtNo));
      usedInRound.add(next.pairA.id);
      usedInRound.add(next.pairB.id);
      pairGames.set(next.pairA.id, (pairGames.get(next.pairA.id) || 0) + 1);
      pairGames.set(next.pairB.id, (pairGames.get(next.pairB.id) || 0) + 1);
      matchupCounts.set(
        `${next.pairA.id}::${next.pairB.id}`,
        (matchupCounts.get(`${next.pairA.id}::${next.pairB.id}`) || 0) + 1
      );
    }

    if (matches.length === 0) break;

    rounds.push({
      id: `round-${roundNo}`,
      label: `ROUND ${roundNo}`,
      round: roundNo,
      matches,
    });
    roundNo += 1;
  }

  return rounds;
}
