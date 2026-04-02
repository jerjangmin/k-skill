# LCK 고급 분석 업데이트 파이프라인 설계

## 목표

`lck-results` 에 아래 분석 기능을 안정적으로 추가하기 위한 데이터 수집 / 적재 / 재계산 파이프라인을 정의한다.

- 실시간 경기 분석
- turning point 분석
- 카운터 / 시너지 모델
- 패치별 메타 해석
- 팀 / 선수 파워 레이팅

핵심 목표는 **업데이트가 잘 되는 구조** 다.

---

## 설계 원칙

1. **실시간 계층과 일배치 계층을 분리**한다.
2. **raw 저장 후 normalize** 한다.
3. 파생 분석 결과는 언제든 재계산 가능해야 한다.
4. 모든 레코드는 `patch`, `source`, `ingested_at` 를 가진다.
5. live source 장애가 나도 historical analytics 는 계속 갱신 가능해야 한다.

---

## 전체 파이프라인 개요

## Layer A. Source collectors

외부 소스에서 원천 데이터를 가져온다.

### collectors/riot

수집 대상:

- schedule pages
- tournaments
- standings
- event details
- live window snapshots
- live detail snapshots

### collectors/oracle

수집 대상:

- Oracle's Elixir CSV downloads
- definitions 기반 column mapping metadata

### collectors/patch-notes

수집 대상:

- Riot patch notes
- patch release date
- champion / item / system changes

---

## Layer B. Raw landing zone

원본 payload 를 가능한 그대로 저장한다.

### 목적

- 파서 버그 발생 시 재처리 가능
- 소스 구조 변경 시 diff 분석 가능
- 디버깅과 감사 추적 가능

### 권장 raw 저장 단위

- `raw_riot_schedule_pages`
- `raw_riot_event_details`
- `raw_riot_live_window_snapshots`
- `raw_riot_live_detail_snapshots`
- `raw_oracle_csv_imports`
- `raw_patch_notes`

### 공통 메타 필드

- `source_name`
- `source_version`
- `fetched_at`
- `ingested_at`
- `request_key`
- `content_hash`

---

## Layer C. Normalization

소스별 포맷을 공통 canonical schema 로 변환한다.

### 핵심 canonical entities

- `matches`
- `games`
- `teams`
- `players`
- `drafts`
- `game_participants`
- `game_timeline_snapshots`
- `game_events`
- `patches`

### 정규화 규칙

- team id / alias canonicalization
- player naming normalization
- champion id / champion name normalization
- patch version normalization
- tournament / stage / round normalization
- blue / red side normalization

---

## Layer D. Derived analytics

정규화된 기본 테이블에서 파생 분석 데이터를 만든다.

### 파생 테이블

- `team_form_snapshots`
- `champion_matchups`
- `champion_synergies`
- `team_power_ratings`
- `player_power_ratings`
- `patch_meta_summaries`
- `match_turning_points`
- `match_analysis_summaries`

---

## Layer E. Runtime query surface

최종적으로 사용자 응답에 사용될 읽기 모델이다.

### 예시 읽기 모델

- 날짜별 경기 요약
- 팀별 최근 폼 요약
- 진행 중 경기 실시간 분석 요약
- 종료 경기 turning point 요약
- 패치별 메타 브리프
- 밴픽 카운터 / 시너지 해석

---

## 업데이트 주기

## 1. 경기 중 live polling

### 대상

- 진행 중인 game

### 주기

- 기본: 10~30초 간격
- 급격한 변동 감지 시: 더 짧게 조정 가능

### 수집 데이터

- `window`
- `details`
- 필요 시 match / event metadata 재동기화

### 저장 규칙

- snapshot append-only 저장
- 동일 `game_id + timestamp` dedupe
- 마지막 정상 snapshot 별도 캐시

### 목적

- live 해설
- gold / objective swing 추적
- 종료 후 post-game turning point 재분석

---

## 2. 경기 종료 후 finalize job

### 트리거

- game state 가 `completed` 로 전환
- 또는 schedule / event details 상 종료 확인

### 작업

1. 마지막 live snapshot 재수집
2. 최종 결과 확정
3. timeline gap 보정
4. turning point 1차 계산
5. match analysis summary 생성

### 재확인

- 종료 후 5~10분 뒤 1회 재검증
- 누락 / 204 / 일시적 feed 공백 보정

---

## 3. 일배치 historical sync

### 대상

- Oracle's Elixir CSV
- patch notes changes
- standings / fixture reference backfill

### 주기

- 하루 1회

### 작업

1. Oracle CSV 다운로드
2. checksum 비교
3. 변경분 upsert
4. patch / tournament / player / team dimension 보강
5. 파생 지표 재계산 큐 등록

### 산출물

- 최신 historical warehouse
- 최근 N경기 폼 데이터
- champion / role / patch aggregates

---

## 4. 패치 배치

### 트리거

- 새 patch release 감지

