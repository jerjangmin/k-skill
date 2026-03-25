# KBO 결과 가이드

## 이 기능으로 할 수 있는 일

- 날짜별 KBO 경기 일정 조회
- 경기 결과와 스코어 확인
- 특정 팀 경기만 필터링

## 먼저 필요한 것

- Node.js 18+
- `npm install kbo-game`

## 입력값

- 날짜: `YYYY-MM-DD`
- 선택 사항: 특정 팀명

## 기본 흐름

1. 날짜 기준으로 경기 데이터를 조회합니다.
2. 홈팀/원정팀, 경기 상태, 스코어를 사람 읽기 좋은 형태로 정리합니다.
3. 팀 요청이 있으면 해당 팀 경기만 남깁니다.

## 예시

```bash
node --input-type=module - <<'JS'
import { getGame } from "kbo-game";

const date = "2026-03-25";
const games = await getGame(new Date(`${date}T00:00:00+09:00`));
console.log(JSON.stringify(games, null, 2));
JS
```

## 주의할 점

- `kbo-game@0.0.2`의 실제 export는 `getGame`입니다. README에 나온 `getGameInfo` 예시는 동작하지 않습니다.
- `getGame`은 문자열이 아니라 `Date` 객체를 받습니다. `"YYYY-MM-DD"`를 그대로 넘기면 `date.getFullYear is not a function` 오류가 납니다.
- 비시즌 날짜는 빈 결과가 올 수 있습니다.
- 사용자의 "오늘/어제" 요청은 항상 절대 날짜로 바꿔 실행하는 편이 안전합니다.
