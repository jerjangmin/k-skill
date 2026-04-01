# LCK 결과 가이드

## 이 기능으로 할 수 있는 일

- 날짜별 LCK 경기 일정 및 결과 조회
- 특정 팀의 현재명/과거명 alias 기준 필터링
- 현재 스플릿 순위 확인
- 진행 중 게임의 실시간 킬/골드/오브젝트/선수-챔피언 정보 확인

## 먼저 필요한 것

- Node.js 18+
- `npm install -g lck-results`

## 입력값

- 날짜: `YYYY-MM-DD`
- 선택 사항: 팀명, 과거명, 한글/영문 약칭 alias

## 공식 표면

이 기능은 Riot 공식 LoL Esports 데이터 표면을 직접 사용한다.

- 일정/결과: `https://esports-api.lolesports.com/persisted/gw/getSchedule`
- 토너먼트 목록: `https://esports-api.lolesports.com/persisted/gw/getTournamentsForLeague`
- 순위: `https://esports-api.lolesports.com/persisted/gw/getStandings`
- 라이브 window: `https://feed.lolesports.com/livestats/v1/window/{gameId}`
- 라이브 details: `https://feed.lolesports.com/livestats/v1/details/{gameId}`

## 기본 흐름

1. 패키지가 없으면 다른 방법으로 우회하지 말고 먼저 `lck-results` 를 전역 설치한다.
2. `getSchedule` 로 일정 페이지를 가져오고, 요청 날짜가 포함될 때까지 page token(`older` / `newer`)을 따라간다.
3. 요청 팀이 있으면 `광동`, `DN FREECS`, `DN SOOPers`, `Afreeca Freecs` 같은 alias 를 같은 팀으로 인식해 걸러낸다.
4. 각 match의 `getEventDetails` 로 game id 목록을 가져온다.
5. 진행 중이거나 stats가 노출된 game에는 live `window/details` feed를 붙여 인게임 디테일을 정리한다.
6. `getTournamentsForLeague` 와 `getStandings` 로 해당 날짜가 속한 스플릿 순위를 가져와 함께 보여준다.

## 예시

```bash
GLOBAL_NPM_ROOT="$(npm root -g)" node --input-type=module - <<'JS'
import path from "node:path";
import { pathToFileURL } from "node:url";

const entry = pathToFileURL(
  path.join(process.env.GLOBAL_NPM_ROOT, "lck-results", "src", "index.js"),
).href;
const { getLckSummary } = await import(entry);

const summary = await getLckSummary("2026-04-01", {
  team: "브리온",
  includeStandings: true,
});

console.log(JSON.stringify(summary, null, 2));
JS
```

## 주의할 점

- Riot 공식 esports API는 일반 Riot Developer API와 별도다.
- 인게임 디테일은 match-level API가 아니라 live stats feed에서 가져온다.
- 어떤 game은 `inProgress` 상태여도 live feed가 아직 비어 있어 `204` 를 반환할 수 있다. 이 경우 세트 스코어만 먼저 보여준다.
- 일정은 한 번에 전체 시즌을 다 주지 않으므로 page token을 따라 요청 날짜가 포함된 구간까지 이동해야 한다.
- 순위는 날짜가 속한 토너먼트를 먼저 찾은 뒤 `getStandings` 를 호출해야 한다.
- `광동`, `DN FREECS`, `Afreeca Freecs` 처럼 이름이 바뀐 팀은 alias 사전으로 정규화한다.
- 리브랜딩 continuity가 명확하지 않은 팀은 무리하게 같은 팀으로 합치지 않는다.
