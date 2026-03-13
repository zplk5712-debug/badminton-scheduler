const DEFAULT_TARGET_MATCHES_PER_PLAYER = 3;
const DEFAULT_COURT_COUNT = 4;
const DEFAULT_WINNING_SCORE = 25;
const TEAM_NAME_START_CHAR_CODE = 65;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPlayerName(player, index = 0) {
  return (
    player?.name ||
    player?.playerName ||
    player?.fullname ||
    player?.fullName ||
    player?.nickname ||
    `선수${index + 1}`
  );
}

function getPlayerGender(player) {
  const raw = (
    player?.gender ||
    player?.sex ||
    player?.genderType ||
    player?.playerGender ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (["m", "male", "man", "남", "남자", "남성", "boy"].includes(raw)) return "M";
  if (["f", "female", "woman", "여", "여자", "여성", "girl"].includes(raw)) return "F";
  return "U";
}

function getPlayerAge(player) {
  const ageCandidates = [player?.age, player?.playerAge, player?.actualAge];

  for (const candidate of ageCandidates) {
    const age = toNumber(candidate, NaN);
    if (Number.isFinite(age) && age > 0) return age;
  }

  const birthCandidates = [player?.birthYear, player?.yearOfBirth, player?.bornYear];

  for (const candidate of birthCandidates) {
    const year = toNumber(candidate, NaN);
    if (Number.isFinite(year) && year > 1900 && year < 2100) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - year + 1;
      if (age > 0) return age;
    }
  }

  return 30;
}

function normalizeLevel(rawLevel) {
  const level = (rawLevel || "").toString().trim().toUpperCase();
  if (["A", "B", "C", "D", "E"].includes(level)) return level;
  return "C";
}

function getPlayerLevel(player) {
  return normalizeLevel(
    player?.level ||
      player?.grade ||
      player?.rank ||
      player?.class ||
      player?.skill ||
      player?.tier
  );
}

function levelScore(level) {
  const map = { A: 5, B: 4, C: 3, D: 2, E: 1 };
  return map[normalizeLevel(level)] || 3;
}

function normalizePlayer(player, index) {
  const age = getPlayerAge(player);
  const level = getPlayerLevel(player);

  return {
    ...player,
    __id:
      player?.id ||
      player?._id ||
      player?.playerId ||
      `${getPlayerName(player, index)}-${index}`,
    name: getPlayerName(player, index),
    gender: getPlayerGender(player),
    age,
    level,
    levelScore: levelScore(level),
  };
}

function getAgeBand(age) {
  const normalized = clamp(Math.floor(toNumber(age, 30) / 10) * 10, 20, 70);
  if (normalized >= 70) return "70대";
  return `${normalized}대`;
}

