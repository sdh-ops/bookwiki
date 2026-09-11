# 북위키에 기여하기 (팀원용)

북위키는 **복사본(포크)에서 만들고 → 수정 요청(PR)을 보내면 → 운영자가 확인하고 합치는** 방식으로 함께 만듭니다.
원본 저장소·배포·DB 권한은 운영자에게만 있고, 팀원은 권한 없이도 모든 작업을 할 수 있습니다.

## 준비물 (처음 한 번)

1. GitHub 계정
2. 컴퓨터에 설치: [Git](https://git-scm.com), [Node.js 22](https://nodejs.org), [GitHub CLI](https://cli.github.com)
3. 터미널에서 `gh auth login` 으로 GitHub 로그인
4. 운영자에게 **공개 키 두 개**(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)를 받아 둡니다

## 가장 쉬운 방법 — 시작 파일을 AI 에게 주기

운영자에게 **「북위키_팀원_시작하기.md」** 파일을 받아, 쓰시는 AI(Claude Code 등)에 첨부하고
「이 파일대로 해 줘. 내가 만들고 싶은 건 ○○○ 이야」라고 말하면 준비부터 PR 까지 AI 가 합니다.
(그 파일에는 공개 키 두 개가 이미 들어 있어서 따로 받을 필요가 없습니다.)

**PR 을 올려도 사이트는 바로 바뀌지 않습니다.** 운영자가 확인하고 승인해야 반영되니, 편하게 만들어 보세요.

## 시작 파일이 없을 때 — AI 에게 이렇게 말하세요

Claude Code 같은 AI 를 쓰면 아래 문장을 그대로 붙여 넣으면 됩니다. AI 가 `AGENTS.md` 를 읽고 나머지를 알아서 합니다.

```
https://github.com/sdh-ops/bookwiki 를 내 GitHub 계정으로 포크해서 내 컴퓨터에 받아 줘.
받은 다음 AGENTS.md 를 먼저 읽고, 거기 적힌 순서대로 개발 환경을 준비해 줘.
공개 키 두 개는 내가 알려 줄게.

내가 만들고 싶은 것: (여기에 적기 — 예: 출판 용어 퀴즈 게임)

다 만들면 확인할 주소를 알려 주고, PC·모바일 화면을 같이 보자.
내가 좋다고 하면 그때 PR 을 올려 줘.
```

두 번째 작업부터는 이렇게만 말하면 됩니다.

```
bookwiki 폴더에서 AGENTS.md 규칙대로 새 작업을 시작해 줘. 만들 것: (여기에 적기)
```

## 직접 할 때의 순서

```bash
gh repo fork sdh-ops/bookwiki --clone
cd bookwiki
cp .env.example .env.local          # 받은 공개 키 두 개를 넣는다
npm install --legacy-peer-deps
npm run dev                         # http://localhost:3000
```

작업마다: 최신 원본에서 브랜치 만들기 → 작업 → `npm run build` 확인 → 커밋 → push → `gh pr create --repo sdh-ops/bookwiki`.
자세한 명령어는 [AGENTS.md §2](AGENTS.md#2-팀원-작업-순서--ai-가-그대로-따라-한다).

## 꼭 지킬 것

- **로컬에서 글·댓글을 써 보지 마세요.** 개발 서버도 실제 사이트 DB 에 연결돼 있어서 진짜로 올라갑니다.
- **키·비밀번호를 코드나 PR 에 적지 마세요.** 저장소는 누구나 볼 수 있습니다.
- `scripts/` `migrations/` `.github/` `src/app/admin/` `src/app/api/` 는 건드리지 마세요(운영자 전용).
- 게임은 `src/app/games/<이름>/` 안에서만 만듭니다 — 템플릿은 `src/app/games/_template/`.
- PR 에는 PC·모바일 화면 캡처를 붙여 주세요.

## 그다음은?

운영자가 PR 을 보고 합치면 몇 분 뒤 https://www.bookwiki.co.kr 에 반영됩니다.
고칠 점이 있으면 PR 에 댓글이 달리고, 같은 브랜치에 고쳐서 다시 push 하면 PR 에 자동으로 붙습니다.
