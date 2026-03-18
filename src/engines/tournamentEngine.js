const MALE_SCORE_BY_GRADE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const FEMALE_SCORE_BY_GRADE = { A: 3.8, B: 2.5, C: 1.8, D: 0.9, E: 0.5 };
const TOURNAMENT_TYPE_ORDER = { NAM: 0, YEO: 1, HON: 2, MIXED: 3 };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toLowerCase();
  if (["m", "male", "man", "boy", "\uB0A8"].includes(raw)) return "M";
  if (["f", "female", "woman", "girl", "\uC5EC"].includes(raw)) return "F";
  return "U";
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || player.fullName || "";
}

function getPlayerId(player, index = 0) {
  return String(player?.id || player?.playerId || player?.__id || `${getPlayerName(player)}-${index}`);
}

function getPlayerScore(player) {
  if (typeof player?.baseScore === "number" && Number.isFinite(player.baseScore)) {
    return player.baseScore;
  }

  const grade = String(player?.grade || "").trim().toUpperCase();
  const table = normalizeGender(player?.gender) === "F" ? FEMALE_SCORE_BY_GRADE : MALE_SCORE_BY_GRADE;
  return table[grade] ?? 0;
}

function getScoreValue(match, key) {
  const values =
    key === "A"
      ? [match?.scoreA, match?.teamAScore, match?.score1, match?.homeScore, match?.scoreAInput]
      : [match?.scoreB, match?.teamBScore, match?.score2, match?.awayScore, match?.scoreBInput];
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function typeFromPlayers(players) {
  const genders = asArray(players).map((player) => normalizeGender(player?.gender));
  const maleCount = genders.filter((gender) => gender === "M").length;
  const femaleCount = genders.filter((gender) => gender === "F").length;

  if (maleCount === 2) return "NAM";
  if (femaleCount === 2) return "YEO";
  if (maleCount === 1 && femaleCount === 1) return "HON";
  return "MIXED";
}

function typeLabel(type) {
  return {
    NAM: "\uB0A8\uBCF5",
    YEO: "\uC5EC\uBCF5",
    HON: "\uD63C\uBCF5",
  }[type] || "\uBCF5\uC2DD";
}

function normalizePlayers(players) {
  return asArray(players)
    .map((player, index) => ({
      ...player,
      id: getPlayerId(player, index),
      name: getPlayerName(player),
      gender: normalizeGender(player?.gender),
      grade: String(player?.grade || "").trim().toUpperCase(),
      ageGroup: String(player?.ageGroup || "").trim() || "\uC77C\uBC18",
      baseScore: getPlayerScore(player),
      pairId: String(player?.pairId || player?.pairKey || "").trim(),
      pairName: String(player?.pairName || "").trim(),
    }))
    .filter((player) => player.name);
}

function getClosestPartnerIndex(basePlayer, candidates) {
  let bestIndex = 0;
  let bestDiff = Infinity;

  candidates.forEach((candidate, index) => {
    const diff = Math.abs((candidate?.baseScore || 0) - (basePlayer?.baseScore || 0));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function buildPairRecord(players, type, ageGroup, grade, pairIndex) {
  const pairName =
    String(players?.[0]?.pairName || players?.[1]?.pairName || "").trim() ||
    players.map((player) => player.name).filter(Boolean).join(" / ");
  const explicitPairId = String(players?.[0]?.pairId || players?.[1]?.pairId || "").trim();

  return {
    id:
      explicitPairId ||
      `${type}-${ageGroup}-${grade}-${pairIndex + 1}-${players.map((player) => player.id).join("-")}`,
    players,
    type,
    ageGroup,
    grade,
    pairName,
    score: Number(players.reduce((sum, player) => sum + (player?.baseScore || 0), 0).toFixed(1)),
  };
}

function buildPairsWithinGroup(players, type, ageGroup, grade) {
  const pool = [...players].sort((a, b) => {
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    return String(a.name).localeCompare(String(b.name), "ko");
  });
  const pairs = [];

  while (pool.length >= 2) {
    const first = pool.shift();
    const partnerIndex = getClosestPartnerIndex(first, pool);
    const second = pool.splice(partnerIndex, 1)[0];
    pairs.push(buildPairRecord([first, second], type, ageGroup, grade, pairs.length));
  }

  return {
    pairs,
    leftovers: pool,
  };
}

function buildTournamentPairs(players) {
  const grouped = new Map();
  const pairBuckets = new Map();

  normalizePlayers(players).forEach((player) => {
    const key = `${player.ageGroup}::${player.grade}`;
    const current = grouped.get(key) || {
      ageGroup: player.ageGroup,
      grade: player.grade,
      male: [],
      female: [],
      fixedPairs: [],
    };

    if (player.pairId) {
      const pairKey = `${key}::${player.pairId}`;
      const bucket = pairBuckets.get(pairKey) || {
        ageGroup: player.ageGroup,
        grade: player.grade,
        players: [],
      };
      bucket.players.push(player);
      pairBuckets.set(pairKey, bucket);
      grouped.set(key, current);
      return;
    }

    if (player.gender === "M") current.male.push(player);
    if (player.gender === "F") current.female.push(player);
    grouped.set(key, current);
  });

  const pairs = [];

  pairBuckets.forEach((bucket) => {
    const key = `${bucket.ageGroup}::${bucket.grade}`;
    const current = grouped.get(key) || {
      ageGroup: bucket.ageGroup,
      grade: bucket.grade,
      male: [],
      female: [],
      fixedPairs: [],
    };

    if (bucket.players.length === 2) {
      const type = typeFromPlayers(bucket.players);
      current.fixedPairs.push(
        buildPairRecord(bucket.players, type, bucket.ageGroup, bucket.grade, current.fixedPairs.length)
      );
    } else {
      bucket.players.forEach((player) => {
        if (player.gender === "M") current.male.push(player);
        if (player.gender === "F") current.female.push(player);
      });
    }

    grouped.set(key, current);
  });

  grouped.forEach((group) => {
    pairs.push(...asArray(group.fixedPairs));

    const maleResult = buildPairsWithinGroup(group.male, "NAM", group.ageGroup, group.grade);
    const femaleResult = buildPairsWithinGroup(group.female, "YEO", group.ageGroup, group.grade);

    pairs.push(...maleResult.pairs, ...femaleResult.pairs);

    const leftoverMales = [...maleResult.leftovers];
    const leftoverFemales = [...femaleResult.leftovers];

    while (leftoverMales.length > 0 && leftoverFemales.length > 0) {
      const male = leftoverMales.shift();
      const partnerIndex = getClosestPartnerIndex(male, leftoverFemales);
      const female = leftoverFemales.splice(partnerIndex, 1)[0];
      pairs.push(buildPairRecord([male, female], "HON", group.ageGroup, group.grade, pairs.length));
    }
  });

  return pairs;
}

function splitPoolSizes(total) {
  if (total <= 4) return [total];
  if (total === 5) return [5];
  if (total % 3 === 0) {
    return Array.from({ length: total / 3 }, () => 3);
  }
  if (total % 3 === 1) {
    return [...Array.from({ length: (total - 4) / 3 }, () => 3), 4];
  }
  if (total % 3 === 2 && total >= 8) {
    return [...Array.from({ length: (total - 8) / 3 }, () => 3), 4, 4];
  }
  return [total];
}

function buildPools(pairs) {
  const sizes = splitPoolSizes(pairs.length);
  const pools = sizes.map((size, index) => ({
    name: `${String.fromCharCode(65 + index)}조`,
    size,
    pairs: [],
  }));
  const ordered = [...pairs].sort((a, b) => b.score - a.score);

  let poolIndex = 0;
  let direction = 1;
  ordered.forEach((pair) => {
    let guard = 0;
    while (pools[poolIndex].pairs.length >= pools[poolIndex].size && guard < pools.length * 2) {
      if (direction === 1) {
        poolIndex = poolIndex === pools.length - 1 ? 0 : poolIndex + 1;
      } else {
        poolIndex = poolIndex === 0 ? pools.length - 1 : poolIndex - 1;
      }
      guard += 1;
    }

    pools[poolIndex].pairs.push(pair);

    if (direction === 1) {
      if (poolIndex === pools.length - 1) {
        direction = -1;
      } else {
        poolIndex += 1;
      }
    } else if (poolIndex === 0) {
      direction = 1;
    } else {
      poolIndex -= 1;
    }
  });

  return pools.filter((pool) => pool.pairs.length > 0);
}

function buildRoundRobinRounds(pairs) {
  const entries = [...pairs];
  if (entries.length < 2) return [];
  const hasBye = entries.length % 2 === 1;
  if (hasBye) {
    entries.push({ id: "__bye__", isBye: true });
  }

  const rounds = [];
  const rotation = [...entries];
  const roundCount = rotation.length - 1;
  const half = rotation.length / 2;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const pairings = [];
    for (let index = 0; index < half; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (left?.isBye || right?.isBye) continue;
      pairings.push([left, right]);
    }
    rounds.push(pairings);

    const fixed = rotation[0];
    const moving = rotation.slice(1);
    moving.unshift(moving.pop());
    rotation.splice(0, rotation.length, fixed, ...moving);
  }

  return rounds;
}

function createPlaceholderPair(label, id) {
  return {
    id,
    players: [label],
    score: 0,
  };
}

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

function getKnockoutStageLabel(stageSize) {
  if (stageSize <= 2) return "결승";
  if (stageSize === 4) return "4강";
  return `${stageSize}강`;
}

function createTournamentMatch(pairA, pairB, metadata, matchIndex) {
  return {
    id: metadata.matchKey || `tournament-${metadata.groupId}-${metadata.localRound}-${matchIndex + 1}-${pairA.id}-${pairB.id}`,
    matchLabel: metadata.label,
    gameType: metadata.typeLabel,
    category: metadata.categoryLabel,
    teamName: metadata.categoryLabel,
    tournamentStage: metadata.stage || "예선",
    tournamentCategoryKey: metadata.categoryKey || "",
    tournamentCategoryLabel: metadata.categoryLabel || metadata.label,
    tournamentPoolKey: metadata.poolKey || "",
    tournamentPoolName: metadata.poolName || "",
    tournamentBracketRound: metadata.bracketRound || 0,
    tournamentMatchKey: metadata.matchKey || "",
    tournamentSourceA: metadata.sourceA || null,
    tournamentSourceB: metadata.sourceB || null,
    teamA: pairA.players,
    teamB: pairB.players,
    teamAName: "PAIR A",
    teamBName: "PAIR B",
    pairScoreA: pairA.score,
    pairScoreB: pairB.score,
    diff: Number(Math.abs(pairA.score - pairB.score).toFixed(1)),
    scoreA: "",
    scoreB: "",
    scoreAInput: "",
    scoreBInput: "",
    status: "pending",
  };
}

function buildKnockoutRounds(group, pools) {
  if (pools.length < 2) return [];

  const qualifierCount = pools.length;
  const bracketSize = nextPowerOfTwo(qualifierCount);
  const byeCount = bracketSize - qualifierCount;
  const categoryLabel = `${typeLabel(group.type)} ${group.ageGroup} ${group.grade} 본선`;
  const rounds = [];
  let bracketRound = 1;

  let currentEntries = Array.from({ length: qualifierCount }, (_, index) => {
    const seedNo = index + 1;
    return {
      kind: "seed",
      seedNo,
      label: `시드 ${seedNo}`,
      pair: createPlaceholderPair(`시드 ${seedNo}`, `${group.key}-seed-${seedNo}`),
    };
  });
  while (currentEntries.length < bracketSize) {
    currentEntries.push({
      kind: "bye",
      label: "부전승",
      pair: createPlaceholderPair("부전승", `${group.key}-bye-${currentEntries.length + 1}`),
    });
  }

  while (currentEntries.length >= 2) {
    const stageSize = currentEntries.length;
    const stageLabel = getKnockoutStageLabel(stageSize);
    const matches = [];
    const nextEntries = [];

    for (let index = 0; index < stageSize / 2; index += 1) {
      const entryA = currentEntries[index];
      const entryB = currentEntries[stageSize - 1 - index];

      if (entryA.kind === "bye" && entryB.kind === "bye") continue;
      if (entryA.kind === "bye") {
        nextEntries.push({
          kind: entryB.kind,
          seedNo: entryB.seedNo,
          matchKey: entryB.matchKey,
          label: entryB.label,
          pair: entryB.pair,
        });
        continue;
      }
      if (entryB.kind === "bye") {
        nextEntries.push({
          kind: entryA.kind,
          seedNo: entryA.seedNo,
          matchKey: entryA.matchKey,
          label: entryA.label,
          pair: entryA.pair,
        });
        continue;
      }

      const matchKey = `${group.key}-bracket-r${bracketRound}-m${index + 1}`;
      matches.push(
        createTournamentMatch(
          entryA.pair,
          entryB.pair,
          {
            groupId: `${group.key}-bracket-${bracketRound}`,
            localRound: bracketRound,
            label: stageLabel,
            typeLabel: stageLabel,
            categoryKey: group.key,
            categoryLabel,
            stage: "본선",
            poolKey: `${group.key}-final`,
            poolName: "본선",
            bracketRound,
            matchKey,
            sourceA:
              entryA.kind === "seed"
                ? { type: "seed", categoryKey: group.key, seedNo: entryA.seedNo, label: entryA.label }
                : { type: "matchWinner", matchKey: entryA.matchKey, label: entryA.label },
            sourceB:
              entryB.kind === "seed"
                ? { type: "seed", categoryKey: group.key, seedNo: entryB.seedNo, label: entryB.label }
                : { type: "matchWinner", matchKey: entryB.matchKey, label: entryB.label },
          },
          index
        )
      );

      nextEntries.push({
        kind: "winner",
        seedNo: null,
        matchKey,
        label: `승자 ${stageLabel} ${index + 1}`,
        pair: createPlaceholderPair(`승자 ${stageLabel} ${index + 1}`, `${matchKey}-winner`),
      });
    }

    if (matches.length > 0) {
      rounds.push({
        groupId: `${group.key}-bracket-${bracketRound}`,
        localRound: bracketRound,
        label: stageLabel,
        matches,
      });
    }

    currentEntries = nextEntries;
    bracketRound += 1;
  }

  return rounds;
}

function scheduleMatchesToRounds(logicalRounds, courtCount) {
  const scheduledRounds = [];
  let globalRoundIndex = 0;

  logicalRounds.forEach((logicalRound, logicalIndex) => {
    const labelBase = String(
      logicalRound?.label ||
        logicalRound?.matches?.[0]?.tournamentPoolName ||
        logicalRound?.matches?.[0]?.gameType ||
        `ROUND ${logicalIndex + 1}`
    ).trim();

    for (let offset = 0; offset < logicalRound.matches.length; offset += courtCount) {
      globalRoundIndex += 1;
      const chunk = logicalRound.matches.slice(offset, offset + courtCount);
      const chunkIndex = Math.floor(offset / courtCount);
      scheduledRounds.push({
        id: `round-${globalRoundIndex}`,
        label: chunkIndex > 0 ? `${labelBase} ${chunkIndex + 1}` : labelBase,
        round: globalRoundIndex,
        matches: chunk.map((match, matchIndex) => ({
          ...match,
          round: globalRoundIndex,
          court: matchIndex + 1,
          courtId: matchIndex + 1,
          courtLabel: `코트 ${matchIndex + 1}`,
        })),
      });
    }
  });

  return scheduledRounds;
}

function getPairKeyFromTeam(team) {
  const names = asArray(team).map(getPlayerName).filter(Boolean);
  return names.join(" / ");
}

function buildTournamentPoolStandings(schedule) {
  const poolMap = new Map();

  asArray(schedule).forEach((round) => {
    asArray(round?.matches).forEach((match) => {
      if (match?.tournamentStage !== "예선") return;
      const poolKey = String(match?.tournamentPoolKey || "").trim();
      if (!poolKey) return;

      const current = poolMap.get(poolKey) || new Map();
      const pairKeyA = getPairKeyFromTeam(match?.teamA);
      const pairKeyB = getPairKeyFromTeam(match?.teamB);
      if (!pairKeyA || !pairKeyB) return;

      const pairA = current.get(pairKeyA) || {
        key: pairKeyA,
        team: match?.teamA,
        categoryKey: match?.tournamentCategoryKey || "",
        win: 0,
        loss: 0,
        draw: 0,
        scored: 0,
        allowed: 0,
      };
      const pairB = current.get(pairKeyB) || {
        key: pairKeyB,
        team: match?.teamB,
        categoryKey: match?.tournamentCategoryKey || "",
        win: 0,
        loss: 0,
        draw: 0,
        scored: 0,
        allowed: 0,
      };

      const scoreA = getScoreValue(match, "A");
      const scoreB = getScoreValue(match, "B");

      if (scoreA !== null && scoreB !== null) {
        pairA.scored += scoreA;
        pairA.allowed += scoreB;
        pairB.scored += scoreB;
        pairB.allowed += scoreA;

        if (scoreA > scoreB) {
          pairA.win += 1;
          pairB.loss += 1;
        } else if (scoreB > scoreA) {
          pairB.win += 1;
          pairA.loss += 1;
        } else {
          pairA.draw += 1;
          pairB.draw += 1;
        }
      }

      current.set(pairKeyA, pairA);
      current.set(pairKeyB, pairB);
      poolMap.set(poolKey, current);
    });
  });

  const winnerMap = new Map();
  const categoryWinnerMap = new Map();

  poolMap.forEach((pool, poolKey) => {
    const ranked = Array.from(pool.values()).sort((a, b) => {
      if (b.win !== a.win) return b.win - a.win;
      const diffA = a.scored - a.allowed;
      const diffB = b.scored - b.allowed;
      if (diffB !== diffA) return diffB - diffA;
      if (b.scored !== a.scored) return b.scored - a.scored;
      return String(a.key).localeCompare(String(b.key), "ko");
    });
    if (ranked.length > 0) {
      const winner = ranked[0];
      winnerMap.set(poolKey, winner);
      const categoryKey = String(winner?.categoryKey || "").trim();
      const categoryList = categoryWinnerMap.get(categoryKey) || [];
      categoryList.push(winner);
      categoryWinnerMap.set(categoryKey, categoryList);
    }
  });

  categoryWinnerMap.forEach((list, categoryKey) => {
    categoryWinnerMap.set(
      categoryKey,
      list.sort((a, b) => {
        if (b.win !== a.win) return b.win - a.win;
        const diffA = a.scored - a.allowed;
        const diffB = b.scored - b.allowed;
        if (diffB !== diffA) return diffB - diffA;
        if (b.scored !== a.scored) return b.scored - a.scored;
        return String(a.key).localeCompare(String(b.key), "ko");
      })
    );
  });

  return { winnerMap, categoryWinnerMap };
}

function sameTeamIdentity(teamA, teamB) {
  return getPairKeyFromTeam(teamA) === getPairKeyFromTeam(teamB);
}

function getWinnerTeam(match) {
  const scoreA = getScoreValue(match, "A");
  const scoreB = getScoreValue(match, "B");
  if (scoreA === null || scoreB === null || scoreA === scoreB) return null;
  return scoreA > scoreB ? match?.teamA : match?.teamB;
}

export function applyTournamentProgression(schedule) {
  const { winnerMap: poolWinners, categoryWinnerMap } = buildTournamentPoolStandings(schedule);
  const winnerByMatchKey = new Map();

  const clonedSchedule = asArray(schedule).map((round) => ({
    ...round,
    matches: asArray(round?.matches).map((match) => ({ ...match })),
  }));

  const bracketMatches = clonedSchedule
    .flatMap((round) => asArray(round?.matches))
    .filter((match) => match?.tournamentStage === "본선")
    .sort((a, b) => (Number(a?.tournamentBracketRound) || 0) - (Number(b?.tournamentBracketRound) || 0));

  bracketMatches.forEach((match) => {
    const sourceA = match?.tournamentSourceA;
    const sourceB = match?.tournamentSourceB;

    let nextTeamA = match?.teamA;
    let nextTeamB = match?.teamB;

    if (sourceA?.type === "poolWinner") {
      nextTeamA = poolWinners.get(sourceA.poolKey)?.team || [sourceA.label || "조 1위"];
    } else if (sourceA?.type === "seed") {
      nextTeamA =
        categoryWinnerMap.get(sourceA.categoryKey)?.[Math.max(0, Number(sourceA.seedNo) - 1)]?.team ||
        [sourceA.label || `시드 ${sourceA.seedNo}`];
    } else if (sourceA?.type === "matchWinner") {
      nextTeamA = winnerByMatchKey.get(sourceA.matchKey) || [sourceA.label || "승자"];
    }

    if (sourceB?.type === "poolWinner") {
      nextTeamB = poolWinners.get(sourceB.poolKey)?.team || [sourceB.label || "조 1위"];
    } else if (sourceB?.type === "seed") {
      nextTeamB =
        categoryWinnerMap.get(sourceB.categoryKey)?.[Math.max(0, Number(sourceB.seedNo) - 1)]?.team ||
        [sourceB.label || `시드 ${sourceB.seedNo}`];
    } else if (sourceB?.type === "matchWinner") {
      nextTeamB = winnerByMatchKey.get(sourceB.matchKey) || [sourceB.label || "승자"];
    }

    const teamsChanged = !sameTeamIdentity(match?.teamA, nextTeamA) || !sameTeamIdentity(match?.teamB, nextTeamB);

    match.teamA = nextTeamA;
    match.teamB = nextTeamB;
    match.pairScoreA = 0;
    match.pairScoreB = 0;
    match.diff = 0;

    if (teamsChanged) {
      match.scoreA = "";
      match.scoreB = "";
      match.scoreAInput = "";
      match.scoreBInput = "";
      match.status = "pending";
      match.result = null;
    }

    const winner = getWinnerTeam(match);
    if (winner) {
      winnerByMatchKey.set(match.tournamentMatchKey, winner);
    }
  });

  return clonedSchedule;
}

export function buildTournamentSchedule(players, options = {}) {
  const courtCount = Math.max(1, Number(options?.courtCount) || 1);
  const pairs = buildTournamentPairs(players);
  if (pairs.length < 2) return [];

  const categoryGroups = new Map();
  pairs.forEach((pair) => {
    const key = `${pair.type}::${pair.ageGroup}::${pair.grade}`;
    const current = categoryGroups.get(key) || {
      key,
      type: pair.type,
      ageGroup: pair.ageGroup,
      grade: pair.grade,
      pairs: [],
    };
    current.pairs.push(pair);
    categoryGroups.set(key, current);
  });

  const logicalRounds = [];

  Array.from(categoryGroups.values())
    .sort((a, b) => {
      const typeDiff =
        (TOURNAMENT_TYPE_ORDER[a.type] ?? 99) - (TOURNAMENT_TYPE_ORDER[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;
      if (a.ageGroup !== b.ageGroup) return String(a.ageGroup).localeCompare(String(b.ageGroup), "ko");
      if (a.grade !== b.grade) return String(a.grade).localeCompare(String(b.grade), "ko");
      return String(a.key).localeCompare(String(b.key), "ko");
    })
    .forEach((group) => {
      const pools = buildPools(group.pairs);
      const categoryLabel = `${typeLabel(group.type)} ${group.ageGroup} ${group.grade}`;

      pools.forEach((pool, poolIndex) => {
        const poolKey = `${group.key}-pool-${poolIndex + 1}`;
        const roundRobinRounds = buildRoundRobinRounds(pool.pairs);
        const label = `${categoryLabel} ${pool.name}`;

        roundRobinRounds.forEach((pairings, roundIndex) => {
          logicalRounds.push({
            groupId: `${group.key}-${poolIndex + 1}`,
            localRound: roundIndex + 1,
            label: pool.name,
            matches: pairings.map(([pairA, pairB], matchIndex) =>
              createTournamentMatch(
                pairA,
                pairB,
                {
                  groupId: `${group.key}-${poolIndex + 1}`,
                  localRound: roundIndex + 1,
                  label,
                  typeLabel: typeLabel(group.type),
                  categoryKey: group.key,
                  categoryLabel,
                  stage: "예선",
                  poolKey,
                  poolName: pool.name,
                },
                matchIndex
              )
            ),
          });
        });
      });

      logicalRounds.push(...buildKnockoutRounds(group, pools));
    });

  return applyTournamentProgression(scheduleMatchesToRounds(logicalRounds, courtCount));
}
