# LCK 고급 분석 데이터 소스 명세서

## 목표 범위

`lck-results` 를 단순 결과 조회에서 아래 고급 분석까지 확장하기 위한 데이터 소스를 정의한다.

- 이벤트 로그 기반 turning point 분석
- 카운터 / 시너지 모델
- 패치별 메타 해석
- 팀 / 선수 파워 레이팅 모델

핵심 원칙은 다음과 같다.

1. **공식 실시간 데이터와 역사적 분석 데이터를 분리**한다.
2. 실시간 경기 해석은 **공식 또는 공식에 준하는 live telemetry** 를 우선 사용한다.
3. 장기 통계와 모델 학습은 **역사적 집계 데이터 웨어하우스** 로 처리한다.
4. 설명 보강용 레퍼런스는 ingestion backbone 이 아니라 **보조 검증 소스** 로만 사용한다.

---

## 최종 추천 소스 조합

### 1) 실시간 / 이벤트 축

- **1순위:** Riot Esports Data / GRID
- **2순위 fallback:** 현재 `lck-results` 가 사용하는 Riot LoL Esports schedule + event details + live stats feed

### 2) 역사적 분석 축

- **1순위:** Oracle's Elixir

### 3) 보조 검증 / 문맥 축

- **보조:** gol.gg
- **보조:** Leaguepedia
- **보조:** Riot patch notes

---

## 소스별 평가

## Riot Esports Data / GRID

### 역할

실시간 이벤트 분석 backbone.

### 확인된 제공 범위

Riot / GRID 안내 기준으로 다음 축을 포함한다.

- live in-game info
- fixture data
- team / player / match registry
- champion health, gold, objectives
- damage / healing
- current health / mana
- item details
- respawn timers
- player positions
- CS, K/D/A
- 일부 A/V feed

### 이 소스가 적합한 기능

- turning point 분석
- 실시간 경기 분석
- 이벤트 클러스터링
- 오브젝트 전후 win probability 변화 추정
- 실시간 상태 기반 해설

### 장점

- 공식 소스
- 낮은 지연
- 이벤트 및 상태 granularity 가 가장 좋음
- player state / objective state / timing 분석에 유리

### 단점 / 리스크

- 접근 권한 제약 가능성 높음
- 비상업 / 커뮤니티 프로젝트 접근 범위가 제한될 수 있음
- LCK 라이브 데이터 접근이 용도별로 제한될 수 있음

### 채택 원칙

- **접근 권한 확보 시 최우선 채택**
- 미확보 시 현재 `lck-results` 의 Riot live feed 를 fallback 으로 유지

---

## 현재 `lck-results` Riot 공식 표면

### 역할

현 repo 에서 당장 활용 가능한 공식 데이터 축.

### 현재 사용 중인 표면

- `getSchedule`
- `getTournamentsForLeague`
- `getStandings`
- `getEventDetails`
- `feed.lolesports.com/livestats/v1/window/{gameId}`
- `feed.lolesports.com/livestats/v1/details/{gameId}`

### 이 소스가 적합한 기능

- 경기 일정 / 결과 조회
- 현재 스플릿 순위 조회
- 진행 중 경기의 live snapshot 기반 분석
- turning point **heuristic** 분석

### 가능한 데이터

- 경기 / 시리즈 식별자
- 팀 / 선수 / 챔피언 기본 정보
- live gold / kills / towers / dragons / barons
- 아이템, 레벨, CS, K/D/A
- 일부 실시간 details

### 한계

- event-grade full timeline 보장이 약함
- 과거 모든 게임에 대한 안정적 event log warehouse 로 쓰기 어려움
- 장기 통계 / 패치 집계에는 별도 적재 계층이 필요함

### 채택 원칙

- GRID 확보 전까지 **실시간 분석용 primary runtime source** 로 유지
- raw snapshot 저장으로 turning point heuristic 과 post-game 재분석을 지원

---

## Oracle's Elixir

### 역할

고급 분석 / 모델링 backbone.

### 확인된 강점

- CSV 다운로드 제공
- 하루 1회 업데이트
- 팀 / 선수 / 챔피언 / 리그 / 토너먼트 단위 집계 강함
- Definitions 에서 확인되는 핵심 지표 다수 제공

예시 지표:

- `GD10`, `GD15`, `GD20`
- `XPD10`, `XPD15`, `XPD20`
- `CSD10`, `CSD15`, `CSD20`
- `GXD10`, `GXD15`, `GXD20`
- `FB%`, `FT%`, `FD%`, `FBN%`
- `DRG%`, `BN%`, `HLD%`, `GRB%`
- `VSPM`, `WPM`, `WCPM`
- `CTR%` counter-pick rate
- `BLND%` blind-pick rate
- `OE Rating`, `EGR`, `MLR`

또한 사이트 공지 기준으로 다음 정보도 확장되었다.

- Void Grub 데이터
- pick order fields

### 이 소스가 적합한 기능

- 카운터 / 시너지 모델
- 패치별 메타 해석
- 팀 / 선수 파워 레이팅
- 최근 N경기 폼 모델
- role matchup / side / objective 기반 feature engineering

### 장점

