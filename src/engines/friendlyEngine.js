const MALE_SCORE_BY_GRADE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const FEMALE_SCORE_BY_GRADE = { A: 3.8, B: 2.5, C: 1.8, D: 0.9, E: 0.5 };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toUpperCase();
  if (raw === "M" || raw === "남" || raw === "남자") return "M";
  if (raw === "F" || raw === "여" || raw === "여자") return "F";
  return "U";
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || player.fullName || "";
}

function getPlayerId(player, index = 0) {
  return player?.id || player?.playerId || player?.__id || `${getPlayerName(player)}-${index}`;
}

function getPlayerScore(player) {
  if (typeof player?.baseScore === "number" && Number.isFinite(player.baseScore)) {
    return player.baseScore;
  }

  const normalizedGender = normalizeGender(player?.gender);
  const normalizedGrade = String(player?.grade || "").trim().toUpperCase();
  const scoreTable = normalizedGender === "F" ? FEMALE_SCORE_BY_GRADE : MALE_SCORE_BY_GRADE;
  return scoreTable[normalizedGrade] ?? 0;
}

function getPairType(players) {
  const genders = asArray(players).map((player) => normalizeGender(player?.gender));
  const maleCount = genders.filter((gender) => gender === "M").length;
  const femaleCount = genders.filter((gender) => gender === "F").length;

  if (maleCount === 2) return "NAM";
  if (femaleCount === 2) return "YEO";
  if (maleCount === 1 && femaleCount === 1) return "HON";
  return "MIXED";
}

function getPairTypeLabel(type) {
  return {
    NAM: "남복",
    YEO: "여복",
    HON: "혼복",
  }[type] || "친선전 복식";
}

function getKey(a, b) {
  return [String(a), String(b)].sort().join("::");
}

function getHistoryCount(historyMap, a, b) {
  return historyMap.get(getKey(a, b)) || 0;
}

function incrementHistory(historyMap, a, b) {
  const key = getKey(a, b);
  historyMap.set(key, (historyMap.get(key) || 0) + 1);
}

function normalizePlayers(players) {
  return asArray(players)
    .map((player, index) => ({
      ...player,
      id: getPlayerId(player, index),
      name: getPlayerName(player),
      gender: normalizeGender(player?.gender),
      baseScore: getPlayerScore(player),
    }))
    .filter((player) => player.name);
}

function buildPairCandidates(players, playedMap, partnerHistory, targetMatchCount) {
  const candidates = [];

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const playerA = players[i];
      const playerB = players[j];
      const type = getPairType([playerA, playerB]);
      if (!["NAM", "YEO", "HON"].includes(type)) continue;

      const remainingA = Math.max(0, targetMatchCount - (playedMap.get(playerA.id) || 0));
      const remainingB = Math.max(0, targetMatchCount - (playedMap.get(playerB.id) || 0));
      if (remainingA <= 0 || remainingB <= 0) continue;

      const pairScore = getPlayerScore(playerA) + getPlayerScore(playerB);
      const internalDiff = Math.abs(getPlayerScore(playerA) - getPlayerScore(playerB));
      const partnerRepeat = getHistoryCount(partnerHistory, playerA.id, playerB.id);
      const needScore = remainingA + remainingB;
      const balanceGap = Math.abs(remainingA - remainingB);

      candidates.push({
        id: `${playerA.id}__${playerB.id}`,
        team: [playerA, playerB],
        type,
        score: Number(pairScore.toFixed(1)),
        internalDiff: Number(internalDiff.toFixed(1)),
        partnerRepeat,
        needScore,
        balanceGap,
        sortScore: needScore * 100 - partnerRepeat * 1000 + internalDiff * 20 - balanceGap * 5,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
    if (b.internalDiff !== a.internalDiff) return b.internalDiff - a.internalDiff;
    if (a.partnerRepeat !== b.partnerRepeat) return a.partnerRepeat - b.partnerRepeat;
    return a.score - b.score;
  });
}

function evaluateTypeMatch(pairA, pairB) {
  if (pairA.type === pairB.type) {
    const diff = Math.abs(pairA.score - pairB.score);
    if (diff > 2) return null;
    return { label: getPairTypeLabel(pairA.type), closeness: diff };
  }

  const typeSet = new Set([pairA.type, pairB.type]);
  if (typeSet.has("NAM") && typeSet.has("YEO")) {
    return null;
  }

  if (typeSet.has("HON") && typeSet.has("NAM")) {
    const honPair = pairA.type === "HON" ? pairA : pairB;
    const namPair = pairA.type === "NAM" ? pairA : pairB;
    const diff = namPair.score - honPair.score;
    if (diff < 2 || diff > 4) return null;
    return { label: "혼복 vs 남복", closeness: Math.abs(diff - 2) };
  }

  if (typeSet.has("HON") && typeSet.has("YEO")) {
    const honPair = pairA.type === "HON" ? pairA : pairB;
    const yeoPair = pairA.type === "YEO" ? pairA : pairB;
    const diff = yeoPair.score - honPair.score;
    if (diff < 1 || diff > 3) return null;
    return { label: "혼복 vs 여복", closeness: Math.abs(diff - 1) };
  }

  return null;
}

