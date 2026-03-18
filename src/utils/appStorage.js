export const APP_STORAGE_VERSION = 2;

function buildEmptyState(status) {
  return {
    __storageStatus: status,
    schemaVersion: APP_STORAGE_VERSION,
    selectedMode: null,
    players: [],
    targetMatchCount: undefined,
    courtCount: undefined,
    winningScore: undefined,
    schedule: [],
    leagueInfo: null,
    leagueStandings: [],
    leagueSummary: null,
    activeTab: "players",
  };
}

function safeRemove(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {}
}

export function loadAppState(storageKey, { normalizeSchedule } = {}) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") {
      safeRemove(storageKey);
      return buildEmptyState("corrupted_reset");
    }

    const savedVersion = Number(parsed.schemaVersion) || 0;
    if (savedVersion !== APP_STORAGE_VERSION) {
      safeRemove(storageKey);
      return buildEmptyState("version_reset");
    }

    return {
      __storageStatus: "ok",
      schemaVersion: Number(parsed.schemaVersion) || 0,
      selectedMode: parsed.selectedMode ?? null,
      players: Array.isArray(parsed.players) ? parsed.players : [],
      targetMatchCount: parsed.targetMatchCount,
      courtCount: parsed.courtCount,
      winningScore: parsed.winningScore,
      schedule: Array.isArray(parsed.schedule)
        ? typeof normalizeSchedule === "function"
          ? normalizeSchedule(parsed.schedule)
          : parsed.schedule
        : [],
      leagueInfo: parsed.leagueInfo ?? null,
      leagueStandings: Array.isArray(parsed.leagueStandings) ? parsed.leagueStandings : [],
      leagueSummary: parsed.leagueSummary ?? null,
      activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : "players",
    };
  } catch (error) {
    safeRemove(storageKey);
    return buildEmptyState("corrupted_reset");
  }
}

export function saveAppState(storageKey, state) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        schemaVersion: APP_STORAGE_VERSION,
        ...state,
      })
    );
    return true;
  } catch (error) {
    return false;
  }
}
