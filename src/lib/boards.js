/**
 * 게시판 정본.
 *
 * 예전에는 헤더·홈·베스트셀러·글 상세·글 수정이 게시판 목록을 각자 들고 있어서
 * 한 곳만 바뀌면 화면마다 이름이 달라졌다(수정 화면만 톡톡을 '자유게시판'이라 불렀다).
 * 게시판을 더하거나 이름을 바꿀 땐 이 파일만 고친다.
 */

// 헤더 탭 순서 그대로
export const NAV_TABS = [
  { id: "all", name: "전체", href: "/" },
  { id: "hot", name: "HOT", href: "/?board=hot" },
  { id: "job", name: "구인구직", href: "/?board=job" },
  { id: "support", name: "지원사업", href: "/?board=support" },
  { id: "free", name: "톡톡", href: "/?board=free" },
  { id: "bestseller", name: "베스트셀러", href: "/bestseller" },
  { id: "ai", name: "AI허브", href: "/?board=ai" },
];

// 글이 실제로 속하는 게시판 (bw_posts.board_type)
export const BOARD_NAMES = {
  job: "구인구직",
  support: "지원사업",
  free: "톡톡",
  ai: "AI허브",
};

// 목록 화면 제목
export const LIST_TITLES = {
  all: "전체 최신글",
  hot: "HOT 인기글 (최근 7일)",
  job: "구인구직 최신글",
  support: "지원사업 최신글",
  free: "톡톡 최신글",
  ai: "AI 허브",
};

export function boardName(boardType) {
  return BOARD_NAMES[boardType] || boardType || "";
}

export function boardHref(boardType) {
  return boardType && boardType !== "all" ? `/?board=${boardType}` : "/";
}

/**
 * 목록 주소를 만든다. 값이 비었거나 기본값이면 주소에서 뺀다.
 * 페이지를 넘길 때 검색어·말머리·필터가 사라지던 문제는 여기서 함께 막는다 —
 * 호출하는 쪽이 현재 조건을 통째로 넘기고 바꿀 값만 덮어쓴다.
 */
export function buildListHref({ board, page, q, filter, category, view } = {}) {
  const params = new URLSearchParams();
  if (board && board !== "all") params.set("board", board);
  if (q) params.set("q", q);
  if (filter && filter !== "all") params.set("filter", filter);
  if (category && category !== "all") params.set("category", category);
  if (view && view !== "list") params.set("view", view);
  if (page && Number(page) > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

// 글 상세처럼 주소에 게시판이 안 드러나는 화면이 헤더에 「지금 이 게시판」을 알려 준다
export const ACTIVE_BOARD_EVENT = "bw:active-board";

// 헤더가 페이지보다 늦게 붙어도(새로고침 직후 Suspense 하이드레이션 순서) 놓치지 않게 마지막 값을 들고 있는다
let announced = null;

export function announceActiveBoard(boardType) {
  if (typeof window === "undefined") return;
  announced = { path: window.location.pathname, board: boardType || null };
  window.dispatchEvent(new CustomEvent(ACTIVE_BOARD_EVENT, { detail: announced }));
}

export function subscribeActiveBoard(callback) {
  window.addEventListener(ACTIVE_BOARD_EVENT, callback);
  return () => window.removeEventListener(ACTIVE_BOARD_EVENT, callback);
}

export function getAnnouncedBoard() {
  return announced;
}

// ─── 목록 ↔ 글 상세 사이의 「돌아가기」 ─────────────────────────────
// 글을 열 때 보던 목록 주소와 스크롤 위치를 적어 두고,
// 글 상세의 「목록으로」와 뒤로가기 복귀가 같은 자리로 돌아오게 한다.
const LIST_STATE_KEY = "bw_list_state";

export function rememberListPosition() {
  try {
    sessionStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({
        url: window.location.pathname + window.location.search,
        scrollY: window.scrollY,
        at: Date.now(),
      })
    );
  } catch {
    // 사파리 개인정보 보호 모드 등 — 기억만 못 할 뿐 이동은 정상
  }
}

export function readListPosition() {
  try {
    const raw = sessionStorage.getItem(LIST_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearListScroll() {
  try {
    const state = readListPosition();
    if (state) {
      sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify({ ...state, scrollY: null }));
    }
  } catch {
    // 무시 — 다음 번 목록 진입 때 덮어쓴다
  }
}

/**
 * 글 상세의 「목록으로」가 갈 주소.
 * 방금 보던 목록이 이 글을 담을 수 있는 목록(같은 게시판·전체·HOT·검색)이면 그리로,
 * 공유 링크로 바로 들어왔거나 다른 게시판을 보다 왔으면 이 글의 게시판 1페이지로.
 */
export function backToListHref(postBoardType) {
  const fallback = boardHref(postBoardType);
  const state = readListPosition();
  if (!state?.url?.startsWith("/?") && state?.url !== "/") return fallback;
  const params = new URLSearchParams(state.url.split("?")[1] || "");
  const listBoard = params.get("board") || "all";
  if (listBoard === "all" || listBoard === "hot" || listBoard === postBoardType) {
    return state.url;
  }
  return fallback;
}
