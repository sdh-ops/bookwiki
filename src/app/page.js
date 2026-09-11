"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { POST_COLUMNS } from "@/lib/columns";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Banner from "@/components/Banner";
import SiteFooter from "@/components/SiteFooter";
import { PostRow, PostCard } from "@/components/board/PostListItems";
import Pagination from "@/components/board/Pagination";
import BoardCalendar from "@/components/board/BoardCalendar";
import { fetchVisibleCategories } from "@/lib/postCategories";
import { BOARD_NAMES, LIST_TITLES, buildListHref, readListPosition, clearListScroll } from "@/lib/boards";

const POSTS_PER_PAGE = 20;
const WRITABLE_FROM_LIST = new Set(["job", "free"]);

// 사이드바 주간 베스트 — 최근 7일 글을 점수(조회 + 댓글×5, 오래될수록 감쇠)로 줄 세운다
async function fetchWeeklyBest() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const { data, error } = await supabase
    .from("bw_posts")
    .select("id, title, view_count, comment_count, created_at")
    .eq("is_deleted", false)
    .gte("created_at", oneWeekAgo.toISOString())
    .limit(400);
  if (error) {
    console.error("[home] weekly best:", error.message);
    return [];
  }
  const now = new Date();
  return (data || [])
    .map((p) => {
      const daysOld = Math.floor((now - new Date(p.created_at)) / 86400000);
      const baseScore = (p.view_count || 0) + (p.comment_count || 0) * 5;
      return { ...p, baseScore, hotScore: baseScore / (daysOld + 1) };
    })
    .filter((p) => p.baseScore >= 20)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 5);
}

/**
 * 목록 조회. 페이지·검색어·말머리·필터 전부 서버에서 거른다.
 * (말머리는 예전에 받아 온 20개 안에서만 걸러서, 말머리를 고르면 몇 개만 보이고
 *  페이지 수는 전체 기준으로 남는 어긋남이 있었다.)
 */
