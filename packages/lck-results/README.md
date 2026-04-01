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
  getLckSummary,
  getMatchResults,
  getStandings,
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

  console.log(results.matches[0]);
  console.log(standings.rows[0]);
  console.log(summary);
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

## Notes

- Riot 웹앱이 사용하는 공식 LoL Esports API와 공식 live stats feed를 호출합니다.
- 팀명은 `DN SOOPers`, `DN FREECS`, `광동 프릭스`, `Afreeca Freecs` 같은 과거/현재 alias를 같은 canonical team으로 정규화합니다.
- 일정은 페이지 토큰을 따라 이동하며 요청 날짜가 포함된 구간까지 탐색합니다.
