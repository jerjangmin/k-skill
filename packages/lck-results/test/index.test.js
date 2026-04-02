const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildHistoricalAnalytics,
  getGameAnalysis,
  getLckSummary,
  getMatchAnalysis,
  getMatchResults,
  getPatchMetaReport,
  getStandings,
  getTeamPowerRatings,
  parseOracleCsv,
  resolveSearchDirection,
  summarizeMatchLive,
} = require("../src/index");
const {
  hasMeaningfulLiveStats,
  normalizeDateInput,
  normalizeEventDetailsResponse,
  normalizeLiveGameResponse,
  normalizeScheduleResponse,
  normalizeStandingsResponse,
  normalizeTournamentList,
  resolveTournamentForDate,
} = require("../src/parse");
const { resolveTeamQuery } = require("../src/teams");

const fixturesDir = path.join(__dirname, "fixtures");
const oracleCsv = fs.readFileSync(path.join(fixturesDir, "oracle-lck-sample.csv"), "utf8");
const schedulePage1 = JSON.parse(fs.readFileSync(path.join(fixturesDir, "schedule-lck-page1.json"), "utf8"));
const schedulePage2 = JSON.parse(fs.readFileSync(path.join(fixturesDir, "schedule-lck-page2.json"), "utf8"));
const tournamentsPayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, "tournaments-lck.json"), "utf8"));
const standingsPayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, "standings-lck-split2-2026.json"), "utf8"));
const eventDetailsPayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, "event-details-lck-2026-04-01-hle-bro.json"), "utf8"));
const eventDetailsLivePayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, "event-details-lck-live-kt-t1.json"), "utf8"));
const liveWindowPayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, "live-window-lck-game1.json"), "utf8"));
const liveDetailsPayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, "live-details-lck-game1.json"), "utf8"));

test("normalizeDateInput accepts YYYY-MM-DD and rejects impossible dates", () => {
  assert.equal(normalizeDateInput("2026-04-01").isoDate, "2026-04-01");
  assert.throws(() => normalizeDateInput("2026-13-40"), /date must be a valid Date or YYYY-MM-DD string\./);
});

test("team alias normalization maps historical LCK names to canonical teams", () => {
  assert.equal(resolveTeamQuery("광동").canonicalId, "dnf");
  assert.equal(resolveTeamQuery("Afreeca Freecs").canonicalId, "dnf");
  assert.equal(resolveTeamQuery("담원").canonicalId, "dk");
  assert.equal(resolveTeamQuery("SKT T1").canonicalId, "t1");
});

test("normalizeScheduleResponse filters LCK matches by date and team alias", () => {
  const result = normalizeScheduleResponse(schedulePage1, {
    date: "2026-04-01",
    team: "브리온",
  });

  assert.equal(result.queryDate, "2026-04-01");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].team1.canonicalId, "bro");
  assert.equal(result.matches[0].team2.canonicalId, "hle");
  assert.deepEqual(result.matches[0].score, { team1: 0, team2: 2 });
  assert.equal(result.filteredTeam.canonicalId, "bro");
});

test("normalizeStandingsResponse keeps the LCK standings shape and team aliases", () => {
  const tournaments = normalizeTournamentList(tournamentsPayload);
  const tournament = resolveTournamentForDate(tournaments, "2026-04-01");
  const table = normalizeStandingsResponse(standingsPayload, {
    tournament,
  });

  assert.equal(table.tournamentId, "115548128960088078");
  assert.equal(table.stage.name, "Regular Season");
  assert.equal(table.rows[0].team.canonicalId, "hle");
  assert.equal(table.rows[0].wins, 1);
  assert.equal(table.rows[0].losses, 0);
});

test("resolveSearchDirection follows older/newer schedule pages based on Korea date", () => {
  assert.equal(resolveSearchDirection(schedulePage1, "2025-12-31"), "older");
  assert.equal(resolveSearchDirection(schedulePage1, "2026-05-01"), "newer");
  assert.equal(resolveSearchDirection(schedulePage1, "2026-04-01"), null);
});

