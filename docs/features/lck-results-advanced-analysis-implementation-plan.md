# LCK 고급 분석 구현 계획

## 목표

`lck-results` 에 다음 고급 분석 기능을 순차적으로 추가한다.

- 이벤트 로그 / snapshot 기반 turning point 분석
- 카운터 / 시너지 모델
- 패치별 메타 해석
- 팀 / 선수 파워 레이팅

이 문서는 **MVP부터 확장 단계까지** 실제 repo 에 반영할 구현 순서를 정의한다.

---

## 비목표

초기 단계에서 아래는 하지 않는다.

- 완전한 방송 해설 수준의 전술 자동 해석
- 비공식 HTML scraping 중심 파이프라인
- 모든 외부 사이트를 직접 ingestion backbone 으로 사용하는 구조
- GRID access 미확보 상태에서 GRID 전제 구현

---

## 최종 목표 상태

최종적으로 `lck-results` 는 다음 3층 구조를 가진다.

1. **runtime query layer**
   - 날짜별 경기 결과
   - 실시간 경기 분석
   - 종료 경기 turning point 요약
   - 팀 파워 / 폼 요약
   - 패치 메타 요약

2. **analytics layer**
   - turning point engine
   - champion matchup / synergy tables
   - patch meta summaries
   - power rating engine

3. **ingestion layer**
   - Riot live / schedule collectors
   - Oracle daily sync
   - patch notes sync

---

## 단계별 구현 계획

## Phase 0. 기반 정리

### 목표

현재 패키지 구조를 고급 분석 확장에 맞게 분리한다.

### 작업

- `packages/lck-results/src/` 내부를 아래처럼 정리
  - `sources/riot`
  - `sources/oracle`
  - `sources/patch-notes`
  - `analytics/`
  - `jobs/`
  - `models/`
- 현재 `index.js` 의 네트워크 호출 로직 분리
- canonical data shapes 초안 정의
- raw / normalized / derived 개념 분리

### 완료 기준

- 소스별 collector 와 parser 경계가 명확함
- 기존 `getLckSummary` 기능이 깨지지 않음

---

## Phase 1. Oracle historical warehouse 구축

### 목표

카운터 / 시너지 / 메타 / 파워 모델의 기반이 되는 historical dataset 을 마련한다.

### 작업

- Oracle CSV downloader 구현
- CSV import parser 구현
- 팀 / 선수 / 챔피언 / 패치 / 대회 dimension 정규화
- 주요 feature 적재
  - result
  - side
  - patch
  - role
  - GD10/15/20
  - XPD10/15/20
  - CSD10/15/20
  - objective control
  - vision metrics
  - blind / counter context
- daily sync job 구현

### 산출 API / 내부 함수 예시

- `syncOracleDaily()`
- `buildHistoricalWarehouse()`
- `listTeamForm(team, options)`
- `listChampionPatchStats(champion, patch)`

### 완료 기준

- 하루 1회 historical sync 가능
- 특정 patch / 팀 / 선수 / 챔피언 통계 조회 가능

---

## Phase 2. live snapshot 저장 및 turning point MVP

### 목표

현재 Riot live feed 를 기반으로 진행 중 / 종료 경기의 turning point heuristic 분석을 만든다.

### 작업

- live `window` / `details` snapshot 저장
- 진행 중 경기 polling job 추가
- game 종료 감지 및 finalize job 추가
- gold diff / objective diff / tower diff 기반 swing 계산
- turning point score heuristic 구현
- 경기 요약에 turning point 1~3개 첨부

### 초기 heuristic 예시

- 90초 내 gold swing 임계치 초과
- dragon soul / elder / baron 전후 역전
- tower 2개 이상 연쇄 획득
- decisive fight 이후 gold lead 전환

### 산출 API / 내부 함수 예시

- `watchLiveGame(gameId)`
- `finalizeGameAnalysis(gameId)`
- `getTurningPoints(gameId)`
- `getMatchAnalysis(date, options)`

### 완료 기준

- live match 에 대해 snapshot timeline 생성 가능
- 종료 경기 요약에 turning point 포함 가능

---

## Phase 3. 카운터 / 시너지 모델 MVP

### 목표

패치 / 포지션 맥락이 반영된 밴픽 해석을 제공한다.

### 작업

- lane opponent 매핑
- blind pick / counter pick 판정 로직
- champion matchup table 생성
- same-team champion pair synergy 집계
- sample size 기반 shrinkage 적용
- 경기 분석 응답에 밴픽 해석 블록 추가

### 사용자에게 보여줄 예시

- "레드 5픽 카운터 성격이 강한 조합"
- "이 패치에서 해당 미드 매치업은 초반 주도권이 높음"
- "이 바텀 듀오는 최근 패치에서 시너지 지표가 높음"

### 완료 기준

- role matchup / champion pair 조회 가능
- 특정 경기 밴픽을 패치 기준으로 설명 가능

---

## Phase 4. 패치 메타 해석 MVP

### 목표

경기와 별개로 현재 패치의 메타 변화를 설명할 수 있게 한다.

### 작업

