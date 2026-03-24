# 설치 방법

## 에이전트에게 맡기기

Codex나 Claude Code에 아래 문장을 그대로 붙여 넣으면 된다.

```text
이 레포의 설치 문서를 읽고 k-skill을 설치해줘. 조회형 스킬은 바로 설치하고, credential이 필요한 스킬을 설치하면 k-skill-setup도 같이 설치해. 설치가 끝나면 설치된 스킬과 다음 단계만 짧게 정리해.
```

## 직접 설치

`skills` 설치 명령은 아래 셋 중 하나만 있으면 된다.

```bash
npx --yes skills add <owner/repo> --list
pnpm dlx skills add <owner/repo> --list
bunx skills add <owner/repo> --list
```

원하는 스킬만 설치:

```bash
npx --yes skills add <owner/repo> --skill kbo-results --skill lotto-results
```

credential이 필요한 스킬까지 같이 설치:

```bash
npx --yes skills add <owner/repo> \
  --skill k-skill-setup \
  --skill srt-booking \
  --skill ktx-booking \
  --skill seoul-subway-arrival
```

## 로컬 테스트

현재 디렉터리에서 바로 확인:

```bash
npx --yes skills add . --list
```

## npx도 없으면

`npx`, `pnpm dlx`, `bunx` 중 아무것도 없으면 먼저 Node.js 계열 런타임을 설치해야 한다.

- `npx`를 쓰려면 Node.js + npm
- `pnpm dlx`를 쓰려면 pnpm
- `bunx`를 쓰려면 Bun

## setup이 필요한 스킬

먼저 `k-skill-setup`을 따라야 하는 스킬:

- `srt-booking`
- `ktx-booking`
- `seoul-subway-arrival`

관련 문서:

- [`k-skill-setup/SKILL.md`](/Users/jeffrey/Projects/k-skill/k-skill-setup/SKILL.md)
- [`docs/security-and-secrets.md`](/Users/jeffrey/Projects/k-skill/docs/security-and-secrets.md)