async function fetchPostList({ board, page, q, jobFilter, category }) {
  const offset = (page - 1) * POSTS_PER_PAGE;
  const base = (columns, opts) => supabase.from("bw_posts").select(columns, opts).eq("is_deleted", false);
  const ordered = (query) =>
    query.order("is_notice", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + POSTS_PER_PAGE - 1);

  if (q) {
    let query = base(POST_COLUMNS, { count: "exact" }).ilike("title", `%${q}%`);
    if (board !== "all" && board !== "hot") query = query.eq("board_type", board);
    const { data, count, error } = await ordered(query);
    if (error) throw error;
    return { posts: data || [], pinned: [], count: count || 0 };
  }

  const applyFilters = (query) => {
    let next = query;
    if (board === "hot") next = next.eq("is_hot", true);
    else if (board !== "all") next = next.eq("board_type", board);
    if (board === "job") {
      // 자동 수집 글만 페이지로 넘긴다 — 직접 작성글은 1페이지 위에 따로 고정
      next = next.eq("is_auto", true).not("author", "ilike", "%다산북스%").not("title", "ilike", "%다산북스%");
      if (jobFilter === "hiring" || jobFilter === "seeking") next = next.eq("job_type", jobFilter);
    }
    if (board === "free" && category) next = next.ilike("title", `%[${category}]%`);
    return next;
  };

  let pinned = [];
  if (board === "job") {
    // 직접 작성글(다산북스 포함). is_auto 를 관리자가 true 로 바꾼 글은 자동 쪽으로 간다.
    let direct = base(POST_COLUMNS).eq("board_type", "job").or("is_auto.eq.false,is_auto.is.null");
    if (jobFilter === "hiring" || jobFilter === "seeking") direct = direct.eq("job_type", jobFilter);
    const { data, error } = await direct.order("is_notice", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    pinned = data || [];
  }

  const [listRes, countRes] = await Promise.all([
    ordered(applyFilters(base(POST_COLUMNS))),
    applyFilters(base("id", { count: "exact", head: true })),
  ]);
  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;
  return { posts: listRes.data || [], pinned, count: countRes.count || 0 };
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="글 목록을 불러오는 중">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 md:h-10 rounded-md bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

function AiPreparing() {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-10 md:p-20 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-6xl mb-6" aria-hidden="true">🏗️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">AI 허브 서비스 준비 중</h2>
        <p className="text-gray-500 text-sm md:text-base leading-relaxed font-medium mb-6">출판 실무자의 업무를 도울 AI 도구를 준비하고 있습니다.</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
          </span>
          현재 집중 개발 중
        </div>
      </div>
    </div>
  );
}

// 목록/캘린더 · 말머리 같은 작은 전환 버튼 (진짜 링크 — 뒤로가기로 되돌아온다)
function Chip({ href, selected, children, tone = "default", title }) {
  const base = "shrink-0 inline-flex items-center h-9 md:h-8 px-3 text-sm md:text-xs rounded-full border transition";
  const style = selected
    ? "bg-[#355E3B] text-white border-[#355E3B] font-bold"
    : tone === "sponsor"
    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";
  return (
    <Link href={href} aria-current={selected ? "true" : undefined} className={`${base} ${style}`} title={title}>
      {children}
    </Link>
  );
}

function EmptyState({ q, board, category, clearSearchHref }) {
  let message = "아직 글이 없습니다.";
  let action = null;
  if (q) {
    message = `‘${q}’에 맞는 제목이 없습니다. 다른 낱말로 찾아보세요.`;
    action = (
      <Link href={clearSearchHref} className="text-sm font-bold text-[#355E3B] underline underline-offset-2">
        검색 지우기
      </Link>
    );
  } else if (board === "free" && category) {
    message = `[${category}] 말머리 글이 아직 없습니다.`;
    action = (
      <Link href="/?board=free" className="text-sm font-bold text-[#355E3B] underline underline-offset-2">
        톡톡 전체 보기
      </Link>
    );
  } else if (WRITABLE_FROM_LIST.has(board)) {
    action = (
      <Link href={`/write?board=${board}`} className="text-sm font-bold text-[#355E3B] underline underline-offset-2">
        첫 글 쓰기
      </Link>
    );
  }
  return (
    <div className="py-14 text-center bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-sm text-gray-500 mb-3">{message}</p>
      {action}
    </div>
  );
}

function PostList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentBoard = searchParams.get("board") || "all";
  const currentPage = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
  const view = searchParams.get("view") === "calendar" ? "calendar" : "list";
  const jobFilter = searchParams.get("filter") || "all";
  const category = searchParams.get("category") || "";
  const q = searchParams.get("q") || "";

  // 조회 결과는 「어떤 조건으로 받은 것인지(key)」와 함께 둔다.
  // 조건이 바뀌면 key 가 달라져 자동으로 「불러오는 중」이 되고, 늦게 온 옛 응답은 버려진다.
  const [result, setResult] = useState({ key: null, posts: [], pinned: [], count: 0, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [bestPosts, setBestPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [freeCategories, setFreeCategories] = useState([]);
  const [searchInput, setSearchInput] = useState(q);

  // 주소의 검색어가 바뀌면(뒤로가기·검색 지우기) 입력칸도 따라간다
  const [syncedQ, setSyncedQ] = useState(q);
  if (syncedQ !== q) {
    setSyncedQ(q);
    setSearchInput(q);
  }

  // 톡톡 말머리 (스폰서 말머리는 광고 게재중일 때만 내려온다)
  useEffect(() => {
    let cancelled = false;
    fetchVisibleCategories("free").then((rows) => !cancelled && setFreeCategories(rows));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklyBest().then((rows) => !cancelled && setBestPosts(rows));
    supabase.auth.getUser().then(({ data }) => !cancelled && setUser(data.user));
    return () => {
      cancelled = true;
    };
  }, []);

  const showsList = currentBoard !== "ai" && !(view === "calendar" && (currentBoard === "support" || currentBoard === "job"));

  const requestKey = JSON.stringify([currentBoard, currentPage, q, jobFilter, category, reloadKey]);

  useEffect(() => {
    if (!showsList) return;
    let cancelled = false;
    fetchPostList({ board: currentBoard, page: currentPage, q, jobFilter, category })
      .then(({ posts: rows, pinned, count }) => {
        if (!cancelled) setResult({ key: requestKey, posts: rows, pinned, count, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[home] list:", err?.message || err);
        setResult({ key: requestKey, posts: [], pinned: [], count: 0, error: "글 목록을 불러오지 못했습니다." });
      });
    return () => {
      cancelled = true;
    };
  }, [showsList, requestKey, currentBoard, currentPage, q, jobFilter, category]);

  const loading = showsList && result.key !== requestKey;
  const { posts, pinned: pinnedPosts, count: totalCount, error: loadError } = result;

  // 글을 보고 돌아왔으면 보던 자리로 스크롤 (목록이 비동기로 그려져 브라우저가 스스로 못 한다)
  useEffect(() => {
    if (loading) return;
    const saved = readListPosition();
    const here = window.location.pathname + window.location.search;
    if (saved?.url === here && typeof saved.scrollY === "number") {
      // rAF 는 탭이 가려져 있으면 돌지 않으므로 타이머로 (effect 는 이미 그린 뒤라 바로 스크롤해도 된다)
      setTimeout(() => window.scrollTo(0, saved.scrollY), 0);
      clearListScroll();
    }
  }, [loading]);

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);
  const listParams = { board: currentBoard, q, filter: jobFilter, category, view };
  const hrefForPage = (page) => buildListHref({ ...listParams, page });
  const clearSearchHref = buildListHref({ board: currentBoard });

  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchInput.trim();
    if (!term) return;
    router.push(buildListHref({ board: currentBoard, q: term }));
  };

  const notices = posts.filter((p) => p.is_notice);
  const normals = posts.filter((p) => !p.is_notice);
  const pinned = currentBoard === "job" && currentPage === 1 && !q ? pinnedPosts : [];
  const isEmpty = notices.length + normals.length + pinned.length === 0;
  const listNumber = (idx) => totalCount - (currentPage - 1) * POSTS_PER_PAGE - idx;

  const listTitle = q ? `‘${q}’ 검색 결과` : LIST_TITLES[currentBoard] || `${BOARD_NAMES[currentBoard] || ""} 최신글`;
  const canWriteHere = currentBoard !== "ai" && currentBoard !== "support";
  const writeHref = WRITABLE_FROM_LIST.has(currentBoard) ? `/write?board=${currentBoard}` : "/write";

  return (
    <div className="flex flex-col min-h-screen pt-4">
      <Banner placement="home_top" />

      <section className="w-full max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 order-2 lg:order-1 min-w-0">
          <div className="flex justify-between items-center gap-3 mb-3 pb-2 border-b-2 border-[#355E3B]">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <h1 className="text-lg font-bold text-[#355E3B] truncate">{listTitle}</h1>
              {(currentBoard === "support" || currentBoard === "job") && !q && (
                <div className="flex gap-1.5">
                  <Chip href={buildListHref({ board: currentBoard })} selected={view === "list"}>
                    목록
                  </Chip>
                  <Chip href={buildListHref({ board: currentBoard, view: "calendar" })} selected={view === "calendar"}>
                    📅 캘린더
                  </Chip>
                </div>
              )}
            </div>
            {canWriteHere && (
              // 모바일은 헤더의 글쓰기(지금 게시판을 골라 둔다)가 같은 일을 하므로 숨긴다
              <Link href={writeHref} className="hidden md:inline-flex items-center h-8 text-xs font-bold bg-[#355E3B] text-white px-3 rounded-md hover:bg-[#2A4A2E] shrink-0">
                글쓰기
              </Link>
            )}
          </div>

          {/* 톡톡 말머리 — 모바일에선 가로로 넘겨 본다 */}
          {currentBoard === "free" && !q && freeCategories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-3">
              <Chip href="/?board=free" selected={!category}>
                전체
              </Chip>
              {freeCategories.map((cat) => (
                <Chip
                  key={cat.label}
                  href={buildListHref({ board: "free", category: cat.label })}
                  selected={category === cat.label}
                  tone={cat.is_sponsored ? "sponsor" : "default"}
                  title={cat.is_sponsored ? `${cat.sponsor_advertiser} 제휴 말머리` : undefined}
                >
                  {cat.label}
                  {cat.is_sponsored && <span className={`ml-1 text-[9px] align-top ${category === cat.label ? "text-white/70" : "text-amber-500"}`}>AD</span>}
                </Chip>
              ))}
            </div>
          )}

          {q && (
            <div className="mb-3 flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-blue-800">
                {BOARD_NAMES[currentBoard] ? `${BOARD_NAMES[currentBoard]}에서 ` : ""}
                <span className="font-bold">‘{q}’</span> {loading ? "찾는 중…" : `${totalCount.toLocaleString()}개`}
              </span>
              <Link href={clearSearchHref} className="shrink-0 text-sm text-blue-700 hover:text-blue-900 font-medium py-1">
                검색 지우기
              </Link>
            </div>
          )}

          {currentBoard === "ai" ? (
            <AiPreparing />
          ) : !showsList ? (
            <BoardCalendar board={currentBoard} />
          ) : (
            <>
              {loading ? (
                <ListSkeleton />
              ) : loadError ? (
                <div className="py-14 text-center bg-red-50 rounded-lg border border-red-100">
                  <p className="text-sm text-red-700 mb-3">{loadError} 인터넷 연결을 확인해 주세요.</p>
                  <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="min-h-10 px-4 text-sm font-bold text-white bg-[#355E3B] rounded-md">
                    다시 시도
                  </button>
                </div>
              ) : isEmpty ? (
                <EmptyState q={q} board={currentBoard} category={category} clearSearchHref={clearSearchHref} />
              ) : (
                <>
                  <table className="w-full text-sm text-left hidden md:table">
                    <thead className="text-xs text-gray-500 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-2 py-2 font-medium w-16">번호</th>
                        <th scope="col" className="px-2 py-2 font-medium">제목</th>
                        <th scope="col" className="px-2 py-2 font-medium w-24">글쓴이</th>
                        <th scope="col" className="px-2 py-2 font-medium w-24 text-center">날짜</th>
                        <th scope="col" className="px-2 py-2 font-medium w-16 text-center">조회</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {notices.map((post) => (
                        <PostRow key={post.id} post={post} tone="notice" />
                      ))}
                      {pinned.map((post) => (
                        <PostRow key={post.id} post={post} tone="pinned" />
                      ))}
                      {normals.map((post, idx) => (
                        <PostRow key={post.id} post={post} number={listNumber(idx)} />
                      ))}
                    </tbody>
                  </table>

                  <div className="md:hidden space-y-2">
                    {notices.map((post) => (
                      <PostCard key={post.id} post={post} tone="notice" />
                    ))}
                    {pinned.filter((p) => !p.is_notice).map((post) => (
                      <PostCard key={post.id} post={post} tone="pinned" />
                    ))}
                    {normals.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </>
              )}

              {!loading && !loadError && (
                <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} hrefFor={hrefForPage} />
              )}

              <form role="search" onSubmit={handleSearch} className="relative max-w-md mx-auto mt-8 mb-4">
                <label htmlFor="board-search" className="sr-only">
                  {BOARD_NAMES[currentBoard] || "전체"}에서 제목 검색
                </label>
                <input
                  id="board-search"
                  type="search"
                  enterKeyHint="search"
                  placeholder={`${BOARD_NAMES[currentBoard] || "전체"}에서 제목 검색`}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-11 pl-4 pr-12 border border-gray-300 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#355E3B]"
                />
                <button
                  type="submit"
                  aria-label="검색"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-md text-gray-500 hover:text-[#355E3B] hover:bg-gray-50"
                >
                  🔍
                </button>
              </form>
            </>
          )}
        </div>

        <aside className="lg:col-span-1 order-1 lg:order-2">
          {bestPosts.length > 0 && (
            <div className="border border-gray-200 hidden lg:block">
              <div className="bg-yellow-400 text-gray-800 px-3 py-2 text-xs font-bold border-b border-gray-200 flex items-center gap-1">
                <span aria-hidden="true">🔥</span> 주간 베스트
              </div>
              <ol className="text-xs">
                {bestPosts.map((post, idx) => (
                  <li key={post.id} className="border-b border-gray-100 last:border-0">
                    <Link href={`/post/${post.id}`} className="block px-3 py-2 hover:bg-gray-50 text-gray-700">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 font-bold">{idx + 1}</span>
                        <span className="truncate flex-1">{post.title}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1 ml-4">
                        조회 {post.view_count || 0} · 댓글 {post.comment_count || 0}
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {user && (
            <div className="border border-gray-200 mt-4 hidden lg:block">
              <div className="bg-gray-100 px-3 py-2 text-xs font-bold border-b border-gray-200">내 활동</div>
              <ul className="text-xs">
                <li className="border-b border-gray-100">
                  <Link href="/mypage" className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700">
                    내가 쓴 글
                  </Link>
                </li>
                <li>
                  <Link href="/mypage?tab=comments" className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700">
                    내가 쓴 댓글
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* 사이드 배너 — PC 전용(내부 wrapClass 가 hidden lg:block). 로그인 여부와 무관하게 항상 노출 */}
          <Banner placement="sidebar" />
        </aside>
      </section>

      <SiteFooter />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-screen pt-4">
          <main className="flex-grow max-w-6xl mx-auto px-4 w-full mt-10">
            <ListSkeleton />
          </main>
        </div>
      }
    >
      <PostList />
    </Suspense>
  );
}
