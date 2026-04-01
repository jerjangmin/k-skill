---
name: lck-results
description: Riot 공식 LoL Esports 데이터로 특정 날짜 LCK 경기 결과와 현재 순위를 조회한다. 팀 리브랜딩 alias도 함께 정규화한다.
license: MIT
metadata:
  category: sports
  locale: ko-KR
  phase: v1
---

# LCK Results

## What this skill does

Riot 공식 LoL Esports 데이터 표면으로 특정 날짜의 LCK 경기 결과를 조회하고, 필요하면 특정 팀만 필터링한 뒤 현재 스플릿 순위와 인게임 실시간 디테일까지 함께 정리한다.

## When to use

- "오늘 LCK 경기 결과 알려줘"
- "2026-04-01 한화 경기 결과랑 순위 보여줘"
- "광동 프릭스 지금 이름 기준으로 경기 결과 찾아줘"
- "지금 T1 경기 킬 스코어랑 골드 차이 보여줘"

## Prerequisites

- Node.js 18+
- `npm install -g lck-results`

## Inputs

- 날짜: `YYYY-MM-DD`
- 선택 사항: 팀명, 과거 팀명, 한글/영문 약칭 alias

## Workflow

### 0. Install the package globally when missing

`npm root -g` 아래에 `lck-results` 가 없으면 HTML scraping 같은 우회 구현보다 먼저 전역 Node 패키지 설치를 시도한다.

```bash
npm install -g lck-results
```

### 1. Fetch Riot official esports data

이 스킬은 Riot 공식 LoL Esports 데이터 표면을 사용한다.

- 일정/결과: `getSchedule`
- 토너먼트 목록: `getTournamentsForLeague`
- 순위: `getStandings`
- 인게임 live stats: `window/details`

```bash
GLOBAL_NPM_ROOT="$(npm root -g)" node --input-type=module - <<'JS'
import path from "node:path";
import { pathToFileURL } from "node:url";

const entry = pathToFileURL(
  path.join(process.env.GLOBAL_NPM_ROOT, "lck-results", "src", "index.js"),
).href;
const { getLckSummary } = await import(entry);

const summary = await getLckSummary("2026-04-01", {
  team: "광동 프릭스",
  includeStandings: true,
});

console.log(JSON.stringify(summary, null, 2));
JS
```

### 2. Normalize for humans

원본 JSON을 그대로 던지지 말고 아래 기준으로 정리한다.

- 경기 시각
- 팀1 vs 팀2
- 경기 상태
- 세트 스코어
- 현재 순위
- 진행 중 게임이면 킬/골드/타워/바론/드래곤/선수-챔피언 정보
- 요청 팀이 있으면 현재명/과거명 alias를 같은 팀으로 정규화

### 3. Keep the answer compact

scoreboard 요청이면 경기별 한 줄 요약부터 준다. 특정 팀 요청이면 그 팀 경기와 현재 순위만 먼저 보여준다.

## Done when

- 날짜 기준 경기 요약이 있다
- 팀 요청이면 해당 팀 경기만 남아 있다
- 현재 스플릿 순위가 같이 정리되어 있다
- live stats 가 있는 경우 인게임 디테일이 같이 정리되어 있다

## Failure modes

- Riot가 웹앱용 공식 esports API 응답 구조를 바꾸면 패키지 수정이 필요하다
- 비시즌 날짜면 경기 결과가 비어 있을 수 있다
- 팀 리브랜딩 continuity가 애매한 별도 팀은 alias 사전 보강이 필요할 수 있다

## Notes

- 이 스킬은 조회 전용이다
- 사용자의 "오늘/어제" 요청은 항상 절대 날짜(`YYYY-MM-DD`)로 변환해서 실행한다
- `DN SOOPers`, `DN FREECS`, `광동 프릭스`, `Afreeca Freecs` 는 같은 canonical team으로 인식한다
- 자세한 사용 예시는 `docs/features/lck-results.md` 와 `packages/lck-results/README.md` 를 따른다