test("live detail normalization filters meaningless startup frames", () => {
  const eventDetails = normalizeEventDetailsResponse(eventDetailsLivePayload);
  const game = eventDetails.games[0];
  const live = normalizeLiveGameResponse(liveWindowPayload, liveDetailsPayload, {
    gameId: game.id,
    matchId: "115548128962840651",
  });

  assert.equal(game.teams[0].team.canonicalId, "kt");
  assert.equal(game.teams[1].team.canonicalId, "t1");
  assert.equal(live, null);
  assert.equal(hasMeaningfulLiveStats(live), false);
});


test("Oracle historical analytics builds power ratings, matchups, synergies, and patch meta", () => {
  const rows = parseOracleCsv(oracleCsv);
  const analytics = buildHistoricalAnalytics(rows);
  const ratings = getTeamPowerRatings(analytics);
  const patchMeta = getPatchMetaReport(analytics, "16.6.753.8272");

  assert.equal(rows.length, 20);
  assert.equal(ratings[0].teamId, "hle");
  assert.equal(ratings[1].teamId, "t1");
  assert.ok(analytics.matchupStats.some((entry) => entry.champion === "Ahri" && entry.opponentChampion === "Orianna"));
  assert.ok(analytics.synergyStats.some((entry) => entry.championA === "Ahri" && entry.championB === "Ashe"));
  assert.equal(patchMeta.patch, "16.6.753.8272");
  assert.ok(patchMeta.topPicks.length > 0);
});

test("game analysis produces turning points, draft edge, and meta context", async () => {
  const analytics = buildHistoricalAnalytics(oracleCsv);
  const windowPayload = buildMeaningfulWindowPayload();
  const detailsPayload = buildMeaningfulDetailsPayload();

  const analysis = await getGameAnalysis("synthetic-game-1", {
    matchId: "synthetic-match-1",
    number: 1,
    state: "inProgress",
    historicalDataset: analytics,
    liveWindowPayload: windowPayload,
    liveDetailsPayload: detailsPayload,
  });

  assert.equal(analysis.patch, "16.6.753.8272");
  assert.ok(analysis.timeline.length >= 3);
  assert.ok(analysis.turningPoints.length >= 1);
  assert.equal(analysis.draft.roleMatchups.length, 5);
  assert.equal(analysis.meta.patch, "16.6.753.8272");
});

test("match analysis attaches game analyses and team power preview", async () => {
  const analytics = buildHistoricalAnalytics(oracleCsv);
  const matchResponse = {
    queryDate: "2026-04-01",
    filteredTeam: null,
    matches: [
      {
        matchId: "synthetic-match-1",
        eventId: "synthetic-event-1",
        team1: { canonicalId: "hle", name: "Hanwha Life Esports" },
        team2: { canonicalId: "t1", name: "T1" },
        games: [
          {
            id: "synthetic-game-1",
            number: 1,
            state: "inProgress",
            live: null,
          },
        ],
      },
    ],
  };

  const summary = await getMatchAnalysis("2026-04-01", {
    matchesResponse: matchResponse,
    historicalDataset: analytics,
    liveWindowByGameId: {
      "synthetic-game-1": buildMeaningfulWindowPayload(),
    },
    liveDetailsByGameId: {
      "synthetic-game-1": buildMeaningfulDetailsPayload(),
    },
  });

  assert.equal(summary.matches.length, 1);
  assert.equal(summary.matches[0].analyses.length, 1);
  assert.equal(summary.matches[0].powerPreview.favoredTeamId, "hle");
  assert.ok(summary.matches[0].analyses[0].turningPoints.length >= 1);
});

