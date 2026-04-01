const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getLckSummary,
  getMatchResults,
  getStandings,
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
