# 북위키 — AI 작업 안내서

> Claude Code · Codex · Cursor · Copilot 등 **AI 가 이 저장소에서 일을 시작하기 전에 읽는 파일**이다.
> 사람용 안내는 [CONTRIBUTING.md](CONTRIBUTING.md). 둘이 어긋나면 이 파일이 맞다.

---

## 0. 먼저 확인 — 이 세션은 누구의 것인가

```bash
gh api user --jq .login     # GitHub 로그인 아이디
git remote -v               # origin 이 어디를 가리키나
```

| 결과 | 너의 역할 | 할 수 있는 것 |
|---|---|---|
| `sdh-ops` | **저장소 주인** 세션 | main 에 직접 push 가능 (§8 규칙 준수) |
| 그 외 누구든 | **팀원(기여자)** 세션 | **`sdh-ops/bookwiki` 에 직접 push 하지 않는다.** 자기 포크에서 작업하고 PR 만 보낸다 (§2) |

팀원 세션에서 `sdh-ops/bookwiki` 로 push 가 된다면 권한 설정이 잘못된 것이다 — 멈추고 사용자에게 알린다.

---

## 1. 프로젝트 한눈에

- **북위키** — 출판업계 종사자 커뮤니티. 라이브: https://www.bookwiki.co.kr
- 게시판(구인구직·지원사업·톡톡·HOT), 서점 베스트셀러 비교, 배너 광고, 관리자 화면.
- **스택**: Next.js 16 (App Router, Turbopack) · React 19 (React Compiler 켜짐) · Tailwind CSS 4 · Supabase(PostgreSQL) · JavaScript(타입스크립트 아님)
- **배포**: `sdh-ops/bookwiki` 의 **main 에 들어가면 Vercel 이 곧바로 라이브에 배포**한다. 스테이징은 없다.
- **DB**: Supabase 프로젝트 하나(운영)뿐. **로컬 개발 서버도 라이브 DB 에 붙는다** (§5).
- **자동 수집**: GitHub Actions 크론이 베스트셀러·구인·지원사업을 매일 모은다(`scripts/`, `.github/workflows/`).

```
src/
├── app/                 # 화면(라우트). 폴더 = 주소
│   ├── page.js          # 홈 = 게시판 목록 (?board=job|support|free|hot|ai)
│   ├── post/[id]/       # 글 상세 (page.js 서버 + PostDetailClient.jsx 브라우저)
│   ├── write/ mypage/ login/ bestseller/ calendar/
│   ├── games/           # ← 팀원 게임은 여기 (§6)
│   ├── admin/           # 운영자 화면 — 손대지 않는다
│   └── api/             # 서버 API — 손대지 않는다
├── components/          # Header, Modal, NotifyHost, board/, post/ …
└── lib/                 # boards.js(게시판 정본) · notify.js(알림) · date.js · columns.js · supabase.js
scripts/                 # 수집 스크립트 (크론이 돌림) — 손대지 않는다
migrations/              # DB 변경 SQL — 손대지 않는다
```

**명령어**
```bash
npm install                      # 처음 한 번 (--legacy-peer-deps 는 쓰지 않는다 — 차트용 react-is 가 빠져 빌드가 깨진다)
npm run dev                      # 개발 서버 http://localhost:3000
npm run build                    # PR 전에 반드시 통과해야 한다
```
Node 20 이상(22 권장).

---

## 2. 팀원 작업 순서 — AI 가 그대로 따라 한다

