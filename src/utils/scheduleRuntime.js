function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPlayerKey(player, index = 0) {
  if (!player) return `player-${index}`;
  if (typeof player === "string") return player;
  return String(player.id || player.__id || player.playerId || player.name || `player-${index}`);
}

function getMatchPlayerKeys(match) {
  return [
    ...asArray(match?.teamA).map((player, index) => getPlayerKey(player, index)),
    ...asArray(match?.teamB).map((player, index) => getPlayerKey(player, index + 2)),
  ].filter(Boolean);
}

function countConflicts(targetKeys, pendingEntries) {
  return pendingEntries.reduce((count, entry) => {
    if (entry.playerKeys.some((key) => targetKeys.includes(key))) {
      return count + 1;
    }
    return count;
  }, 0);
}

function countBlockedPlayers(playerKeys, blockedPlayers) {
  return playerKeys.reduce((count, key) => count + (blockedPlayers.has(key) ? 1 : 0), 0);
}

function pickRoundMatches(pendingMatches, courtCount, blockedPlayers = new Set()) {
  const pendingEntries = pendingMatches.map((match, index) => ({
    index,
    match,
    playerKeys: getMatchPlayerKeys(match),
  }));
  const selected = [];
  const usedPlayers = new Set();
  const remainingIndexes = new Set(pendingEntries.map((entry) => entry.index));

  while (selected.length < courtCount && remainingIndexes.size > 0) {
    const allCandidates = pendingEntries
      .filter((entry) => remainingIndexes.has(entry.index))
      .filter((entry) => entry.playerKeys.every((key) => !usedPlayers.has(key)));

    if (allCandidates.length === 0) break;

    const zeroBlockedCandidates = allCandidates.filter(
      (entry) => countBlockedPlayers(entry.playerKeys, blockedPlayers) === 0
    );
    const candidates =
      zeroBlockedCandidates.length > 0 ? zeroBlockedCandidates : allCandidates;

    candidates.sort((entryA, entryB) => {
      const remainingEntries = pendingEntries.filter(
        (entry) => remainingIndexes.has(entry.index) && entry.index !== entryA.index && entry.index !== entryB.index
      );
      const blockedCountA = countBlockedPlayers(entryA.playerKeys, blockedPlayers);
      const blockedCountB = countBlockedPlayers(entryB.playerKeys, blockedPlayers);
      if (blockedCountA !== blockedCountB) return blockedCountA - blockedCountB;
      const conflictA = countConflicts(entryA.playerKeys, remainingEntries);
      const conflictB = countConflicts(entryB.playerKeys, remainingEntries);
      if (conflictA !== conflictB) return conflictA - conflictB;
      return entryA.index - entryB.index;
    });

    const chosen = candidates[0];
    selected.push(chosen.match);
    chosen.playerKeys.forEach((key) => usedPlayers.add(key));
    remainingIndexes.delete(chosen.index);
  }

  const remaining = pendingEntries
    .filter((entry) => remainingIndexes.has(entry.index))
    .map((entry) => entry.match);

  return { selected, remaining };
}

export function reflowScheduleByCourt(schedule, courtCount) {
  const safeCourtCount = Math.max(1, Number(courtCount) || 1);
  let pending = asArray(schedule).flatMap((round) =>
    asArray(round?.matches).map((match) => ({
      ...match,
      scoreAInput: match?.scoreAInput ?? "",
      scoreBInput: match?.scoreBInput ?? "",
    }))
  );

  if (pending.length === 0) return [];

  const rounds = [];
  let previousRoundPlayers = new Set();

  while (pending.length > 0) {
    const roundNo = rounds.length + 1;
    const { selected, remaining } = pickRoundMatches(pending, safeCourtCount, previousRoundPlayers);
    const roundMatches = selected.length > 0 ? selected : [pending[0]];
    const roundPlayers = new Set(
      roundMatches.flatMap((match) => getMatchPlayerKeys(match))
    );

    rounds.push({
      id: `round-${roundNo}`,
      label: `ROUND ${roundNo}`,
      round: roundNo,
      matches: roundMatches.map((match, index) => ({
        ...match,
        round: roundNo,
        courtId: index + 1,
        court: index + 1,
        courtLabel: `코트 ${index + 1}`,
      })),
    });

    pending = selected.length > 0 ? remaining : pending.slice(1);
    previousRoundPlayers = roundPlayers;
  }

  return rounds;
}