- patch notes collector 구현
- patch notes 구조화
- 이전 patch 대비 pick/ban/win 변화량 계산
- riser / faller / priority pick 생성
- 리그별 메타 divergence 지원

### 산출 API / 내부 함수 예시

- `syncPatchNotes()`
- `getPatchMetaSummary(patch, options)`
- `comparePatchMeta(currentPatch, previousPatch)`

### 완료 기준

- patch 단위 메타 요약 가능
- 팀 / 경기 분석에 patch context 첨부 가능

---

## Phase 5. 파워 레이팅 MVP

### 목표

팀 / 선수의 현재 전력을 정량화한다.

### 작업

- baseline Elo 계산
- 시리즈 / 세트 결과 반영 방식 정의
- 최근 경기 가중치 적용
- patch-aware 보정 추가
- objective / early-game feature 를 반영한 weighted score 추가
- 팀 폼 요약 생성

### 산출 API / 내부 함수 예시

- `rebuildPowerRatings()`
- `getTeamPowerRating(team, options)`
- `getPlayerForm(player, options)`

### 완료 기준

- 팀별 현재 power score 산출 가능
- 경기 프리뷰 응답에 전력 비교 포함 가능

---

## Phase 6. GRID 연동 준비

### 목표

공식 접근 권한 확보 시 event-grade 고도화가 가능하도록 설계를 준비한다.

### 작업

- source adapter interface 정의
- Riot fallback source 와 GRID source 동시 지원 구조화
- event stream ingestion hook 설계
- player position / health / timers 확장 포인트 정의

### 완료 기준

- GRID 도입이 collector 교체 수준으로 가능
- 기존 분석 엔진 재사용 가능

---

## MVP 우선순위

가장 먼저 가치를 주는 순서는 다음과 같다.

1. **Oracle historical sync**
2. **turning point MVP**
3. **counter / synergy MVP**
4. **patch meta MVP**
5. **power rating MVP**
6. **GRID 고도화**

이 순서가 좋은 이유:

- 사용자 가치가 빠르게 나온다.
- 공개 접근 가능한 데이터만으로도 상당 부분 구현된다.
- live 와 historical 기능이 병렬적으로 자란다.

---

## API 제안

## 기존 API 유지

- `getMatchResults(date, options)`
- `getStandings(options)`
- `getLckSummary(date, options)`

## 신규 API 초안

- `getMatchAnalysis(date, options)`
- `getGameAnalysis(gameId, options)`
- `getTurningPoints(gameId, options)`
- `getDraftAnalysis(gameId, options)`
- `getPatchMetaSummary(patch, options)`
- `getTeamPowerRatings(options)`
- `getTeamPreview(teamA, teamB, options)`

---

## 응답 스키마 초안

## `getGameAnalysis(gameId)`

```json
{
  "gameId": "...",
  "patch": "14.6",
  "status": "completed",
  "draft": {
    "blue": [],
    "red": [],
    "analysis": {}
  },
  "timeline": {
    "goldDiffSeries": [],
    "objectiveSeries": []
  },
  "turningPoints": [],
  "metaContext": {},
  "powerContext": {}
}
```

---

## 저장 전략

초기 구현에서는 완전한 외부 DB 가 없어도 동작할 수 있게 아래 순서를 권장한다.

### 1단계

- JSON / CSV artifact 기반 local cache
- deterministic rebuild 가능하게 설계

### 2단계

- SQLite 또는 경량 DB 도입
- normalized / derived table 관리

### 3단계

- 필요 시 별도 warehouse 로 확장

---

## 검증 계획

## 단위 테스트

- 팀 alias 정규화
- patch normalization
- draft parsing
- matchup / synergy aggregation
- Elo update rules
- turning point heuristic scoring

## fixture tests

- 실제 LCK 경기 샘플 3~5개 고정
- live / completed / edge case 포함

## 회귀 테스트

- 기존 `getLckSummary` 출력 유지
- Oracle sync 후 파생 지표 재계산 검증

---

## 문서 업데이트 계획

구현과 함께 아래 문서를 같이 갱신한다.

- `docs/features/lck-results.md`
- `packages/lck-results/README.md`
- `docs/sources.md`
- `README.md`

필요 시 신규 문서:

- 고급 분석 데이터 소스 명세서
- 업데이트 파이프라인 설계
- 구현 계획 문서

---

## 릴리스 전략

이 repo 의 릴리스 규칙에 따라 Node 패키지 변경은 **Changesets** 로 배포한다.

### 권장 릴리스 단위

- Phase 1: historical sync 기반 내부 구조 추가
- Phase 2: turning point MVP 공개
- Phase 3: draft / meta / power APIs 공개

### 검증

- `npm run ci`
- 샘플 분석 시나리오 수동 검증

---

## 최종 결론

가장 현실적인 구현 순서는 다음과 같다.

1. Oracle historical warehouse 구축
2. Riot live snapshot 저장
3. turning point MVP
4. counter / synergy
5. patch meta
6. power ratings
7. GRID 고도화

이 순서면 현재 repo 구조를 크게 흔들지 않으면서도,
`lck-results` 를 **조회 도구 → 설명 가능한 분석 도구** 로 확장할 수 있다.