### 처음 한 번 (환경 준비)
```bash
gh auth status                               # 안 되어 있으면 사용자에게 `gh auth login` 을 부탁
gh repo fork sdh-ops/bookwiki --clone        # 내 계정으로 복사 + 내 컴퓨터로 받기
cd bookwiki
git remote -v                                # origin = 내 포크, upstream = sdh-ops/bookwiki 여야 한다
cp .env.example .env.local                   # 값 두 개는 사용자가 저장소 주인에게 받아 넣는다
npm install
npm run dev
```
`.env.local` 에는 **공개 키 두 개만** 들어간다(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
다른 키(서비스 키, AI API 키 등)는 팀원에게 주지 않는다 — 없어도 게시판·게임 개발에는 지장 없다.

### 작업 하나마다
```bash
git fetch upstream
git checkout -b feat/짧은-영문-설명 upstream/main    # 항상 최신 원본에서 새 브랜치
# … 작업 …
npm run build                                       # 통과 확인
git add <바꾼 파일만 이름으로>                        # git add -A 금지 — .env.local 등이 섞인다
git commit -m "feat(games): 출판 용어 퀴즈 추가"
git push -u origin feat/짧은-영문-설명
gh pr create --repo sdh-ops/bookwiki --base main --fill
```
- PR 설명은 `.github/pull_request_template.md` 칸을 채운다. **화면 캡처(PC·모바일)** 를 꼭 붙인다.
- PR 하나 = 주제 하나. 게임 추가와 다른 수정을 섞지 않는다.
- 커밋 메시지: `feat|fix|style|docs|refactor(범위): 한국어 설명`
- **PR 을 올려도 라이브에는 아무것도 바뀌지 않는다.** 저장소 주인이 확인하고 머지해야 사이트에 나간다.
- PR 을 올린 뒤 사용자에게 **PR 주소**를 알려 주고 「운영자에게 이 주소를 보내 주세요」라고 안내한다.
- 수정 요청 댓글이 오면 같은 브랜치에 커밋을 더해 push 한다 — PR 에 자동으로 붙는다. PR 을 새로 만들지 않는다.

---

## 3. 건드려도 되는 곳 / 안 되는 곳

| 구분 | 경로 | 규칙 |
|---|---|---|
| ✅ 자유 | `src/app/games/<내-게임>/`, `public/games/<내-게임>/` | 마음껏 |
| ✅ 자유 | 새 컴포넌트 파일 추가 | 기존 파일을 고치지 않는 한 |
| ⚠️ 이유 필요 | `src/components/Header.jsx`, `src/app/layout.js`, `src/app/globals.css`, `src/lib/boards.js`, 기존 화면 수정 | PR 에 「왜 고쳤는지」를 적는다 |
| ⚠️ 이유 필요 | `package.json` 의존성 추가 | 꼭 필요한지·크기를 PR 에 적는다. 가능하면 추가하지 않는다 |
| ⛔ 금지 | `scripts/` `migrations/` `.github/` `src/app/admin/` `src/app/api/` | 저장소 주인 전용 |
| ⛔ 금지 | `src/lib/supabase.js` `src/lib/columns.js` `src/lib/account.js` `next.config.mjs` | 보안·배포에 직결 |
| ⛔ 금지 | 로그인·비밀번호·권한 관련 코드, `.env*` 파일 커밋 | |

PR 이 ⛔ 경로를 건드리면 자동 검사(`보호 구역 변경 알림`)가 빨갛게 뜬다.

---

## 4. 코드 규칙 — 이미 있는 것을 쓴다

- **알림**: `alert()` / `confirm()` 쓰지 않는다. `import { toast, confirmDialog } from "@/lib/notify"`
  - `toast("저장했습니다.")`, `toast("실패했습니다.", "error")`
  - `if (await confirmDialog({ title: "삭제할까요?", confirmLabel: "삭제", danger: true })) { … }`
- **팝업 창**: `@/components/Modal` (Esc·바깥 누르기·포커스 처리가 들어 있다). 직접 만들지 않는다.
- **게시판 이름·주소**: `@/lib/boards` 의 `BOARD_NAMES`, `boardHref()`, `buildListHref()`. 게시판 목록을 새로 적지 않는다.
- **날짜**: `@/lib/date` (한국 시간 기준). `new Date(...).toLocaleString()` 을 직접 쓰지 않는다.
- **이동**: 누르면 다른 화면으로 가는 건 `<Link href>` (진짜 링크). `div onClick + router.push` 로 만들지 않는다.
- **모바일 먼저**: 폭 375px 에서 가로로 넘치지 않을 것. 누르는 칸 40px 이상. 입력칸 글자 16px(`text-base md:text-sm`) — 아이폰이 확대하지 않게.
- **스타일**: Tailwind 4. 주 색 `#355E3B`(진녹색). 새 색·새 글꼴은 이유가 있을 때만.
- **서버 컴포넌트**에서 `jsdom` 계열(`isomorphic-dompurify` 등)을 쓰지 않는다 — Vercel 에서 페이지가 500 이 난다(2026-09 실제로 났다).
- **파일 한 개 800줄 이하.** 넘으면 나눈다.
- **화면 문구**: 한국어, 부드러운 존댓말(「~해 주세요」). 오류 문구는 「무엇이 안 됐고 → 어떻게 하면 되는지」.
- `console.log` 를 남기지 않는다(오류는 `console.error`).

---

## 5. DB·보안 — 공개 저장소다

- **이 저장소는 누구나 볼 수 있다(public).** 키·비밀번호·개인정보를 코드·커밋·PR 설명에 절대 적지 않는다.
  2026-09 에 API 키가 코드에 박힌 채 공개된 적이 있다.
- **로컬 개발 서버도 라이브 DB 를 쓴다.** 로컬에서 글·댓글·투표·회원가입을 눌러 보면 **실제 사이트에 올라간다.**
  시험 삼아 쓰지 않는다. 게임은 DB 없이 만든다(§6).
- 테이블·컬럼·권한(RLS)이 필요하면 **코드로 만들지 말고** PR 설명의 「DB 요청」 칸에 무엇이 필요한지 적는다.
  저장소 주인이 설계해서 직접 적용한다.
- 조회할 때 `select("*")` 금지 — `@/lib/columns` 의 컬럼 목록을 쓴다(비밀번호 컬럼이 새지 않게).
  `insert(...)` 뒤에 결과가 필요하면 `.select("id")` 처럼 필요한 컬럼만.

---

## 6. 게임 만들기

1. `src/app/games/_template/` 폴더를 통째로 복사해 `src/app/games/<영문-소문자-이름>/` 으로 만든다.
   (`_` 로 시작하는 폴더는 주소가 생기지 않는다 — 템플릿은 그래서 안 보인다.)
2. `page.js` = 제목·설명(서버). `Game.jsx` = 게임 본체(`"use client"`). 필요하면 파일을 더 나눈다.
3. 확인 주소: `http://localhost:3000/games/<이름>`
4. **DB 없이** 만든다. 최고 점수 같은 건 `localStorage` 에(반드시 `try/catch` — 막힌 브라우저가 있다).
5. 그림·소리는 `public/games/<이름>/` 에, 합쳐서 1MB 이하. 외부 사이트에서 불러오지 않는다.
6. **헤더 메뉴에 올리는 건 저장소 주인이 머지 뒤에 결정한다.** `Header.jsx`·`boards.js` 는 고치지 않는다.
7. 점수판(순위표)처럼 DB 가 필요하면 PR 에 「DB 요청」으로 적는다 — 먼저 DB 없는 버전으로 올린다.

게임 완료 기준: 폰 폭(375px)에서 잘 보임 · 마우스·터치·키보드 모두 됨 · 새로고침해도 오류 없음 · `npm run build` 통과.

---

## 7. PR 올리기 전 체크리스트 (AI 가 스스로 확인)

- [ ] `npm run build` 통과
- [ ] 브라우저 콘솔에 빨간 오류 없음
- [ ] PC(1280px)·모바일(375px) 둘 다 확인, 캡처 첨부
- [ ] ⛔ 경로(§3)를 건드리지 않음
- [ ] 키·비밀번호·`.env*` 가 커밋에 없음 (`git show --stat` 로 확인)
- [ ] 라이브 DB 에 시험 데이터를 만들지 않음
- [ ] `alert`/`confirm`/`console.log` 없음

---

## 8. 저장소 주인(sdh-ops) 세션 전용

### 8-1. 팀원 PR 확인 → 라이브 반영 (주인이 「PR 확인해 줘」라고 하면)

**머지 = 라이브 배포다. 주인이 이 대화에서 분명히 「올려」「머지해」라고 하기 전에는 절대 머지하지 않는다.**

```bash
gh pr list --repo sdh-ops/bookwiki                 # 열린 PR
gh pr view <번호> --repo sdh-ops/bookwiki           # 설명·체크리스트
gh pr diff <번호> --repo sdh-ops/bookwiki --name-only
gh pr checks <번호> --repo sdh-ops/bookwiki         # 「빌드 통과」「보호 구역 변경 알림」
```
처음 기여한 사람의 PR 은 자동 검사가 「승인 대기」로 멈춰 있다 — 주인에게 알리고, 주인이 허락하면
`gh run list --repo sdh-ops/bookwiki --branch <PR 브랜치>` 로 run id 를 찾아
`gh api -X POST repos/sdh-ops/bookwiki/actions/runs/<id>/approve` 로 돌린다.

1. **읽기** — 바뀐 파일 전부를 읽는다. §3 ⛔ 경로가 있으면 가장 먼저 짚는다. 키·비밀번호·외부 스크립트·`dangerouslySetInnerHTML`·DB 쓰기 코드를 찾는다.
2. **돌려 보기** — `gh pr checkout <번호>` → `npm install` → `npm run build` → 개발 서버로 띄워
   PC(1280)·모바일(375) 화면을 직접 본다(가로 넘침·콘솔 오류·버튼 크기). 캡처를 주인에게 보여 준다.
   ⚠️ 로컬도 라이브 DB 다 — 확인하면서 글·댓글을 만들지 않는다.
3. **보고** — 「무엇이 바뀌었나 / 문제 / 고칠 것」을 짧게. 고칠 게 있으면 PR 댓글 초안을 만들어 주인에게 보여 주고,
   주인이 좋다고 하면 `gh pr comment <번호> --repo sdh-ops/bookwiki --body-file <파일>` 로 남긴다.
4. **주인이 「올려」라고 하면** — `git checkout main && git pull` 후
   `gh pr merge <번호> --repo sdh-ops/bookwiki --squash --delete-branch`.
   몇 분 뒤 Vercel 배포 상태(`gh api repos/sdh-ops/bookwiki/commits/<sha>/status --jq .state`)가 success 인지,
   라이브 주소가 200 인지 찍어서 알린다. 게임이면 헤더 메뉴에 올릴지 주인에게 묻는다(올린다면 `lib/boards.js` 는 주인 세션이 고친다).
5. 문제가 생기면 `git revert <머지 커밋>` → push 로 되돌린다(주인에게 먼저 알린다).

### 8-2. 주인 세션의 평소 작업

- main 에 바로 push 할 수 있다. **push = 몇 분 뒤 라이브.** 배포가 끝나면 라이브 상태 코드를 직접 찍는다
  (`curl -o /dev/null -w "%{http_code}" https://www.bookwiki.co.kr/...`). 화면이 보여도 500 일 수 있다.
- **DB 변경**: `migrations/NNN_설명.sql` (번호는 이어서) 을 쓰고, 적용은 Supabase 대시보드 SQL Editor 에 직접 붙여 넣는다.
  이 저장소엔 서비스 키가 없고 CLI 연결도 없다.
  - 권한은 컬럼 단위 GRANT 로 관리한다(`bw_posts`/`bw_comments` 는 password 제외). 컬럼을 추가하면 GRANT 도 같이.
  - 위험한 권한 회수는 SQL 파일 **맨 끝**에 둔다 — 중간에 실패하면 권한만 걷힌 채 사이트가 멈춘다.
- **팀원 PR 리뷰**: 「Files changed」 에서 §3 ⛔ 경로를 건드렸는지 먼저 본다. 자동 검사가 빨가면 그 파일을 꼭 읽는다.
- **팀원을 저장소 협업자(Collaborator)로 초대하지 않는다.** 개인 저장소 협업자는 쓰기 권한이라,
  Actions 비밀값(`SUPABASE_SERVICE_ROLE_KEY` 등)을 빼낼 수 있는 작업 파일을 브랜치에 올릴 수 있다.
  포크 PR 에는 비밀값이 전달되지 않는다. Vercel·Supabase 에도 초대하지 않는다.
- 크론 수집(`scripts/bestseller-final.js`) 은 운영 DB 에 쓴다. 로컬에서 저장까지 돌리지 않는다.