function buildMatchCandidates(pairCandidates, playedMap, opponentHistory, targetMatchCount) {
  const candidates = [];

  for (let i = 0; i < pairCandidates.length; i += 1) {
    for (let j = i + 1; j < pairCandidates.length; j += 1) {
      const pairA = pairCandidates[i];
      const pairB = pairCandidates[j];
      const ids = [...pairA.team, ...pairB.team].map((player) => player.id);
      if (new Set(ids).size < 4) continue;

      const matchType = evaluateTypeMatch(pairA, pairB);
      if (!matchType) continue;

      let opponentRepeat = 0;
      pairA.team.forEach((playerA) => {
        pairB.team.forEach((playerB) => {
          opponentRepeat += getHistoryCount(opponentHistory, playerA.id, playerB.id);
        });
      });

      const remainingNeed = ids.reduce(
        (sum, id) => sum + Math.max(0, targetMatchCount - (playedMap.get(id) || 0)),
        0
      );

      const score =
        remainingNeed * 1000 -
        (pairA.partnerRepeat + pairB.partnerRepeat) * 300 -
        opponentRepeat * 90 -
        matchType.closeness * 40 +
        (pairA.internalDiff + pairB.internalDiff) * 12;

      candidates.push({
        pairA,
        pairB,
        matchLabel: matchType.label,
        score,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.pairA.score + a.pairB.score !== b.pairA.score + b.pairB.score) {
      return a.pairA.score + a.pairB.score - (b.pairA.score + b.pairB.score);
    }
    return a.matchLabel.localeCompare(b.matchLabel);
  });
}

function selectRoundMatches(players, state, options) {
  const eligiblePlayers = players.filter(
    (player) => (state.playedMap.get(player.id) || 0) < options.targetMatchCount
  );
  if (eligiblePlayers.length < 4) return [];

  const pairCandidates = buildPairCandidates(
    eligiblePlayers,
    state.playedMap,
    state.partnerHistory,
    options.targetMatchCount
  );
  if (pairCandidates.length < 2) return [];

  const matchCandidates = buildMatchCandidates(
    pairCandidates,
    state.playedMap,
    state.opponentHistory,
    options.targetMatchCount
  );
  if (matchCandidates.length === 0) return [];

  const usedThisRound = new Set();
  const selected = [];

  for (const candidate of matchCandidates) {
    const ids = [...candidate.pairA.team, ...candidate.pairB.team].map((player) => player.id);
    if (ids.some((id) => usedThisRound.has(id))) continue;

    selected.push(candidate);
    ids.forEach((id) => usedThisRound.add(id));
    if (selected.length >= options.courtCount) break;
  }

  return selected;
}

function applyRoundResults(selectedMatches, state, roundNo) {
  return selectedMatches.map((candidate, matchIndex) => {
    const courtNo = matchIndex + 1;

    candidate.pairA.team.forEach((player) => {
      state.playedMap.set(player.id, (state.playedMap.get(player.id) || 0) + 1);
    });
    candidate.pairB.team.forEach((player) => {
      state.playedMap.set(player.id, (state.playedMap.get(player.id) || 0) + 1);
    });

    incrementHistory(state.partnerHistory, candidate.pairA.team[0].id, candidate.pairA.team[1].id);
    incrementHistory(state.partnerHistory, candidate.pairB.team[0].id, candidate.pairB.team[1].id);

    candidate.pairA.team.forEach((playerA) => {
      candidate.pairB.team.forEach((playerB) => {
        incrementHistory(state.opponentHistory, playerA.id, playerB.id);
      });
    });

    return {
      id: `friendly-r${roundNo}-c${courtNo}-${candidate.pairA.id}-${candidate.pairB.id}`,
      round: roundNo,
      court: courtNo,
      courtId: courtNo,
      courtLabel: `코트 ${courtNo}`,
      matchLabel: candidate.matchLabel,
      teamA: candidate.pairA.team,
      teamB: candidate.pairB.team,
      teamAName: "TEAM A",
      teamBName: "TEAM B",
      pairScoreA: candidate.pairA.score,
      pairScoreB: candidate.pairB.score,
      diff: Number(Math.abs(candidate.pairA.score - candidate.pairB.score).toFixed(1)),
      scoreA: "",
      scoreB: "",
      scoreAInput: "",
      scoreBInput: "",
    };
  });
}

export function buildFriendlySchedule(players, options = {}) {
  const normalizedPlayers = normalizePlayers(players);
  const targetMatchCount = Math.max(1, Number(options?.targetMatchCount) || 1);
  const courtCount = Math.max(1, Number(options?.courtCount) || 1);

  if (normalizedPlayers.length < 4) return [];

  const state = {
    playedMap: new Map(normalizedPlayers.map((player) => [player.id, 0])),
    partnerHistory: new Map(),
    opponentHistory: new Map(),
  };

  const rounds = [];
  const minimumRoundsNeeded = Math.ceil(
    (normalizedPlayers.length * targetMatchCount) / Math.max(1, courtCount * 4)
  );
  const maxRounds = Math.max(targetMatchCount, minimumRoundsNeeded) + 8;

  for (let roundNo = 1; roundNo <= maxRounds; roundNo += 1) {
    const selectedMatches = selectRoundMatches(normalizedPlayers, state, {
      targetMatchCount,
      courtCount,
    });
    if (selectedMatches.length === 0) break;

    const matches = applyRoundResults(selectedMatches, state, roundNo);
    rounds.push({
      id: `round-${roundNo}`,
      round: roundNo,
      label: `ROUND ${roundNo}`,
      matches,
    });

    const allReachedTarget = normalizedPlayers.every(
      (player) => (state.playedMap.get(player.id) || 0) >= targetMatchCount
    );
    if (allReachedTarget) break;
  }

  return rounds;
}
