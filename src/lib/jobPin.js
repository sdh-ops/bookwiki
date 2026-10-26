/**
 * 구인구직 하이라이트(1페이지 위 고정) 기한.
 *
 * 직접 작성글(is_auto 가 true 가 아닌 글)은 1페이지 위에 고정되는데, 기한이 지나면
 * 스스로 내려와 일반 목록에 섞인다. 예전엔 관리자가 「자동 전환」으로 하나씩 내렸다(2026-10-26 요청).
 *  - 마감일이 있는 글: 마감일 당일까지 고정
 *  - 충원시(deadline 비어 있음): 올린 날(KST) + 30일이 되는 날까지 고정
 *    본문에만 마감일이 적힌 옛 글도 deadline 이 비어 있으므로 여기로 온다.
 *
 * DB 값은 바꾸지 않는다 — 목록을 그릴 때마다 오늘(KST) 날짜로 판정한다(크론 없음).
 * 판정 규칙은 이 파일 하나에만 둔다: 목록 쿼리(PostgREST 필터)와 관리자 화면(JS 판정)이 같은 기준을 써야
 * 「목록에선 내려갔는데 관리자 화면엔 고정으로 보이는」 어긋남이 안 생긴다.
 */

export const OPEN_ENDED_PIN_DAYS = 30;

const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 3600 * 1000;

const kstToday = (now) => new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
const kstMidnightMs = (ymd) => Date.parse(`${ymd}T00:00:00+09:00`);

/** 오늘(KST)과 충원시 글의 고정 하한(올린 시각이 이 뒤면 아직 고정) */
export function jobPinCutoffs(now = new Date()) {
  const today = kstToday(now);
  const createdSince = new Date(kstMidnightMs(today) - OPEN_ENDED_PIN_DAYS * DAY_MS).toISOString();
  return { today, createdSince };
}

/** 고정 목록: `.not("is_auto", "is", true)` 와 함께 쓰는 기한 안 조건 */
export function pinnedJobOrFilter({ today, createdSince }) {
  return `deadline.gte.${today},and(deadline.is.null,created_at.gte.${createdSince})`;
}

/**
 * 일반 목록: 자동 수집 글(다산북스 중복 제외 — 직접 작성글과 겹친다) + 기한이 지난 직접 작성글.
 * 기한 지난 직접 작성글에는 다산북스 제외를 걸지 않는다 — 걸면 그 글이 어디에도 안 보인다.
 */
export function regularJobOrFilter({ today, createdSince }) {
  const auto = "and(is_auto.is.true,author.not.ilike.*다산북스*,title.not.ilike.*다산북스*)";
  const expired = `and(is_auto.not.is.true,or(deadline.lt.${today},and(deadline.is.null,created_at.lt.${createdSince})))`;
  return `${auto},${expired}`;
}

/** 이 글이 지금 1페이지 위에 고정되는가 — 목록 쿼리와 같은 기준 */
export function isJobPinned(post, cutoffs = jobPinCutoffs()) {
  if (!post || post.board_type !== "job" || post.is_auto === true) return false;
  if (post.deadline) return post.deadline >= cutoffs.today;
  return Date.parse(post.created_at) >= Date.parse(cutoffs.createdSince);
}

/** 마감일까지 남은 날(당일 0, 지나면 음수) */
export function daysUntilDeadline(deadline, now = new Date()) {
  return Math.round((kstMidnightMs(deadline) - kstMidnightMs(kstToday(now))) / DAY_MS);
}

/** 올린 날(KST)부터 지난 날(올린 당일 0) — 30 까지 고정, 31 부터 내려간다 */
export function daysSinceUpload(createdAt, now = new Date()) {
  const uploaded = kstToday(new Date(createdAt));
  return Math.round((kstMidnightMs(kstToday(now)) - kstMidnightMs(uploaded)) / DAY_MS);
}
