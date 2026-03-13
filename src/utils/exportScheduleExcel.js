export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getTeamMembers(team) {
  if (!team) return [];
  if (Array.isArray(team)) return team;
  if (Array.isArray(team.players)) return team.players;
  if (Array.isArray(team.members)) return team.members;
  if (Array.isArray(team.team)) return team.team;
  return [];
}

function getPlayerName(player) {
  if (!player) return "";
  if (typeof player === "string") return player;
  return player.name || player.playerName || player.nickname || player.fullName || "";
}

function normalizeTeamDisplay(team, fallbackLabel) {
  if (!team) return { main: fallbackLabel, sub: "" };

  if (typeof team === "string") {
    return { main: team, sub: "" };
  }

  const members = getTeamMembers(team).map(getPlayerName).filter(Boolean);
  const teamName = team.name || team.teamName || team.label || team.title || "";

  if (members.length === 1) {
    return {
      main: members[0],
      sub: teamName && teamName !== members[0] ? teamName : "",
    };
  }

  if (members.length >= 2) {
    return {
      main: members.slice(0, 2).join(" / "),
      sub: members.slice(2).join(" / ") || teamName || "",
    };
  }

  if (teamName) {
    return { main: teamName, sub: "" };
  }

  return { main: fallbackLabel, sub: "" };
}

function getTeamText(team, fallbackLabel) {
  const normalized = normalizeTeamDisplay(team, fallbackLabel);
  return [normalized.main, normalized.sub].filter(Boolean).join("\n");
}

function getCourtLabel(match, index) {
  const raw =
    match?.courtLabel ??
    match?.courtName ??
    match?.court ??
    match?.courtId ??
    match?.courtNumber ??
    match?.courtNo;

  if (raw === undefined || raw === null || raw === "") {
    return `肄뷀듃 ${index + 1}`;
  }

  if (typeof raw === "number") {
    return `肄뷀듃 ${raw}`;
  }

  const text = String(raw).trim();
  if (text.includes("肄뷀듃")) return text;
  return `肄뷀듃 ${text}`;
}

function getMatchType(match, modeLabel) {
  return (
    match?.gameType ||
    match?.pairType ||
    match?.matchType ||
    match?.matchLabel ||
    match?.type ||
    match?.category ||
    modeLabel ||
    "寃쎄린"
  );
}

function getScoreA(match) {
  const candidates = [
    match?.scoreA,
    match?.teamAScore,
    match?.homeScore,
    match?.score1,
    match?.leftScore,
  ];

  for (const value of candidates) {
    if (value !== null && typeof value !== "undefined" && value !== "") {
      return String(value);
    }
  }

  return "";
}

function getScoreB(match) {
  const candidates = [
    match?.scoreB,
    match?.teamBScore,
    match?.awayScore,
    match?.score2,
    match?.rightScore,
  ];

  for (const value of candidates) {
    if (value !== null && typeof value !== "undefined" && value !== "") {
      return String(value);
    }
  }

  return "";
}

function isCompletedMatch(match, winningScore = 25) {
  const scoreA = Number(getScoreA(match));
  const scoreB = Number(getScoreB(match));
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return false;
  if (scoreA === scoreB) return false;
  return Math.max(scoreA, scoreB) >= winningScore;
}

function getTodayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildExportFileName(modeLabel) {
  const safeMode = (modeLabel || "schedule").replace(/[\\/:*?[\]]/g, "_");
  return `badminton_${safeMode}_${getTodayText()}.xlsx`;
}

function applyCellBorder(cell, color = "D1D5DB", style = "thin") {
  cell.border = {
    top: { style, color: { argb: color } },
    left: { style, color: { argb: color } },
    bottom: { style, color: { argb: color } },
    right: { style, color: { argb: color } },
  };
}

function applyCenter(cell) {
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
}

function applyLeft(cell) {
  cell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
  };
}

function setFill(cell, argb) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  };
}

function setPrintArea(sheet, lastRow, lastColumnLetter) {
  sheet.pageSetup.printArea = `A1:${lastColumnLetter}${Math.max(1, lastRow)}`;
}

