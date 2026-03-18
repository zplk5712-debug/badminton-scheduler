const MALE_SCORE_BY_GRADE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const FEMALE_SCORE_BY_GRADE = { A: 3.8, B: 2.5, C: 1.8, D: 0.9, E: 0.5 };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGender(gender) {
  const raw = String(gender || "").trim().toLowerCase();
  if (["m", "male", "man", "boy", "남", "남자"].includes(raw)) return "M";
  if (["f", "female", "woman", "girl", "여", "여자"].includes(raw)) return "F";
  return "U";
}

function getBaseScoreByGenderAndGrade(gender, grade) {
  const normalizedGender = normalizeGender(gender);
  const normalizedGrade = String(grade || "").trim().toUpperCase();
  const scoreTable = normalizedGender === "F" ? FEMALE_SCORE_BY_GRADE : MALE_SCORE_BY_GRADE;
  return scoreTable[normalizedGrade] ?? 0;
}

function detectPairTypeFromPlayers(players) {
  const genders = asArray(players)
    .map((player) => normalizeGender(player?.gender))
    .filter((gender) => gender !== "U");
  if (genders.length >= 2) {
    const unique = new Set(genders);
    if (unique.size === 1 && unique.has("M")) return "남복";
    if (unique.size === 1 && unique.has("F")) return "여복";
    if (unique.has("M") && unique.has("F")) return "혼복";
  }
  return "일반복식";
}

function getPairScoreFromPlayers(players) {
  return Number(
    asArray(players)
      .reduce(
        (sum, player) =>
          sum +
          (typeof player?.baseScore === "number" && Number.isFinite(player.baseScore)
            ? player.baseScore
            : getBaseScoreByGenderAndGrade(player?.gender, player?.grade)),
        0
      )
      .toFixed(1)
  );
}

function buildFriendlyMatchLabel(teamA, teamB) {
  const typeA = detectPairTypeFromPlayers(teamA);
  const typeB = detectPairTypeFromPlayers(teamB);
  if (typeA === typeB) return typeA;
  return `${typeA} vs ${typeB}`;
}

export function buildFriendlyManualMatch(teamA, teamB, matchIndex = 0) {
  const pairScoreA = getPairScoreFromPlayers(teamA);
  const pairScoreB = getPairScoreFromPlayers(teamB);

  return {
    id: `friendly-manual-${Date.now()}-${matchIndex + 1}`,
    round: 1,
    court: 1,
    courtId: 1,
    courtLabel: "코트 1",
    matchLabel: buildFriendlyMatchLabel(teamA, teamB),
    teamA,
    teamB,
    teamAName: "TEAM A",
    teamBName: "TEAM B",
    pairScoreA,
    pairScoreB,
    diff: Number(Math.abs(pairScoreA - pairScoreB).toFixed(1)),
    scoreA: "",
    scoreB: "",
    scoreAInput: "",
    scoreBInput: "",
    isManual: true,
  };
}

export function buildRivalryManualMatch(teamA, teamB, matchIndex = 0) {
  const pairScoreA = getPairScoreFromPlayers(teamA);
  const pairScoreB = getPairScoreFromPlayers(teamB);
  const pairTypeA = detectPairTypeFromPlayers(teamA);
  const pairTypeB = detectPairTypeFromPlayers(teamB);
  const matchType = pairTypeA === pairTypeB ? pairTypeA : `${pairTypeA} vs ${pairTypeB}`;

  return {
    id: `rivalry-manual-${Date.now()}-${matchIndex + 1}`,
    round: 1,
    court: 1,
    courtId: 1,
    courtLabel: "코트 1",
    matchType,
    matchLabel: `대항전 ${matchType}`,
    teamA,
    teamB,
    teamAName: String(teamA?.[0]?.rivalryTeam || "A팀"),
    teamBName: String(teamB?.[0]?.rivalryTeam || "B팀"),
    pairScoreA,
    pairScoreB,
    diff: Number(Math.abs(pairScoreA - pairScoreB).toFixed(1)),
    scoreA: "",
    scoreB: "",
    scoreAInput: "",
    scoreBInput: "",
    isManual: true,
    meta: {
      stage: "대항전",
      isManual: true,
    },
  };
}

export function resolveManualPlayersByName(names, rosterByName, options = {}) {
  const {
    mode = "manual",
    side = "A",
    rivalryTeam = "",
    defaultGender = "U",
    defaultGrade = "C",
    defaultAgeGroup = "40대",
  } = options;

  return asArray(names).map((rawName, index) => {
    const name = String(rawName || "").trim();
    const existing = rosterByName.get(name);
    if (existing) return existing;

    return {
      id: `manual-${mode}-${side}-${name}-${Date.now()}-${index + 1}`,
      name,
      gender: defaultGender,
      grade: defaultGrade,
      ageGroup: defaultAgeGroup,
      rivalryTeam: rivalryTeam || undefined,
      baseScore: 0,
      isManualGuest: true,
    };
  });
}