test("public fetchers compose date results, live details, and standings via mocked fetch", async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url) => {
    const target = String(url);
    calls.push(target);

    if (target.includes("getSchedule") && target.includes("pageToken=bmV3ZXI6OjExNTU0ODEyODk2Mjg0MDYxOQ%3D%3D")) {
      return makeResponse(schedulePage2);
    }

    if (target.includes("getSchedule") && target.includes("leagueId=98767991310872058")) {
      return makeResponse(schedulePage1);
    }

    if (target.includes("getTournamentsForLeague") && target.includes("leagueId=98767991310872058")) {
      return makeResponse(tournamentsPayload);
    }

    if (target.includes("getEventDetails") && target.includes("id=115548128962840607")) {
      return makeResponse(eventDetailsPayload);
    }

    if (target.includes("getEventDetails") && target.includes("id=115548128962840651")) {
      return makeResponse(eventDetailsLivePayload);
    }

    if (target.includes("/livestats/v1/window/115548128962840652")) {
      return makeResponse(liveWindowPayload);
    }

    if (target.includes("/livestats/v1/details/115548128962840652")) {
      return makeResponse(liveDetailsPayload);
    }

    if (target.includes("/livestats/v1/")) {
      return new Response(null, { status: 204 });
    }

    if (target.includes("getStandings") && target.includes("tournamentId=115548128960088078")) {
      return makeResponse(standingsPayload);
    }

    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const mayResults = await getMatchResults("2026-05-01", { team: "DN FREECS", includeLiveDetails: false });
    assert.equal(mayResults.matches.length, 1);
    assert.equal(mayResults.matches[0].team1.canonicalId, "dnf");
    assert.equal(mayResults.pagesExamined, 2);

    const aprilResults = await getMatchResults("2026-04-01", {});
    assert.equal(aprilResults.matches.length, 2);
    const completedMatch = aprilResults.matches.find((match) => match.matchId === "115548128962840607");
    const liveMatch = aprilResults.matches.find((match) => match.matchId === "115548128962840651");
    assert.equal(completedMatch.live, null);
    assert.ok(Array.isArray(liveMatch.games));
    assert.equal(liveMatch.games[0].live, null);

    const standings = await getStandings({ date: "2026-04-01", team: "한화" });
    assert.equal(standings.rows.length, 1);
    assert.equal(standings.rows[0].team.canonicalId, "hle");

    const summary = await getLckSummary("2026-04-01", {
      includeStandings: true,
    });
    assert.equal(summary.matches.length, 2);
    const completedSummaryMatch = summary.matches.find((match) => match.matchId === "115548128962840607");
    const liveSummaryMatch = summary.matches.find((match) => match.matchId === "115548128962840651");
    assert.equal(completedSummaryMatch.live, null);
    assert.equal(liveSummaryMatch.live, null);
    assert.equal(summary.standings.rows[0].team.canonicalId, "hle");
    assert.ok(calls.some((target) => target.includes("getSchedule")));
    assert.ok(calls.some((target) => target.includes("getEventDetails")));
    assert.ok(calls.some((target) => target.includes("/livestats/v1/window/")));
    assert.ok(calls.some((target) => target.includes("getStandings")));
    assert.ok(calls.some((target) => target.includes("getTournamentsForLeague")));
  } finally {
    global.fetch = originalFetch;
  }
});

function makeResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function buildMeaningfulWindowPayload() {
  return {
    esportsGameId: "synthetic-game-1",
    esportsMatchId: "synthetic-match-1",
    gameMetadata: {
      patchVersion: "16.6.753.8272",
      blueTeamMetadata: {
        esportsTeamId: "100205573496804586",
        participantMetadata: [
          { participantId: 1, esportsPlayerId: "1", summonerName: "HLE Zeus", championId: "Jayce", role: "top" },
          { participantId: 2, esportsPlayerId: "2", summonerName: "HLE Peanut", championId: "Vi", role: "jungle" },
          { participantId: 3, esportsPlayerId: "3", summonerName: "HLE Zeka", championId: "Ahri", role: "mid" },
          { participantId: 4, esportsPlayerId: "4", summonerName: "HLE Viper", championId: "Ashe", role: "bottom" },
          { participantId: 5, esportsPlayerId: "5", summonerName: "HLE Delight", championId: "Rell", role: "support" },
        ],
      },
      redTeamMetadata: {
        esportsTeamId: "98767991853197861",
        participantMetadata: [
          { participantId: 6, esportsPlayerId: "6", summonerName: "T1 Doran", championId: "Gnar", role: "top" },
          { participantId: 7, esportsPlayerId: "7", summonerName: "T1 Oner", championId: "Sejuani", role: "jungle" },
          { participantId: 8, esportsPlayerId: "8", summonerName: "T1 Faker", championId: "Orianna", role: "mid" },
          { participantId: 9, esportsPlayerId: "9", summonerName: "T1 Gumayusi", championId: "Ezreal", role: "bottom" },
          { participantId: 10, esportsPlayerId: "10", summonerName: "T1 Keria", championId: "Alistar", role: "support" },
        ],
      },
    },
    frames: [
      buildWindowFrame("2026-04-01T09:00:00.000Z", 420, 20500, 19000, 5, 2, 2, 1, ["air"], []),
      buildWindowFrame("2026-04-01T09:01:30.000Z", 510, 24500, 22500, 8, 4, 3, 2, ["air", "fire"], []),
      buildWindowFrame("2026-04-01T09:03:00.000Z", 600, 26200, 27600, 8, 9, 3, 4, ["air", "fire"], ["earth"]),
      buildWindowFrame("2026-04-01T09:04:30.000Z", 690, 31800, 28900, 12, 10, 5, 4, ["air", "fire"], ["earth"], 1, 0),
    ],
  };
}

function buildWindowFrame(timestamp, seconds, blueGold, redGold, blueKills, redKills, blueTowers, redTowers, blueDragons, redDragons, blueBarons = 0, redBarons = 0) {
  return {
    rfc460Timestamp: timestamp,
    gameState: "in_game",
    blueTeam: {
      totalGold: blueGold,
      inhibitors: 0,
      towers: blueTowers,
      barons: blueBarons,
      totalKills: blueKills,
      dragons: blueDragons,
      participants: buildParticipants(1, 5, blueGold, blueKills, seconds),
    },
    redTeam: {
      totalGold: redGold,
      inhibitors: 0,
      towers: redTowers,
      barons: redBarons,
      totalKills: redKills,
      dragons: redDragons,
      participants: buildParticipants(6, 10, redGold, redKills, seconds),
    },
  };
}

function buildParticipants(startId, endId, totalGold, totalKills, seconds) {
  const participants = [];
  const count = endId - startId + 1;
  for (let participantId = startId; participantId <= endId; participantId += 1) {
    participants.push({
      participantId,
      totalGold: Math.round(totalGold / count) + (participantId - startId) * 100,
      level: Math.max(1, Math.floor(seconds / 60 / 2) + 1),
      kills: participantId === startId ? Math.max(0, totalKills - 2) : 0,
      deaths: participantId === startId ? 0 : 1,
      assists: participantId === startId + 1 ? 3 : 1,
      creepScore: Math.floor(seconds / 15) + participantId,
      currentHealth: 1000,
      maxHealth: 1200,
    });
  }
  return participants;
}

function buildMeaningfulDetailsPayload() {
  return {
    frames: [
      buildDetailsFrame("2026-04-01T09:00:00.000Z", 420),
      buildDetailsFrame("2026-04-01T09:01:30.000Z", 510),
      buildDetailsFrame("2026-04-01T09:03:00.000Z", 600),
      buildDetailsFrame("2026-04-01T09:04:30.000Z", 690),
    ],
  };
}

function buildDetailsFrame(timestamp, seconds) {
  const participants = [];
  for (let participantId = 1; participantId <= 10; participantId += 1) {
    participants.push({
      participantId,
      level: Math.max(1, Math.floor(seconds / 60 / 2) + 1),
      kills: participantId === 1 ? 4 : 0,
      deaths: participantId === 6 ? 3 : 1,
      assists: participantId === 2 ? 5 : 2,
      creepScore: Math.floor(seconds / 15) + participantId,
      totalGoldEarned: 3000 + (participantId * 100),
      items: participantId % 2 === 0 ? [1001, 2003] : [1055],
    });
  }
  return {
    rfc460Timestamp: timestamp,
    participants,
  };
}