function getExcelColumnLetter(columnNumber) {
  let dividend = columnNumber;
  let columnName = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

function getPairLine(pair, index) {
  const names = asArray(pair?.players).map(getPlayerName).filter(Boolean);
  const genders = asArray(pair?.players)
    .map((player) => String(player?.gender || "").trim().toUpperCase())
    .filter(Boolean);
  let resolvedType = "";

  if (genders.length >= 2) {
    const unique = new Set(genders);
    if (unique.size === 1 && unique.has("M")) resolvedType = "남복";
    else if (unique.size === 1 && unique.has("F")) resolvedType = "여복";
    else if (unique.has("M") && unique.has("F")) resolvedType = "혼복";
  }

  if (!resolvedType) {
    const rawType = String(pair?.pairType || "").trim();
    const genericTypes = new Set(["일반복식", "복식", "doubles", "일반"]);
    resolvedType = rawType && !genericTypes.has(rawType.toLowerCase()) ? rawType : "";
  }

  if (names.length > 0) {
    return `${index + 1}. ${names.join(", ")}${resolvedType ? ` (${resolvedType})` : ""}`;
  }
  return `${index + 1}.`;
}

export async function exportScheduleWorkbook({
  modeLabel,
  players,
  targetMatchCount,
  courtCount,
  roundItems,
  leagueStandings,
  leagueSummary,
  leagueTeams = [],
  winningScore = 25,
}) {
  const excelModule = await import("exceljs");
  const fileSaverModule = await import("file-saver");

  const ExcelJS = excelModule.default || excelModule;
  const saveAs =
    fileSaverModule.saveAs ||
    fileSaverModule.default?.saveAs ||
    fileSaverModule.default;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OpenAI";
  workbook.lastModifiedBy = "OpenAI";
  workbook.created = new Date();
  workbook.modified = new Date();

  const boardSheet = workbook.addWorksheet("Round Board", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.3,
        bottom: 0.3,
        header: 0.15,
        footer: 0.15,
      },
      horizontalCentered: true,
      verticalCentered: false,
    },
  });

  const summarySheet = workbook.addWorksheet("Match Summary", {
    views: [{ state: "frozen", ySplit: 2 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  const teamSheet =
    Array.isArray(leagueTeams) && leagueTeams.length > 0
      ? workbook.addWorksheet("Team Composition", {
          pageSetup: {
            orientation: "portrait",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
              left: 0.3,
              right: 0.3,
              top: 0.35,
              bottom: 0.35,
              header: 0.2,
              footer: 0.2,
            },
          },
        })
      : null;

  const maxBlocksPerRow = 4;
  const blockColumnSize = 8;
  const gapColumnSize = 1;
  const totalColumns = maxBlocksPerRow * blockColumnSize + (maxBlocksPerRow - 1) * gapColumnSize;

  for (let blockIndex = 0; blockIndex < maxBlocksPerRow; blockIndex += 1) {
    const startColumn = blockIndex * (blockColumnSize + gapColumnSize) + 1;

    boardSheet.getColumn(startColumn).width = 9;
    boardSheet.getColumn(startColumn + 1).width = 18;
    boardSheet.getColumn(startColumn + 2).width = 7;
    boardSheet.getColumn(startColumn + 3).width = 5.5;
    boardSheet.getColumn(startColumn + 4).width = 7;
    boardSheet.getColumn(startColumn + 5).width = 18;
    boardSheet.getColumn(startColumn + 6).width = 1.6;
    boardSheet.getColumn(startColumn + 7).width = 1.6;

    if (blockIndex < maxBlocksPerRow - 1) {
      boardSheet.getColumn(startColumn + blockColumnSize).width = 1.8;
    }
  }

  boardSheet.mergeCells(1, 1, 1, totalColumns);
  const titleCell = boardSheet.getCell(1, 1);
  titleCell.value = `Badminton ${modeLabel || "Schedule"} Match Board`;
  titleCell.font = { size: 18, bold: true, color: { argb: "0F172A" } };
  setFill(titleCell, "DBEAFE");
  applyCenter(titleCell);
  applyCellBorder(titleCell, "93C5FD", "medium");
  boardSheet.getRow(1).height = 28;

  boardSheet.mergeCells(2, 1, 2, totalColumns);
  const subCell = boardSheet.getCell(2, 1);
  subCell.value = `Date ${getTodayText()}   |   Players ${players.length}   |   Target matches ${Math.max(
    1,
    Number(targetMatchCount) || 1
  )}   |   Courts ${Math.max(1, Number(courtCount) || 1)}`;
  subCell.font = { size: 10, bold: true, color: { argb: "334155" } };
  setFill(subCell, "EFF6FF");
  applyCenter(subCell);
  applyCellBorder(subCell, "BFDBFE");
  boardSheet.getRow(2).height = 20;

  boardSheet.mergeCells(3, 1, 3, totalColumns);
  const guideCell = boardSheet.getCell(3, 1);
  guideCell.value = `Print and score input sheet | Up to 4 courts per row | Winning score ${winningScore}`;
  guideCell.font = { size: 9, bold: true, color: { argb: "475569" } };
  setFill(guideCell, "F8FAFC");
  applyCenter(guideCell);
  applyCellBorder(guideCell, "E2E8F0");
  boardSheet.getRow(3).height = 18;

  let currentRow = 5;

  roundItems.forEach((round, roundIndex) => {
    boardSheet.mergeCells(currentRow, 1, currentRow, totalColumns);
    const roundCell = boardSheet.getCell(currentRow, 1);
    roundCell.value = round?.label || `ROUND ${roundIndex + 1}`;
    roundCell.font = { size: 15, bold: true, color: { argb: "FFFFFF" } };
    setFill(roundCell, "2563EB");
    applyLeft(roundCell);
    applyCellBorder(roundCell, "1D4ED8", "medium");
    boardSheet.getRow(currentRow).height = 24;
    currentRow += 1;

    const matches = asArray(round?.matches);

    for (let startIndex = 0; startIndex < matches.length; startIndex += maxBlocksPerRow) {
      const chunk = matches.slice(startIndex, startIndex + maxBlocksPerRow);

      chunk.forEach((match, chunkIndex) => {
        const blockStart = 1 + chunkIndex * (blockColumnSize + gapColumnSize);
        const blockEnd = blockStart + 5;

        boardSheet.mergeCells(currentRow, blockStart, currentRow, blockEnd);
        const blockTitleCell = boardSheet.getCell(currentRow, blockStart);
        blockTitleCell.value = `${getCourtLabel(match, startIndex + chunkIndex)} 쨌 ${getMatchType(
          match,
          modeLabel
        )}`;
        blockTitleCell.font = { size: 11, bold: true, color: { argb: "0F172A" } };
        setFill(blockTitleCell, "E0F2FE");
        applyCenter(blockTitleCell);
        applyCellBorder(blockTitleCell, "93C5FD", "medium");

        const headerLabels = ["Court", "TEAM A", "A Score", "VS", "B Score", "TEAM B"];
        headerLabels.forEach((label, offset) => {
          const cell = boardSheet.getCell(currentRow + 1, blockStart + offset);
          cell.value = label;
          cell.font = { size: 9, bold: true, color: { argb: "334155" } };
          setFill(cell, "F8FAFC");
          applyCenter(cell);
          applyCellBorder(cell, "CBD5E1");
        });

        const teamA = getTeamText(
          match?.teamA || match?.leftTeam || match?.homeTeam || match?.team1,
          "TEAM A"
        );
        const teamB = getTeamText(
          match?.teamB || match?.rightTeam || match?.awayTeam || match?.team2,
          "TEAM B"
        );
        const scoreA = getScoreA(match);
        const scoreB = getScoreB(match);
        const completed = isCompletedMatch(match, winningScore);

        const values = [
          getCourtLabel(match, startIndex + chunkIndex),
          teamA,
          scoreA,
          "VS",
          scoreB,
          teamB,
        ];

        values.forEach((value, offset) => {
          const cell = boardSheet.getCell(currentRow + 2, blockStart + offset);
          cell.value = value;

          if (offset === 2 || offset === 4) {
            cell.font = {
              size: 14,
              bold: true,
              color: { argb: value ? "0F172A" : "64748B" },
            };
            setFill(cell, completed ? "DCFCE7" : "FEF3C7");
            applyCenter(cell);
            applyCellBorder(cell, completed ? "22C55E" : "D6D3B1", "medium");
          } else if (offset === 3) {
            cell.font = { size: 12, bold: true, color: { argb: "334155" } };
            setFill(cell, "F1F5F9");
            applyCenter(cell);
            applyCellBorder(cell, "CBD5E1");
          } else if (offset === 1 || offset === 5) {
            cell.font = { size: 10, bold: false, color: { argb: "0F172A" } };
            setFill(cell, "FFFFFF");
            applyLeft(cell);
            applyCellBorder(cell, "CBD5E1");
          } else {
            cell.font = { size: 10, bold: true, color: { argb: "334155" } };
            setFill(cell, "FFFFFF");
            applyCenter(cell);
            applyCellBorder(cell, "CBD5E1");
          }
        });

        for (let row = currentRow; row <= currentRow + 2; row += 1) {
          const leftCell = boardSheet.getCell(row, blockStart);
          const rightCell = boardSheet.getCell(row, blockEnd);
          leftCell.border = {
            ...leftCell.border,
            left: { style: "medium", color: { argb: "93C5FD" } },
          };
          rightCell.border = {
            ...rightCell.border,
            right: { style: "medium", color: { argb: "93C5FD" } },
          };
        }
      });

      boardSheet.getRow(currentRow).height = 22;
      boardSheet.getRow(currentRow + 1).height = 20;
      boardSheet.getRow(currentRow + 2).height = 48;
      currentRow += 4;
    }

    currentRow += 1;
  });

  const boardLastColumnLetter = getExcelColumnLetter(totalColumns);
  setPrintArea(boardSheet, currentRow - 1, boardLastColumnLetter);

  summarySheet.columns = [
    { header: "ROUND", key: "round", width: 12 },
    { header: "肄뷀듃", key: "court", width: 11 },
    { header: "寃쎄린醫낅쪟", key: "type", width: 14 },
    { header: "TEAM A", key: "teamA", width: 28 },
    { header: "A Score", key: "scoreA", width: 9 },
    { header: "VS", key: "vs", width: 7 },
    { header: "B Score", key: "scoreB", width: 9 },
    { header: "TEAM B", key: "teamB", width: 28 },
    { header: "Status", key: "status", width: 11 },
  ];

  const summaryHeaderRow = summarySheet.getRow(1);
  summaryHeaderRow.height = 24;
  summaryHeaderRow.eachCell((cell) => {
    cell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
    setFill(cell, "2563EB");
    applyCenter(cell);
    applyCellBorder(cell, "1D4ED8");
  });

  roundItems.forEach((round, roundIndex) => {
    asArray(round?.matches).forEach((match, matchIndex) => {
      const scoreA = getScoreA(match);
      const scoreB = getScoreB(match);
      const completed = isCompletedMatch(match, winningScore);

      summarySheet.addRow({
        round: round?.label || `ROUND ${roundIndex + 1}`,
        court: getCourtLabel(match, matchIndex),
        type: getMatchType(match, modeLabel),
        teamA: getTeamText(
          match?.teamA || match?.leftTeam || match?.homeTeam || match?.team1,
          "TEAM A"
        ),
        scoreA,
        vs: "VS",
        scoreB,
        teamB: getTeamText(
          match?.teamB || match?.rightTeam || match?.awayTeam || match?.team2,
          "TEAM B"
        ),
        status: completed ? "Completed" : "Pending",
      });
    });
  });

  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.height = 34;
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10, color: { argb: "0F172A" } };
      applyCellBorder(cell, "CBD5E1");

      if (colNumber === 4 || colNumber === 8) {
        applyLeft(cell);
      } else {
        applyCenter(cell);
      }

      if (colNumber === 5 || colNumber === 7) {
        cell.font = { size: 11, bold: true, color: { argb: "0F172A" } };
        setFill(cell, cell.value ? "DCFCE7" : "FEF3C7");
        applyCellBorder(cell, cell.value ? "22C55E" : "D6D3B1", "medium");
      }

      if (colNumber === 6) {
        cell.font = { size: 10, bold: true, color: { argb: "334155" } };
        setFill(cell, "F1F5F9");
      }
    });

    const statusCell = row.getCell(9);
    if (statusCell.value === "Completed") {
      setFill(statusCell, "DCFCE7");
      statusCell.font = { size: 10, bold: true, color: { argb: "166534" } };
    } else {
      setFill(statusCell, "F1F5F9");
      statusCell.font = { size: 10, bold: true, color: { argb: "475569" } };
    }
  });

  summarySheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 9 },
  };

  const summaryLastColumnLetter = getExcelColumnLetter(9);
  setPrintArea(
    summarySheet,
    Math.max(1, summarySheet.lastRow?.number || 1),
    summaryLastColumnLetter
  );

  if (teamSheet) {
    teamSheet.columns = [
      { header: "label", key: "label", width: 16 },
      { header: "contentA", key: "contentA", width: 22 },
      { header: "contentB", key: "contentB", width: 54 },
    ];

    teamSheet.mergeCells(1, 1, 1, 3);
    const teamTitleCell = teamSheet.getCell(1, 1);
    teamTitleCell.value = `Team Composition | Winning score ${winningScore}`;
    teamTitleCell.font = { size: 16, bold: true, color: { argb: "0F172A" } };
    setFill(teamTitleCell, "DBEAFE");
    applyLeft(teamTitleCell);
    applyCellBorder(teamTitleCell, "93C5FD", "medium");
    teamSheet.getRow(1).height = 30;

    teamSheet.mergeCells(2, 1, 2, 3);
    const guideCell = teamSheet.getCell(2, 1);
    guideCell.value = "Each team is split into pair lineup, full roster, and reserves.";
    guideCell.font = { size: 10, bold: true, color: { argb: "475569" } };
    setFill(guideCell, "F8FAFC");
    applyLeft(guideCell);
    applyCellBorder(guideCell, "E2E8F0");
    teamSheet.getRow(2).height = 22;

    let teamRowCursor = 4;
    leagueTeams.forEach((team, teamIndex) => {
      const teamName = team?.name || `팀 ${teamIndex + 1}`;
      const ageBand = team?.ageBand || "";
      const pairText =
        asArray(team?.pairs)
          .map((pair, index) => getPairLine(pair, index))
          .join("\n") || "-";
      const playerText =
        asArray(team?.players)
          .map(getPlayerName)
          .filter(Boolean)
          .map((name, index) => `${index + 1}. ${name}`)
          .join("\n") || "-";
      const reserveText =
        asArray(team?.leftovers)
          .map(getPlayerName)
          .filter(Boolean)
          .map((name, index) => `${index + 1}. ${name}`)
          .join("\n") || "-";

      teamSheet.mergeCells(teamRowCursor, 1, teamRowCursor, 3);
      const teamHeaderCell = teamSheet.getCell(teamRowCursor, 1);
      teamHeaderCell.value = `${teamName}${ageBand ? ` (${ageBand})` : ""}`;
      teamHeaderCell.font = { size: 12, bold: true, color: { argb: "1D4ED8" } };
      setFill(teamHeaderCell, teamIndex % 2 === 0 ? "EFF6FF" : "F8FAFC");
      applyLeft(teamHeaderCell);
      applyCellBorder(teamHeaderCell, "93C5FD", "medium");
      teamSheet.getRow(teamRowCursor).height = 22;
      teamRowCursor += 1;

      const sections = [
        { label: "조 편성", text: pairText },
        { label: "전체 선수", text: playerText },
        { label: "예비 선수", text: reserveText },
      ];

      sections.forEach((section) => {
        const labelCell = teamSheet.getCell(teamRowCursor, 1);
        labelCell.value = section.label;
        labelCell.font = { size: 10, bold: true, color: { argb: "334155" } };
        setFill(labelCell, "F8FAFC");
        applyCenter(labelCell);
        applyCellBorder(labelCell, "CBD5E1");

        teamSheet.mergeCells(teamRowCursor, 2, teamRowCursor, 3);
        const contentCell = teamSheet.getCell(teamRowCursor, 2);
        contentCell.value = section.text;
        contentCell.font = { size: 10, color: { argb: "0F172A" } };
        setFill(contentCell, "FFFFFF");
        applyLeft(contentCell);
        applyCellBorder(contentCell, "CBD5E1");

        const lineCount = String(section.text).split("\n").length;
        teamSheet.getRow(teamRowCursor).height = Math.min(100, Math.max(22, 16 + lineCount * 10));
        teamRowCursor += 1;
      });

      teamSheet.mergeCells(teamRowCursor, 1, teamRowCursor, 3);
      const spacerCell = teamSheet.getCell(teamRowCursor, 1);
      spacerCell.value = "";
      setFill(spacerCell, "FFFFFF");
      applyCellBorder(spacerCell, "FFFFFF");
      teamSheet.getRow(teamRowCursor).height = 8;
      teamRowCursor += 1;
    });

    const teamLastColumnLetter = getExcelColumnLetter(3);
    setPrintArea(
      teamSheet,
      Math.max(2, teamSheet.lastRow?.number || 2),
      teamLastColumnLetter
    );
  }

  if (Array.isArray(leagueStandings) && leagueStandings.length > 0) {
    const standingsSheet = workbook.addWorksheet("League Standings", {
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    standingsSheet.columns = [
      { header: "Rank", key: "rank", width: 10 },
      { header: "Team", key: "teamName", width: 20 },
      { header: "Played", key: "played", width: 10 },
      { header: "Win", key: "win", width: 10 },
      { header: "Lose", key: "lose", width: 10 },
      { header: "Point", key: "point", width: 12 },
      { header: "Against", key: "against", width: 12 },
      { header: "Diff", key: "diff", width: 12 },
    ];

    const headerRow = standingsSheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
      setFill(cell, "16A34A");
      applyCenter(cell);
      applyCellBorder(cell, "15803D");
    });

    leagueStandings.forEach((item, index) => {
      standingsSheet.addRow({
        rank: item?.rank || index + 1,
        teamName: item?.teamName || item?.name || item?.team || item?.label || `팀 ${index + 1}`,
        played: item?.played ?? "",
        win: item?.win ?? item?.wins ?? item?.victory ?? item?.victories ?? "",
        lose: item?.lose ?? item?.loss ?? item?.losses ?? "",
        point: item?.point ?? item?.points ?? item?.score ?? item?.leaguePoint ?? "",
        against: item?.against ?? item?.pointsAgainst ?? item?.lossPoint ?? "",
        diff: item?.pointDiff ?? item?.scoreDiff ?? item?.goalDiff ?? item?.diff ?? "",
      });
    });

    standingsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 24;
      row.eachCell((cell, colNumber) => {
        if (colNumber === 2) {
          applyLeft(cell);
        } else {
          applyCenter(cell);
        }
        applyCellBorder(cell, "BBF7D0");
      });
    });

    if (leagueSummary) {
      const nextRowNumber = (standingsSheet.lastRow?.number || 1) + 2;
      standingsSheet.mergeCells(nextRowNumber, 1, nextRowNumber, 8);
      const summaryCell = standingsSheet.getCell(nextRowNumber, 1);
      summaryCell.value =
        typeof leagueSummary === "string" ? leagueSummary : JSON.stringify(leagueSummary);
      summaryCell.font = { size: 10, bold: true, color: { argb: "475569" } };
      setFill(summaryCell, "F0FDF4");
      applyLeft(summaryCell);
      applyCellBorder(summaryCell, "BBF7D0");
    }

    const standingsLastColumnLetter = getExcelColumnLetter(8);
    setPrintArea(
      standingsSheet,
      Math.max(1, standingsSheet.lastRow?.number || 1),
      standingsLastColumnLetter
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (typeof saveAs === "function") {
    saveAs(blob, buildExportFileName(modeLabel));
  } else {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = buildExportFileName(modeLabel);
    link.click();
    URL.revokeObjectURL(url);
  }
}