### 작업

1. patch notes ingest
2. patch dimension 추가
3. 이전 patch 와 delta 계산
4. patch-specific aggregates 초기화 / 재분리
5. meta summary baseline 생성

---

## 5. 주간 재빌드

### 목적

가벼운 incremental update 로는 놓칠 수 있는 누락 / 오차를 주기적으로 교정한다.

### 작업

- 최근 30~90일 raw 재파싱
- matchup / synergy matrix 전량 재계산
- Elo / weighted power score 재빌드
- 샘플 QA 검증

---

## 기능별 파이프라인

## A. turning point 분석 파이프라인

### 입력

- live snapshots
- game events
- final result
- draft / patch / side

### 처리 단계

1. snapshot timeline 정렬
2. gold diff / objective diff / tower diff series 생성
3. 급격한 swing 구간 탐지
4. 오브젝트 / 교전 이벤트와 결합
5. turning point 후보 scoring
6. top N turning points 추출
7. 자연어 summary 생성

### 예시 파생 필드

- `swing_score`
- `gold_delta_90s`
- `objective_value_delta`
- `win_prob_delta_estimate`
- `turning_point_reason`

---

## B. 카운터 / 시너지 파이프라인

### 입력

- Oracle historical games
- draft order
- patch
- role assignments
- result

### 처리 단계

1. lane opponent 매핑
2. blind / counter label 계산
3. role matchup table 구축
4. same-team champion pair 집계
5. patch / region / sample size 조건 필터링
6. shrinkage / smoothing 적용

### 산출물

- `champion_matchups`
- `champion_synergies`
- `draft_context_features`

---

## C. 패치 메타 파이프라인

### 입력

- Oracle patch aggregates
- Riot patch notes
- tournament / region filters

### 처리 단계

1. 이전 patch 대비 pick/ban/win 변화량 계산
2. role priority 변화 계산
3. league 간 divergence 계산
4. patch note changes 와 연결
5. meta tier / riser / faller 생성

### 산출물

- `patch_meta_summaries`
- `champion_patch_trends`

---

## D. 파워 레이팅 파이프라인

### 입력

- historical results
- opponent strength
- early / mid / late metrics
- objective control
- recent form
- patch
- roster continuity

### 처리 단계

1. baseline Elo 계산
2. side / patch / opponent strength 보정
3. 최근 경기 가중치 적용
4. player availability / roster continuity 반영
5. 안정화 후 publish

### 산출물

- `team_power_ratings`
- `player_power_ratings`
- `team_form_snapshots`

---

## 권장 디렉터리 구조

```text
packages/lck-results/
  src/
    sources/
      riot/
      oracle/
      patch-notes/
    ingest/
      raw-store.js
      normalize-riot.js
      normalize-oracle.js
      normalize-patch-notes.js
    analytics/
      turning-points.js
      matchups.js
      synergies.js
      patch-meta.js
      power-ratings.js
    models/
      canonical-types.js
    jobs/
      sync-live.js
      finalize-game.js
      sync-oracle-daily.js
      sync-patches.js
      rebuild-weekly.js
```

---

## 데이터 품질 검증

## 수집 단계 검증

- 응답 status 확인
- content hash 기반 중복 방지
- 필수 필드 누락 검사
- patch 누락 검사

## 정규화 단계 검증

- game 당 참가자 10명 확인
- champion 10개 / draft completeness 확인
- winner / result consistency 확인
- team alias canonicalization 확인

## 파생 단계 검증

- Oracle aggregate 와 샘플 비교
- objective totals consistency 검사
- turning point score 분포 이상치 검사
- rating drift 모니터링

---

## 장애 대응 전략

## Riot live feed 장애

- 마지막 정상 snapshot 유지
- match status 는 schedule / event details 로 보완
- turning point 분석은 partial mode 로 생성

## Oracle sync 장애

- 직전 daily warehouse 유지
- 신규 live 기능은 계속 동작
- historical 모델 갱신만 일시 지연

## patch note 수집 실패

- patch meta narrative 생성만 보류
- 경기 / 팀 / 시너지 / 파워 데이터는 계속 갱신

---

## 캐시 전략

## hot cache

- 진행 중 경기 최신 snapshot
- 당일 경기 요약
- 당일 standings

## warm cache

- 최근 7일 match analysis summary
- 최근 patch meta summary
- 팀별 최근 폼

## cold storage

- raw payload archive
- 전체 historical warehouse

---

## 운영 결론

이 파이프라인은 다음을 보장하도록 설계한다.

- 실시간 분석과 역사적 모델링의 분리
- raw 재처리 가능성
- patch-aware 분석
- 소스 장애 격리
- 주기적 재계산을 통한 품질 유지

즉, `lck-results` 의 고급 분석 기능은 단순 API 호출 모음이 아니라,
**live collector + daily warehouse + derived analytics rebuild** 구조로 운영하는 것이 가장 안정적이다.
