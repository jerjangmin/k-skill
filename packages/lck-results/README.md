# lck-results

Riot 공식 LoL Esports 데이터를 감싼 재사용 가능한 Node.js 클라이언트입니다. 날짜별 LCK 경기 결과, 현재 순위, 그리고 인게임 실시간 디테일 스코어(킬/골드/오브젝트/챔피언/선수)를 조회할 수 있고, 팀 리브랜딩 alias도 함께 정규화합니다.

## Install

```bash
npm install lck-results
```

## Official surfaces

- 일정/결과: `https://esports-api.lolesports.com/persisted/gw/getSchedule`
- 토너먼트 목록: `https://esports-api.lolesports.com/persisted/gw/getTournamentsForLeague`
- 순위: `https://esports-api.lolesports.com/persisted/gw/getStandings`
- 라이브 stats: `https://feed.lolesports.com/livestats/v1/window/{gameId}`
- 라이브 details: `https://feed.lolesports.com/livestats/v1/details/{gameId}`

## Usage

```js
const {
  buildHistoricalAnalytics,
  getGameAnalysis,
  getLckSummary,
  getMatchAnalysis,
  getMatchResults,
  getPatchMetaReport,
  getStandings,
  getTeamPowerRatings,
} = require("lck-results");

(async () => {
  const results = await getMatchResults("2026-04-01", {
    team: "브리온",
  });

  const standings = await getStandings({
    date: "2026-04-01",
  });

  const summary = await getLckSummary("2026-04-01", {
    team: "한화",
    includeStandings: true,
  });

  const historical = buildHistoricalAnalytics([
    {
      league: "LCK",
      matchid: "sample-1",
      date: "2026-03-20",
      patch: "16.6.753.8272",
      side: "blue",
      teamname: "Hanwha Life Esports",
      opponentteam: "T1",
      playername: "HLE Zeka",
      position: "mid",
      champion: "Ahri",
      opponentchampion: "Orianna",
      result: "win",
      gd15: 1200,
      csd15: 18,
      xpd15: 340,
      drg: 100,
      bn: 100,
      blindpick: 0,
      counterpick: 1,
    },
  ]);

  const patchMeta = getPatchMetaReport(historical, "16.6.753.8272");
  const ratings = getTeamPowerRatings(historical);

  const gameAnalysis = await getGameAnalysis("115548128962840652", {
    historicalDataset: historical,
    liveWindowPayload: {/* optional injected payload for tests/cache */},
    liveDetailsPayload: {/* optional injected payload for tests/cache */},
  });

  const matchAnalysis = await getMatchAnalysis("2026-04-01", {
    historicalDataset: historical,
  });

  console.log(results.matches[0]);
  console.log(standings.rows[0]);
  console.log(summary);
  console.log(patchMeta);
  console.log(ratings[0]);
  console.log(gameAnalysis.turningPoints);
  console.log(matchAnalysis.matches[0]?.powerPreview);
})();
```

## API

### `getMatchResults(date, options)`

- `date`: `YYYY-MM-DD` 또는 `Date`
- `options.team`: 현재명/과거명/한글/영문/약칭 alias
- `options.maxPages`: 일정 페이지 탐색 상한, 기본값 `6`
- 기본적으로 `matches[*].games[*].live` 와 `matches[*].live` 에 인게임 실시간 디테일을 채운다
- `options.includeLiveDetails`: `false` 면 상세 live stats 조회 생략

### `getStandings(options)`

- `options.date`: `YYYY-MM-DD` 또는 `Date`
- `options.tournamentId`: 특정 토너먼트 강제 지정 가능
- `options.team`: 특정 팀만 현재 순위에서 필터링

### `getLckSummary(date, options)`

- 날짜 결과와 해당 시점 스플릿 순위를 한 번에 반환합니다.
- 각 match에는 현재 게임 요약(`match.live`)과 게임별 상세(`match.games[*].live`)가 포함될 수 있습니다.

### `parseOracleCsv(csvText)`

- Oracle's Elixir 스타일 CSV 문자열을 객체 배열로 파싱합니다.
- 별도 저장소 없이도 historical 분석 입력을 빠르게 만들 수 있습니다.

### `buildHistoricalAnalytics(input, options)`

- Oracle CSV 문자열 또는 row 배열로 historical 분석 데이터셋을 만듭니다.
- 반환값에는 아래가 포함됩니다.
  - `teamPowerRatings`
  - `championStats`
  - `matchupStats`
  - `synergyStats`
  - `patchMeta`

### `getGameAnalysis(gameId, options)`

- live window/details payload를 기반으로 timeline, turning points, draft edge, patch meta context를 계산합니다.
- `options.historicalDataset` 으로 historical 분석 결과를 주입할 수 있습니다.
- runtime 수집 외에도 테스트 fixture / cache payload 주입을 지원합니다.

### `getMatchAnalysis(date, options)`

- 날짜별 match 결과 위에 게임별 분석과 팀 파워 preview 를 붙여 반환합니다.
- `options.matchesResponse` 로 기존 결과를 주입할 수 있습니다.

### `getTeamPowerRatings(input, options)`

- historical 데이터셋에서 팀 파워 점수 목록을 반환합니다.

### `getPatchMetaReport(input, patch, options)`

- 특정 patch 기준 top picks / risers 요약을 반환합니다.

## Notes

- Riot 웹앱이 사용하는 공식 LoL Esports API와 공식 live stats feed를 호출합니다.
- historical 고급 분석은 Oracle's Elixir 스타일 CSV row / 문자열을 입력으로 사용합니다.
- turning point 분석은 공개 접근 가능한 live snapshot 기반 heuristic MVP 입니다. GRID event-grade 정밀도는 추후 확장 대상입니다.
- 팀명은 `DN SOOPers`, `DN FREECS`, `광동 프릭스`, `Afreeca Freecs` 같은 과거/현재 alias를 같은 canonical team으로 정규화합니다.
- 일정은 페이지 토큰을 따라 이동하며 요청 날짜가 포함된 구간까지 탐색합니다.