function buildAgeBandGroups(players) {
  const grouped = new Map();

  players.forEach((player) => {
    const ageBand = getAgeBand(player.age);
    if (!grouped.has(ageBand)) grouped.set(ageBand, []);
    grouped.get(ageBand).push(player);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([ageBand, members]) => ({
      ageBand,
      members: sortPlayersForGrouping(members),
    }));
}

function sortPlayersForGrouping(players) {
  return [...players].sort((a, b) => {
    if (a.age !== b.age) return a.age - b.age;
    if (a.levelScore !== b.levelScore) return b.levelScore - a.levelScore;
    if (a.gender !== b.gender) {
      if (a.gender === "F") return -1;
      if (b.gender === "F") return 1;
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

function makeTeamName(index) {
  return `${String.fromCharCode(TEAM_NAME_START_CHAR_CODE + index)}팀`;
}

function createAgeBasedTeams(players) {
  const normalizedPlayers = safeArray(players).map(normalizePlayer);
  const ageGroups = buildAgeBandGroups(normalizedPlayers);

  return ageGroups.map((group, index) => ({
    id: `league-team-${index + 1}`,
    name: makeTeamName(index),
    ageBand: group.ageBand,
    players: group.members,
    playerCount: group.members.length,
  }));
}

function countByGender(players) {
  return players.reduce(
    (acc, player) => {
      if (player.gender === "M") acc.male += 1;
      else if (player.gender === "F") acc.female += 1;
      else acc.unknown += 1;
      return acc;
    },
    { male: 0, female: 0, unknown: 0 }
  );
}

function getPlayerMatchCountMap(players) {
  const map = new Map();
  safeArray(players).forEach((player) => {
    map.set(player.__id, 0);
  });
  return map;
}

function getTeamPairId(teamId, pairIndex) {
  return `${teamId}-pair-${pairIndex + 1}`;
}

function buildPairObject(team, pairPlayers, pairIndex, pairType = "일반복식") {
  return {
    id: getTeamPairId(team.id, pairIndex),
    pairId: getTeamPairId(team.id, pairIndex),
    teamId: team.id,
    teamName: team.name,
    ageBand: team.ageBand,
    pairIndex: pairIndex + 1,
    name: `${pairPlayers[0].name} / ${pairPlayers[1].name}`,
    players: pairPlayers,
    playerNames: pairPlayers.map((player) => player.name),
    combinedAge: pairPlayers.reduce((sum, player) => sum + player.age, 0),
    combinedLevelScore: pairPlayers.reduce((sum, player) => sum + player.levelScore, 0),
    pairType,
  };
}

function sortByLowMatchThenBalance(players, matchCountMap) {
  return [...players].sort((a, b) => {
    const matchDiff = (matchCountMap.get(a.__id) || 0) - (matchCountMap.get(b.__id) || 0);
    if (matchDiff !== 0) return matchDiff;
    if (a.age !== b.age) return a.age - b.age;
    if (a.levelScore !== b.levelScore) return a.levelScore - b.levelScore;
    return a.name.localeCompare(b.name, "ko");
  });
}

function pickBestSameGroupPairs(players, matchCountMap, targetGender) {
  const filtered =
    targetGender === "M" || targetGender === "F"
      ? players.filter((player) => player.gender === targetGender)
      : [...players];

  const ordered = sortByLowMatchThenBalance(filtered, matchCountMap);
  const pairs = [];
  const used = new Set();

  for (let i = 0; i < ordered.length; i += 1) {
    const playerA = ordered[i];
    if (used.has(playerA.__id)) continue;

    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let j = i + 1; j < ordered.length; j += 1) {
      const playerB = ordered[j];
      if (used.has(playerB.__id)) continue;

      const score =
        Math.abs(playerA.age - playerB.age) * 10 +
        Math.abs(playerA.levelScore - playerB.levelScore) * 20 +
        (matchCountMap.get(playerA.__id) || 0) +
        (matchCountMap.get(playerB.__id) || 0);

      if (score < bestScore) {
        bestScore = score;
        bestIndex = j;
      }
    }

    if (bestIndex >= 0) {
      const playerB = ordered[bestIndex];
      used.add(playerA.__id);
      used.add(playerB.__id);
      pairs.push([playerA, playerB]);
    }
  }

  const leftovers = ordered.filter((player) => !used.has(player.__id));
  return { pairs, leftovers };
}

function pickBestMixedPairs(males, females, matchCountMap) {
  const sortedMales = sortByLowMatchThenBalance(males, matchCountMap);
  const sortedFemales = sortByLowMatchThenBalance(females, matchCountMap);

  const pairs = [];
  const usedMale = new Set();
  const usedFemale = new Set();

  for (let i = 0; i < sortedMales.length; i += 1) {
    const male = sortedMales[i];
    if (usedMale.has(male.__id)) continue;

    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let j = 0; j < sortedFemales.length; j += 1) {
      const female = sortedFemales[j];
      if (usedFemale.has(female.__id)) continue;

      const score =
        Math.abs(male.age - female.age) * 10 +
        Math.abs(male.levelScore - female.levelScore) * 20 +
        (matchCountMap.get(male.__id) || 0) +
        (matchCountMap.get(female.__id) || 0);

      if (score < bestScore) {
        bestScore = score;
        bestIndex = j;
      }
    }

    if (bestIndex >= 0) {
      const female = sortedFemales[bestIndex];
      usedMale.add(male.__id);
      usedFemale.add(female.__id);
      pairs.push([male, female]);
    }
  }

  const maleLeftovers = sortedMales.filter((player) => !usedMale.has(player.__id));
  const femaleLeftovers = sortedFemales.filter((player) => !usedFemale.has(player.__id));

  return { pairs, maleLeftovers, femaleLeftovers };
}

function buildFixedPairsForTeam(team, targetMatchesPerPlayer) {
  const players = safeArray(team.players);
  const playerCount = players.length;
  const isOdd = playerCount % 2 !== 0;

  const matchCountMap = getPlayerMatchCountMap(players);
  const genderStats = countByGender(players);

  const males = players.filter((player) => player.gender === "M");
  const females = players.filter((player) => player.gender === "F");
  const unknowns = players.filter((player) => player.gender === "U");

  const pairs = [];
  const leftovers = [];

  const genderGap = Math.abs(genderStats.male - genderStats.female);
  const totalKnownGender = genderStats.male + genderStats.female;
  const useMixedPriority =
    totalKnownGender >= 4 &&
    genderStats.male >= 2 &&
    genderStats.female >= 2 &&
    genderGap <= 1;

  if (useMixedPriority) {
    const mixedResult = pickBestMixedPairs(males, females, matchCountMap);

    mixedResult.pairs.forEach((pairPlayers) => {
      pairs.push(buildPairObject(team, pairPlayers, pairs.length, "혼합복식"));
    });

    const remain = [...mixedResult.maleLeftovers, ...mixedResult.femaleLeftovers, ...unknowns];
    const remainResult = pickBestSameGroupPairs(remain, matchCountMap, null);

    remainResult.pairs.forEach((pairPlayers) => {
      const pairType =
        pairPlayers[0].gender === "M" && pairPlayers[1].gender === "M"
          ? "남자복식"
          : pairPlayers[0].gender === "F" && pairPlayers[1].gender === "F"
          ? "여자복식"
          : "일반복식";

      pairs.push(buildPairObject(team, pairPlayers, pairs.length, pairType));
    });

    leftovers.push(...remainResult.leftovers);
  } else {
    if (genderStats.male > genderStats.female) {
      const maleResult = pickBestSameGroupPairs(males, matchCountMap, "M");

      maleResult.pairs.forEach((pairPlayers) => {
        pairs.push(buildPairObject(team, pairPlayers, pairs.length, "남자복식"));
      });

      const leftoverBundle = [...maleResult.leftovers, ...females, ...unknowns];
      const extraResult = pickBestSameGroupPairs(leftoverBundle, matchCountMap, null);

      extraResult.pairs.forEach((pairPlayers) => {
        const pairType =
          pairPlayers[0].gender === "F" && pairPlayers[1].gender === "F"
            ? "여자복식"
            : pairPlayers[0].gender === "M" && pairPlayers[1].gender === "M"
            ? "남자복식"
            : "일반복식";

        pairs.push(buildPairObject(team, pairPlayers, pairs.length, pairType));
      });

      leftovers.push(...extraResult.leftovers);
    } else if (genderStats.female > genderStats.male) {
      const femaleResult = pickBestSameGroupPairs(females, matchCountMap, "F");

      femaleResult.pairs.forEach((pairPlayers) => {
        pairs.push(buildPairObject(team, pairPlayers, pairs.length, "여자복식"));
      });

      const leftoverBundle = [...femaleResult.leftovers, ...males, ...unknowns];
      const extraResult = pickBestSameGroupPairs(leftoverBundle, matchCountMap, null);

      extraResult.pairs.forEach((pairPlayers) => {
        const pairType =
          pairPlayers[0].gender === "M" && pairPlayers[1].gender === "M"
            ? "남자복식"
            : pairPlayers[0].gender === "F" && pairPlayers[1].gender === "F"
            ? "여자복식"
            : "일반복식";

        pairs.push(buildPairObject(team, pairPlayers, pairs.length, pairType));
      });

      leftovers.push(...extraResult.leftovers);
    } else {
      const mixedResult = pickBestMixedPairs(males, females, matchCountMap);

      mixedResult.pairs.forEach((pairPlayers) => {
        pairs.push(buildPairObject(team, pairPlayers, pairs.length, "혼합복식"));
      });

      const remain = [...mixedResult.maleLeftovers, ...mixedResult.femaleLeftovers, ...unknowns];
      const extraResult = pickBestSameGroupPairs(remain, matchCountMap, null);

      extraResult.pairs.forEach((pairPlayers) => {
        const pairType =
          pairPlayers[0].gender === "M" && pairPlayers[1].gender === "M"
            ? "남자복식"
            : pairPlayers[0].gender === "F" && pairPlayers[1].gender === "F"
            ? "여자복식"
            : "일반복식";

        pairs.push(buildPairObject(team, pairPlayers, pairs.length, pairType));
      });

      leftovers.push(...extraResult.leftovers);
    }
  }

  const reserveTeam =
    leftovers.length >= 1
      ? {
          id: `${team.id}-reserve`,
          name: `${team.name}-보조팀`,
          ageBand: team.ageBand,
          type: "reserve",
          players: leftovers,
          note: "추가 인원 등록 또는 재생성 대상",
        }
      : null;

  return {
    teamId: team.id,
    teamName: team.name,
    ageBand: team.ageBand,
    playerCount,
    isOdd,
    canSchedule: pairs.length >= 2,
    pairs: pairs.map((pair, index) => ({
      ...pair,
      pairIndex: index + 1,
      id: getTeamPairId(team.id, index),
      pairId: getTeamPairId(team.id, index),
    })),
    reserveTeam,
    leftovers,
    meta: {
      maleCount: genderStats.male,
      femaleCount: genderStats.female,
      unknownCount: genderStats.unknown,
      targetMatchesPerPlayer,
      pairCount: pairs.length,
      leftoverCount: leftovers.length,
    },
  };
}

function buildAllFixedPairs(teams, targetMatchesPerPlayer) {
  return teams.map((team) => buildFixedPairsForTeam(team, targetMatchesPerPlayer));
}

function buildInternalLeaguePairings(pairEntries) {
  const matches = [];
  const safePairs = safeArray(pairEntries);

  for (let i = 0; i < safePairs.length; i += 1) {
    for (let j = i + 1; j < safePairs.length; j += 1) {
      matches.push([safePairs[i], safePairs[j]]);
    }
  }

  return matches;
}

function getPairMatchCount(matchCountMap, pair) {
  return pair.players.reduce((sum, player) => sum + (matchCountMap.get(player.__id) || 0), 0);
}

function calcTargetTotalMatches(players, targetMatchesPerPlayer) {
  const playerCount = safeArray(players).length;
  return Math.max(0, Math.round((playerCount * Math.max(0, targetMatchesPerPlayer)) / 4));
}

function calcIdealPairMatchCount(targetMatchesPerPlayer) {
  return Math.max(1, toNumber(targetMatchesPerPlayer, DEFAULT_TARGET_MATCHES_PER_PLAYER));
}

function buildTeamInternalMatches(pairGroup, targetMatchesPerPlayer) {
  const pairings = buildInternalLeaguePairings(pairGroup.pairs);
  const matchCountMap = getPlayerMatchCountMap(
    pairGroup.pairs.flatMap((pair) => safeArray(pair.players))
  );

  const pairTarget = calcIdealPairMatchCount(targetMatchesPerPlayer);
  const matches = [];
  const pairingUsageMap = new Map();

  if (pairings.length === 0) return matches;

  let guard = 0;
  while (guard < 1000) {
    guard += 1;

    const eligiblePairs = pairGroup.pairs.filter(
      (pair) => getPairMatchCount(matchCountMap, pair) / 2 < pairTarget
    );

    if (eligiblePairs.length < 2) break;

    const candidateMatchups = pairings
      .filter(([pairA, pairB]) => {
        const pairAMatches = getPairMatchCount(matchCountMap, pairA) / 2;
        const pairBMatches = getPairMatchCount(matchCountMap, pairB) / 2;
        return pairAMatches < pairTarget && pairBMatches < pairTarget;
      })
      .sort((a, b) => {
        const aUsageKey = `${a[0].id}|${a[1].id}`;
        const bUsageKey = `${b[0].id}|${b[1].id}`;

        const aUsage = pairingUsageMap.get(aUsageKey) || 0;
        const bUsage = pairingUsageMap.get(bUsageKey) || 0;
        if (aUsage !== bUsage) return aUsage - bUsage;

        const aCount = getPairMatchCount(matchCountMap, a[0]) + getPairMatchCount(matchCountMap, a[1]);
        const bCount = getPairMatchCount(matchCountMap, b[0]) + getPairMatchCount(matchCountMap, b[1]);
        if (aCount !== bCount) return aCount - bCount;

        const aDiff = Math.abs(a[0].combinedLevelScore - a[1].combinedLevelScore);
        const bDiff = Math.abs(b[0].combinedLevelScore - b[1].combinedLevelScore);
        if (aDiff !== bDiff) return aDiff - bDiff;

        return a[0].name.localeCompare(b[0].name, "ko");
      });

    const selected = candidateMatchups[0];
    if (!selected) break;

    const [pairA, pairB] = selected;
    const usageKey = `${pairA.id}|${pairB.id}`;
    pairingUsageMap.set(usageKey, (pairingUsageMap.get(usageKey) || 0) + 1);

    pairA.players.forEach((player) => {
      matchCountMap.set(player.__id, (matchCountMap.get(player.__id) || 0) + 1);
    });
    pairB.players.forEach((player) => {
      matchCountMap.set(player.__id, (matchCountMap.get(player.__id) || 0) + 1);
    });

    matches.push({
      id: `${pairGroup.teamId}-match-${matches.length + 1}`,
      matchId: `${pairGroup.teamId}-match-${matches.length + 1}`,
      type: "league",
      mode: "정기전",
      scope: "team-internal",
      teamId: pairGroup.teamId,
      teamName: pairGroup.teamName,
      ageBand: pairGroup.ageBand,
      gameType:
        pairA.pairType === pairB.pairType ? pairA.pairType : `${pairA.pairType}/${pairB.pairType}`,
      homeTeamId: pairGroup.teamId,
      awayTeamId: pairGroup.teamId,
      homeTeamName: pairGroup.teamName,
      awayTeamName: pairGroup.teamName,
      team1: {
        id: pairA.id,
        name: pairA.name,
        pairType: pairA.pairType,
        teamName: pairGroup.teamName,
        players: pairA.playerNames,
        members: pairA.players,
        combinedAge: pairA.combinedAge,
      },
      team2: {
        id: pairB.id,
        name: pairB.name,
        pairType: pairB.pairType,
        teamName: pairGroup.teamName,
        players: pairB.playerNames,
        members: pairB.players,
        combinedAge: pairB.combinedAge,
      },
      playerNames: [...pairA.playerNames, ...pairB.playerNames],
      players: [...pairA.playerNames, ...pairB.playerNames],
      scoreA: null,
      scoreB: null,
      homeScore: null,
      awayScore: null,
      score1: null,
      score2: null,
      result: null,
      status: "pending",
      winningScore: DEFAULT_WINNING_SCORE,
    });
  }

  return matches;
}

function buildAllInternalMatches(pairGroups, targetMatchesPerPlayer) {
  return pairGroups.flatMap((pairGroup) => {
    if (!pairGroup.canSchedule) return [];
    return buildTeamInternalMatches(pairGroup, targetMatchesPerPlayer);
  });
}

function chunkMatchesByCourtCount(matches, courtCount) {
  const safeMatches = safeArray(matches);
  const safeCourtCount = Math.max(1, toNumber(courtCount, DEFAULT_COURT_COUNT));
  const rounds = [];

  for (let i = 0; i < safeMatches.length; i += safeCourtCount) {
    rounds.push({
      round: rounds.length + 1,
      matches: safeMatches.slice(i, i + safeCourtCount).map((match, index) => ({
        ...match,
        court: match?.court || index + 1,
      })),
    });
  }

  return rounds;
}

function sortMatchesForRoundDistribution(matches) {
  return [...matches].sort((a, b) => {
    if (a.teamName !== b.teamName) return a.teamName.localeCompare(b.teamName, "ko");
    const aPairA = a.team1?.name || "";
    const bPairA = b.team1?.name || "";
    return aPairA.localeCompare(bPairA, "ko");
  });
}

function normalizeScore(match, winningScore = DEFAULT_WINNING_SCORE) {
  const scoreA = [
    match?.scoreA,
    match?.homeScore,
    match?.score1,
    match?.teamAScore,
    match?.leftScore,
  ]
    .map((value) => toNumber(value, NaN))
    .find(Number.isFinite);

  const scoreB = [
    match?.scoreB,
    match?.awayScore,
    match?.score2,
    match?.teamBScore,
    match?.rightScore,
  ]
    .map((value) => toNumber(value, NaN))
    .find(Number.isFinite);

  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    return { scoreA: null, scoreB: null, played: false };
  }

  if (scoreA === scoreB) {
    return { scoreA, scoreB, played: false };
  }

  if (Math.max(scoreA, scoreB) < winningScore) {
    return { scoreA, scoreB, played: false };
  }

  return { scoreA, scoreB, played: true };
}

function flattenRounds(rounds) {
  return safeArray(rounds).flatMap((round) =>
    Array.isArray(round?.matches) ? round.matches : Array.isArray(round) ? round : []
  );
}

function summarizeLeagueTeams(input) {
  const teams =
    safeArray(input).length && input[0]?.players && input[0]?.name
      ? input
      : createAgeBasedTeams(input);

  return teams.map((team, index) => {
    const genders = countByGender(team.players);

    return {
      order: index + 1,
      id: team.id,
      name: team.name,
      ageBand: team.ageBand,
      playerCount: safeArray(team.players).length,
      maleCount: genders.male,
      femaleCount: genders.female,
      unknownCount: genders.unknown,
      averageLevel:
        team.players.length > 0
          ? Number(
              (
                team.players.reduce((sum, player) => sum + player.levelScore, 0) / team.players.length
              ).toFixed(2)
            )
          : 0,
      players: safeArray(team.players).map((player, playerIndex) => ({
        id: player.__id || player.id || `${team.id}-player-${playerIndex + 1}`,
        name: player.name || getPlayerName(player, playerIndex),
        gender: player.gender || getPlayerGender(player),
        age: player.age || getPlayerAge(player),
        level: player.level || getPlayerLevel(player),
      })),
    };
  });
}

export function buildLeagueStandings(rounds, teamsInput = [], options = {}) {
  const winningScore = Math.max(
    1,
    toNumber(options?.winningScore ?? DEFAULT_WINNING_SCORE, DEFAULT_WINNING_SCORE)
  );
  const matches = flattenRounds(rounds);

  const teamRegistry = new Map();

  safeArray(teamsInput).forEach((team, index) => {
    const players = safeArray(team?.players);
    teamRegistry.set(team.id, {
      id: team.id,
      rank: index + 1,
      teamName: team?.name || `팀 ${index + 1}`,
      ageBand: team?.ageBand || "",
      playerCount: players.length,
      played: 0,
      win: 0,
      lose: 0,
      draw: 0,
      point: 0,
      against: 0,
      pointDiff: 0,
      averageAge:
        players.length > 0
          ? Number((players.reduce((sum, player) => sum + toNumber(player?.age, 0), 0) / players.length).toFixed(2))
          : 0,
    });
  });

  matches.forEach((match) => {
    const teamId = match?.teamId || match?.homeTeamId || match?.awayTeamId;
    if (!teamId || !teamRegistry.has(teamId)) return;

    const result = normalizeScore(match, winningScore);
    if (!result.played) return;

    const teamStanding = teamRegistry.get(teamId);
    teamStanding.played += 1;
    teamStanding.point += result.scoreA;
    teamStanding.against += result.scoreB;

    if (result.scoreA > result.scoreB) {
      teamStanding.win += 1;
    } else if (result.scoreB > result.scoreA) {
      teamStanding.lose += 1;
    } else {
      teamStanding.draw += 1;
    }

    teamStanding.pointDiff = teamStanding.point - teamStanding.against;
  });

  const standings = Array.from(teamRegistry.values()).sort((a, b) => {
    if (b.win !== a.win) return b.win - a.win;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.point !== a.point) return b.point - a.point;
    if (a.averageAge !== b.averageAge) return b.averageAge - a.averageAge;
    return a.teamName.localeCompare(b.teamName, "ko");
  });

  return standings.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export function buildLeagueSchedule(players = [], options = {}) {
  const targetMatchesPerPlayer = Math.max(
    1,
    toNumber(
      options?.targetMatchCount ??
        options?.matchCount ??
        options?.matchesPerPlayer ??
        options?.targetMatchesPerPlayer ??
        DEFAULT_TARGET_MATCHES_PER_PLAYER,
      DEFAULT_TARGET_MATCHES_PER_PLAYER
    )
  );

  const courtCount = Math.max(
    1,
    toNumber(
      options?.courtCount ??
        options?.courts ??
        options?.availableCourts ??
        DEFAULT_COURT_COUNT,
      DEFAULT_COURT_COUNT
    )
  );

  const winningScore = Math.max(
    1,
    toNumber(options?.winningScore ?? DEFAULT_WINNING_SCORE, DEFAULT_WINNING_SCORE)
  );

  const teams = createAgeBasedTeams(players);
  const pairGroups = buildAllFixedPairs(teams, targetMatchesPerPlayer);

  const baseMatches = buildAllInternalMatches(pairGroups, targetMatchesPerPlayer);
  const idealTotalMatches = calcTargetTotalMatches(players, targetMatchesPerPlayer);

  const orderedMatches = sortMatchesForRoundDistribution(baseMatches);
  const limitedMatches =
    idealTotalMatches > 0
      ? orderedMatches.slice(0, Math.min(idealTotalMatches, orderedMatches.length))
      : orderedMatches;

  const matches = limitedMatches.map((match, index) => ({
    ...match,
    order: index + 1,
    winningScore,
  }));

  const rounds = chunkMatchesByCourtCount(matches, courtCount).map((round, roundIndex) => ({
    ...round,
    round: round?.round || roundIndex + 1,
    matches: safeArray(round?.matches).map((match, matchIndex) => ({
      ...match,
      round: round?.round || roundIndex + 1,
      court: match?.court || matchIndex + 1,
      winningScore,
    })),
  }));

  const scheduleTeams = pairGroups.map((pairGroup) => ({
    id: pairGroup.teamId,
    name: pairGroup.teamName,
    ageBand: pairGroup.ageBand,
    players: teams.find((team) => team.id === pairGroup.teamId)?.players || [],
    pairs: pairGroup.pairs,
    reserveTeam: pairGroup.reserveTeam,
    leftovers: pairGroup.leftovers,
    canSchedule: pairGroup.canSchedule,
    isOdd: pairGroup.isOdd,
    meta: pairGroup.meta,
  }));

  return {
    mode: "정기전",
    teams: scheduleTeams,
    teamSummary: summarizeLeagueTeams(teams),
    matches,
    rounds,
    standings: buildLeagueStandings(rounds, scheduleTeams, { winningScore }),
    meta: {
      playerCount: safeArray(players).length,
      teamCount: teams.length,
      targetMatchesPerPlayer,
      targetTotalMatches: idealTotalMatches,
      generatedMatchCount: matches.length,
      courtCount,
      winningScore,
      hasOddTeam: pairGroups.some((pairGroup) => pairGroup.isOdd),
      needsPlayerSupplement: pairGroups.some((pairGroup) => pairGroup.leftovers.length > 0),
      blockedTeams: pairGroups
        .filter((pairGroup) => !pairGroup.canSchedule)
        .map((pairGroup) => ({
          teamId: pairGroup.teamId,
          teamName: pairGroup.teamName,
          reason: "복식조 2개 미만으로 내부 경기 생성 불가",
          pairCount: pairGroup.pairs.length,
          leftoverCount: pairGroup.leftovers.length,
        })),
      supplementTeams: pairGroups
        .filter((pairGroup) => pairGroup.leftovers.length > 0)
        .map((pairGroup) => ({
          teamId: pairGroup.teamId,
          teamName: pairGroup.teamName,
          leftoverCount: pairGroup.leftovers.length,
          reserveTeamName: pairGroup.reserveTeam?.name || "",
          reason: "추가 인원 등록 후 대진표 재생성 권장",
        })),
    },
    summary: `정기전 승리 기준 ${winningScore}점 · 팀 전체 순위 기준`,
  };
}

export default {
  buildLeagueSchedule,
  buildLeagueStandings,
  summarizeLeagueTeams,
};