- 공개 접근성이 좋음
- 역사적 데이터 축적에 유리
- 모델 학습 feature 가 이미 풍부함
- patch-conditioned aggregate 를 만들기 쉬움

### 단점 / 리스크

- 실시간 event stream 은 아님
- 하루 1회 갱신이라 live analysis backbone 으로는 부족
- 시즌 규칙 변화 시 draft parser 이슈 가능

### 채택 원칙

- **역사적 분석 웨어하우스의 1차 소스**
- live feed 를 대체하지 말고 보완하는 방향으로 사용

---

## gol.gg

### 역할

보조 검증 / 분석 레퍼런스.

### 강점

- 챔피언 / 패치 / 토너먼트 탐색이 쉬움
- 사람이 직접 확인하기 좋은 통계 UI
- 설명 보강용 레퍼런스로 유용

### 한계

- 구조화 ingestion 친화성이 낮음
- 공식 소스가 아님
- 업데이트 지연 가능성 언급 사례 존재

### 채택 원칙

- **파이프라인 primary source 로는 사용하지 않음**
- 샘플 검증, 시각적 비교, QA 용도로만 사용

---

## Leaguepedia

### 역할

역사 / 로스터 / 맥락 정보 보강.

### 강점

- 팀 / 선수 / 대회 문맥 확인이 쉬움
- 설명용 메타데이터 보강에 유리

### 한계

- 구조화 수집 난이도 높음
- 위키 특성상 정합성 검증 필요
- 자동 fetch 제약 가능

### 채택 원칙

- **레퍼런스 및 수동 백필 전용**
- ingestion backbone 으로 사용하지 않음

---

## Riot patch notes

### 역할

패치별 메타 해석의 근거 데이터.

### 필요한 이유

패치 메타 분석은 "무엇이 강한가" 뿐 아니라 "왜 강해졌는가" 설명이 필요하다.
이를 위해 다음 구조화가 필요하다.

- 챔피언 버프 / 너프
- 아이템 변경
- 시스템 변경
- 정글 / 오브젝트 규칙 변경
- 출시일

### 채택 원칙

- patch meta narrative 생성용 1차 근거로 사용
- 경기 데이터와 별도 테이블로 저장 후 조인

---

## 기능별 권장 소스 매핑

## 1. turning point 분석

### primary

- GRID

### fallback

- 현재 Riot live stats feed + event details

### 필요 필드

- `game_id`, `match_id`, `timestamp`, `gameTime`
- team gold / kills / towers / inhibitors / dragons / heralds / grubs / barons / elders
- player champion / level / gold / CS / items / KDA / position
- objective state transitions
- draft / side / patch

### 비고

GRID 미도입 단계에서는 snapshot 기반 heuristic 으로 출발한다.

---

## 2. 카운터 / 시너지 모델

### primary

- Oracle's Elixir

### 보완

- Riot draft / event source
- 자체 전처리

### 필요 필드

- patch
- side
- pick order / ban order
- role assignment
- lane opponent
- result
- player / team / tournament

### 비고

patch-conditioned matchup matrix 와 same-team champion pair synergy 를 별도 파생 테이블로 구축한다.

---

## 3. 패치별 메타 해석

### primary

- Oracle's Elixir

### 보완

- Riot patch notes

### 필요 필드

- patch
- champion pick / ban / win by role
- league / tournament
- team adaptation trend
- patch note changes

---

## 4. 파워 레이팅 모델

### primary

- Oracle's Elixir

### 보완

- 공식 fixture / result source
- 자체 roster continuity 테이블

### 필요 필드

- match result history
- opponent strength
- side info
- early-game metrics
- objective control metrics
- recent-form window
- player participation
- patch

---

## 권장 canonical schema

## raw source tables

- `raw_riot_schedule_pages`
- `raw_riot_event_details`
- `raw_riot_live_window_snapshots`
- `raw_riot_live_detail_snapshots`
- `raw_oracle_csv_imports`
- `raw_patch_notes`

## normalized base tables

- `games`
- `matches`
- `teams`
- `players`
- `drafts`
- `game_participants`
- `game_timeline_snapshots`
- `game_events`
- `team_patch_metrics`
- `player_patch_metrics`
- `champion_patch_metrics`
- `champion_matchups`
- `champion_synergies`
- `team_power_ratings`

## derived outputs

- `match_turning_points`
- `match_analysis_summaries`
- `patch_meta_summaries`
- `team_form_snapshots`

---

## 채택 결정

### 필수 채택

- 현재 Riot 공식 표면
- Oracle's Elixir
- Riot patch notes

### 조건부 채택

- GRID access 확보 시 즉시 도입

### 비필수 / 보조

- gol.gg
- Leaguepedia

---

## 최종 결론

`lck-results` 의 고급 분석 기능은 단일 소스로 해결하지 않는다.

- **실시간 / turning point:** Riot official live data 계열
- **역사적 분석 / 모델링:** Oracle's Elixir
- **패치 해석:** Riot patch notes
- **검증 / 문맥:** gol.gg, Leaguepedia

이 조합이 정확도, 설명력, 업데이트 가능성, 운영 안정성의 균형이 가장 좋다.
