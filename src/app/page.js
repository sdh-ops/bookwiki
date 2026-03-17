"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// Board type to Korean name mapping
const boardTypeNames = {
  job: "구인구직",
  support: "지원사업",
  free: "톡톡",
  ai: "AI허브",
};

const POSTS_PER_PAGE = 50;

// 톡톡 게시판 카테고리
const freeBoardCategories = [
  { id: "all", name: "전체" },
  { id: "모집", name: "모집" },
  { id: "후기", name: "후기" },
  { id: "잡담", name: "잡담" },
];

function PostList() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [hotPostIds, setHotPostIds] = useState([]);
  const [bestPosts, setBestPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [supportView, setSupportView] = useState("list"); // list or calendar
  const [jobFilter, setJobFilter] = useState("all"); // all, hiring, seeking
  const [freeFilter, setFreeFilter] = useState("all"); // 톡톡 카테고리 필터
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentBoard = searchParams.get("board") || "all";
  const pageParam = searchParams.get("page");
  const viewParam = searchParams.get("view");
  const filterParam = searchParams.get("filter");
  const categoryParam = searchParams.get("category");

  useEffect(() => {
    const page = parseInt(pageParam) || 1;
    setCurrentPage(page);
    if (viewParam === "calendar") setSupportView("calendar");
    else setSupportView("list");
    if (filterParam) setJobFilter(filterParam);
    else setJobFilter("all");
    if (categoryParam) setFreeFilter(categoryParam);
    else setFreeFilter("all");
  }, [pageParam, viewParam, filterParam, categoryParam]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const offset = (currentPage - 1) * POSTS_PER_PAGE;

      // Calculate one week ago for HOT posts
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Fetch HOT posts (top 10 by composite score in last week)
      // HOT Score = view_count + (comment_count * 10)
      // This combines views and engagement (comments are weighted higher)
      const { data: hotPosts } = await supabase
        .from("bw_posts")
        .select("id, title, view_count, comment_count, board_type, created_at")
        .gte("created_at", oneWeekAgo.toISOString())
        .order("view_count", { ascending: false })
        .limit(50);

      if (hotPosts) {
        // Calculate composite score and sort
        const scored = hotPosts.map(p => ({
          ...p,
          hotScore: (p.view_count || 0) + ((p.comment_count || 0) * 10)
        }));
        scored.sort((a, b) => b.hotScore - a.hotScore);
        const top10 = scored.slice(0, 10);
        setHotPostIds(top10.map(p => p.id));
        setBestPosts(top10);
      }

      let query;
      let countQuery;

      if (currentBoard === "hot") {
        query = supabase
          .from("bw_posts")
          .select("*")
          .gte("created_at", oneWeekAgo.toISOString())
          .order("view_count", { ascending: false })
          .range(offset, offset + POSTS_PER_PAGE - 1);
        countQuery = supabase
          .from("bw_posts")
          .select("*", { count: "exact", head: true })
          .gte("created_at", oneWeekAgo.toISOString());
      } else if (currentBoard === "all") {
        query = supabase
          .from("bw_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + POSTS_PER_PAGE - 1);
        countQuery = supabase
          .from("bw_posts")
          .select("*", { count: "exact", head: true });
      } else {
        query = supabase
          .from("bw_posts")
          .select("*")
          .eq("board_type", currentBoard)
          .order("created_at", { ascending: false })
          .range(offset, offset + POSTS_PER_PAGE - 1);
        countQuery = supabase
          .from("bw_posts")
          .select("*", { count: "exact", head: true })
          .eq("board_type", currentBoard);
      }

      const [{ data: postsData }, { count }] = await Promise.all([query, countQuery]);
      if (postsData) setPosts(postsData);
      if (count !== null) setTotalCount(count);

      // Check login and admin
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        try {
          const { data: adminData } = await supabase
            .from("bw_admins")
            .select("email")
            .eq("email", user.email)
            .maybeSingle();
          setIsAdmin(!!adminData);
        } catch (e) {
          console.log("Admin check error:", e);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [currentBoard, currentPage]);

  // Load calendar events for support board
  useEffect(() => {
    async function fetchCalendarEvents() {
      if (currentBoard !== "support") return;
      const { data: posts } = await supabase
        .from("bw_posts")
        .select("id, title, content, created_at")
        .eq("board_type", "support")
        .order("created_at", { ascending: false });

      if (posts) {
        const eventsWithDeadlines = posts
          .map(post => {
            const deadlineMatch = post.content?.match(/마감일:<\/strong>\s*(\d{4}-\d{2}-\d{2})/);
            if (deadlineMatch) {
              return { ...post, deadline: deadlineMatch[1] };
            }
            return null;
          })
          .filter(Boolean);
        setCalendarEvents(eventsWithDeadlines);
      }
    }
    fetchCalendarEvents();
  }, [currentBoard]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const boardCategories = [
    { name: "전체", id: "all" },
    { name: "HOT", id: "hot" },
    { name: "구인구직", id: "job" },
    { name: "지원사업", id: "support" },
    { name: "톡톡", id: "free" },
    { name: "AI허브", id: "ai" },
  ];

  const handleBoardClick = (id) => {
    if (id === "all") {
      router.push("/");
    } else {
      router.push(`/?board=${id}`);
    }
  };

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    const params = new URLSearchParams();
    if (currentBoard !== "all") params.set("board", currentBoard);
    if (page > 1) params.set("page", page.toString());
    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : "/");
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Calendar helpers
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calFirstDay = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const getEventsForDay = (day) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarEvents.filter(e => e.deadline === dateStr);
  };

  const isToday = (day) => {
    const today = new Date();
    return today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
  };

  const isPastDay = (day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(calYear, calMonth, day) < today;
  };

  const handleSupportViewChange = (view) => {
    if (view === "calendar") {
      router.push("/?board=support&view=calendar");
    } else {
      router.push("/?board=support");
    }
  };

  // 구인/구직 분류 함수
  const isHiringPost = (title) => {
    const hiringKeywords = ["모십니다", "채용", "모집", "구합니다", "채용합니다"];
    return hiringKeywords.some(keyword => title.includes(keyword));
  };

  // 톡톡 카테고리 추출 함수
  const extractFreeCategory = (title) => {
    if (title.includes("[모집]")) return "모집";
    if (title.includes("[후기]")) return "후기";
    if (title.includes("[잡담]")) return "잡담";
    return null;
  };

  // 필터링된 게시글
  const getFilteredPosts = () => {
    let filtered = posts;

    // 구인구직 필터
    if (currentBoard === "job" && jobFilter !== "all") {
      filtered = filtered.filter(post => {
        const isHiring = isHiringPost(post.title);
        return jobFilter === "hiring" ? isHiring : !isHiring;
      });
    }

    // 톡톡 카테고리 필터
    if (currentBoard === "free" && freeFilter !== "all") {
      filtered = filtered.filter(post => {
        const category = extractFreeCategory(post.title);
        return category === freeFilter;
      });
    }

    return filtered;
  };

  const filteredPosts = getFilteredPosts();

  // 게시물 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      return;
    }
    const { data } = await supabase
      .from("bw_posts")
      .select("id, title, board_type, created_at")
      .ilike("title", `%${searchQuery}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    setSearchResults(data || []);
    setShowSearchResults(true);
  };

  return (
    <>
      {/* Header */}
      <header className="bg-[#355E3B] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* 모바일: 북위키 클릭 시 메뉴 토글 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-2xl font-bold tracking-tighter md:pointer-events-none"
            >
              북위키
            </button>
            <nav className="hidden md:flex space-x-4 text-sm font-medium">
              {boardCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleBoardClick(cat.id)}
                  className={`hover:underline ${currentBoard === cat.id ? "font-bold underline" : ""}`}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {isAdmin && (
              <Link href="/admin" className="hidden md:block text-xs font-bold bg-red-500 px-3 py-1.5 rounded hover:bg-red-600 transition">
                관리자
              </Link>
            )}
            {user ? (
              <div className="hidden md:flex items-center space-x-3">
                <span className="text-xs text-white/60">{user.user_metadata?.nickname || user.email.split('@')[0]}</span>
                <Link href="/mypage" className="text-xs text-white/80 hover:text-white">내 활동</Link>
                <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">로그아웃</button>
              </div>
            ) : (
              <Link href="/login" className="hidden md:block text-sm border border-white/30 px-3 py-1 rounded hover:bg-white/10">로그인</Link>
            )}
            {/* 모바일 로그인/로그아웃 버튼 */}
            {user ? (
              <button
                onClick={handleLogout}
                className="md:hidden text-xs border border-white/30 px-2 py-1 rounded hover:bg-white/10"
              >
                로그아웃
              </button>
            ) : (
              <Link href="/login" className="md:hidden text-xs border border-white/30 px-2 py-1 rounded hover:bg-white/10">
                로그인
              </Link>
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="게시물 찾기"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-[#2A4A2E] text-xs px-3 py-1.5 rounded w-28 md:w-48 outline-none placeholder:text-gray-300"
              />
              <button onClick={handleSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                🔍
              </button>
              {/* 검색 결과 드롭다운 */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <Link
                      key={result.id}
                      href={`/post/${result.id}`}
                      onClick={() => setShowSearchResults(false)}
                      className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-[#355E3B] font-bold">[{boardTypeNames[result.board_type]}]</span> {result.title}
                    </Link>
                  ))}
                </div>
              )}
              {showSearchResults && searchResults.length === 0 && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 px-3 py-2 text-xs text-gray-500">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 모바일 메뉴 드롭다운 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#2A4A2E] border-t border-[#355E3B]">
            <nav className="max-w-6xl mx-auto px-4 py-2 space-y-1">
              {boardCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { handleBoardClick(cat.id); setMobileMenuOpen(false); }}
                  className={`block w-full text-left px-3 py-2 text-sm rounded ${currentBoard === cat.id ? "bg-[#355E3B] font-bold" : "hover:bg-[#355E3B]/50"}`}
                >
                  {cat.name}
                </button>
              ))}
              <div className="border-t border-[#355E3B] pt-2 mt-2">
                {user ? (
                  <>
                    <Link href="/mypage" className="block px-3 py-2 text-sm hover:bg-[#355E3B]/50 rounded">내 활동</Link>
                    <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm hover:bg-[#355E3B]/50 rounded">로그아웃</button>
                  </>
                ) : (
                  <Link href="/login" className="block px-3 py-2 text-sm hover:bg-[#355E3B]/50 rounded">로그인/회원가입</Link>
                )}
                {isAdmin && <Link href="/admin" className="block px-3 py-2 text-sm text-red-300 hover:bg-[#355E3B]/50 rounded">관리자</Link>}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Banner */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="bg-black h-20 md:h-24 rounded flex items-center justify-center text-white text-sm">
          광고 배너 영역
        </div>
      </div>

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left - Post List (3 columns) */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-[#355E3B]">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-lg font-bold text-[#355E3B]">
                {currentBoard === "hot" ? "HOT 인기글 (최근 7일)" : currentBoard === "ai" ? "AI 허브" : `${boardCategories.find(c => c.id === currentBoard)?.name} 최신글`}
              </h2>
              {currentBoard === "support" && (
                <div className="flex border border-gray-300 rounded overflow-hidden text-xs">
                  <button
                    onClick={() => handleSupportViewChange("list")}
                    className={`px-3 py-1 ${supportView === "list" ? "bg-[#355E3B] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    목록
                  </button>
                  <button
                    onClick={() => handleSupportViewChange("calendar")}
                    className={`px-3 py-1 ${supportView === "calendar" ? "bg-[#355E3B] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    📅 캘린더
                  </button>
                </div>
              )}
              {currentBoard === "job" && (
                <div className="flex border border-gray-300 rounded overflow-hidden text-xs">
                  <button
                    onClick={() => router.push("/?board=job&filter=hiring")}
                    className={`px-3 py-1 ${jobFilter === "hiring" ? "bg-[#355E3B] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    구인
                  </button>
                  <button
                    onClick={() => router.push("/?board=job&filter=seeking")}
                    className={`px-3 py-1 ${jobFilter === "seeking" ? "bg-[#355E3B] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    구직
                  </button>
                  <button
                    onClick={() => router.push("/?board=job")}
                    className={`px-3 py-1 ${jobFilter === "all" ? "bg-[#355E3B] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    전체
                  </button>
                </div>
              )}
              {/* 톡톡 게시판 카테고리 필터 */}
              {currentBoard === "free" && (
                <div className="flex border border-gray-300 rounded overflow-hidden text-xs">
                  {freeBoardCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => router.push(cat.id === "all" ? "/?board=free" : `/?board=free&category=${cat.id}`)}
                      className={`px-3 py-1 ${freeFilter === cat.id ? "bg-[#355E3B] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {currentBoard !== "ai" && currentBoard !== "hot" && currentBoard !== "all" && (
              <Link href={`/write?board=${currentBoard}`} className="text-xs bg-[#355E3B] text-white px-3 py-1 rounded">글쓰기</Link>
            )}
            {(currentBoard === "all" || currentBoard === "hot") && (
              <Link href="/write" className="text-xs bg-[#355E3B] text-white px-3 py-1 rounded">글쓰기</Link>
            )}
          </div>

          {/* AI Hub Card View */}
          {currentBoard === "ai" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: "📖", title: "원서 검토", desc: "AI가 원서의 완성도와 시장성을 분석합니다" },
                { icon: "🌐", title: "AI 번역", desc: "출판물 전문 AI 번역 서비스" },
                { icon: "💡", title: "마케팅 아이디어", desc: "도서 마케팅 전략을 AI가 제안합니다" },
                { icon: "✏️", title: "제목 제안", desc: "매력적인 도서 제목을 추천받으세요" },
                { icon: "📝", title: "카피라이팅", desc: "책 소개 문구를 AI가 작성합니다" },
                { icon: "🎨", title: "표지 컨셉", desc: "표지 디자인 방향을 제안합니다" },
              ].map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition bg-white">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-bold text-gray-800 mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-500 mb-4">{item.desc}</p>
                  <span className="inline-block text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-medium">
                    🚧 개발 중
                  </span>
                </div>
              ))}
            </div>
          ) : currentBoard === "support" && supportView === "calendar" ? (
            <div className="bg-white">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                <button
                  onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))}
                  className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                >
                  ◀ 이전
                </button>
                <h3 className="text-lg font-bold">{calYear}년 {monthNames[calMonth]}</h3>
                <button
                  onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))}
                  className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                >
                  다음 ▶
                </button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-0 mb-1">
                {dayNames.map((name, idx) => (
                  <div
                    key={name}
                    className={`text-center text-xs font-bold py-2 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-600'}`}
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                {/* Empty cells */}
                {Array.from({ length: calFirstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 md:h-24 bg-gray-50 border-b border-r border-gray-100"></div>
                ))}
                {/* Day cells */}
                {Array.from({ length: calDaysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayEvents = getEventsForDay(day);
                  const todayClass = isToday(day) ? "bg-blue-50" : "bg-white";
                  const pastClass = isPastDay(day) ? "text-gray-400" : "";

                  return (
                    <div key={day} className={`h-20 md:h-24 border-b border-r border-gray-100 p-1 overflow-hidden ${todayClass}`}>
                      <div className={`text-xs font-bold mb-1 ${pastClass} ${isToday(day) ? 'text-blue-600' : ''}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event, idx) => (
                          <Link
                            key={idx}
                            href={`/post/${event.id}`}
                            className="block text-[9px] md:text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded truncate hover:bg-red-200"
                            title={event.title}
                          >
                            {event.title.replace(/\[.*?\]/g, '').trim().substring(0, 12)}...
                          </Link>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-gray-500">+{dayEvents.length - 2}개</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upcoming Deadlines */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-sm mb-3">다가오는 마감</h4>
                {calendarEvents.filter(e => new Date(e.deadline) >= new Date(new Date().setHours(0,0,0,0))).length === 0 ? (
                  <p className="text-xs text-gray-500">마감 예정인 지원사업이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {calendarEvents
                      .filter(e => new Date(e.deadline) >= new Date(new Date().setHours(0,0,0,0)))
                      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                      .slice(0, 5)
                      .map(event => (
                        <li key={event.id} className="flex items-start gap-3 text-sm">
                          <span className="text-red-600 font-bold whitespace-nowrap text-xs">{event.deadline}</span>
                          <Link href={`/post/${event.id}`} className="text-gray-700 hover:text-blue-600 truncate text-xs">
                            {event.title}
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
          <>
          <div className="overflow-x-auto">
            {/* 데스크톱 테이블 */}
            <table className="w-full text-sm text-left hidden md:table">
              <thead className="text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 font-medium w-16">번호</th>
                  <th className="px-2 py-2 font-medium">제목</th>
                  <th className="px-2 py-2 font-medium w-24">글쓴이</th>
                  <th className="px-2 py-2 font-medium w-20 text-center">날짜</th>
                  <th className="px-2 py-2 font-medium w-16 text-center">조회</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="py-10 text-center text-gray-400">불러오는 중...</td></tr>
                ) : filteredPosts.length === 0 ? (
                  <tr><td colSpan="5" className="py-10 text-center text-gray-400 text-xs">작성된 게시물이 없습니다.</td></tr>
                ) : (
                  <>
                    {/* 공지사항 먼저 표시 */}
                    {filteredPosts.filter(p => p.is_notice).map((post) => (
                      <tr key={post.id} className="bg-blue-50 hover:bg-blue-100 cursor-pointer" onClick={() => router.push(`/post/${post.id}`)}>
                        <td className="px-2 py-2 text-xs text-blue-600 font-bold">공지</td>
                        <td className="px-2 py-2 font-bold text-gray-900">
                          <span className="text-[#355E3B] mr-2 text-[10px] font-bold">[{boardTypeNames[post.board_type] || post.board_type}]</span>
                          {post.title}
                          {post.comment_count > 0 && (
                            <span className="text-red-500 ml-1 text-[10px] font-bold">[{post.comment_count}]</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 truncate max-w-[80px]">
                          {post.author}
                          {post.user_id && (
                            <span
                              className="ml-0.5 text-green-500 font-bold"
                              style={{
                                textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'
                              }}
                              title="회원"
                            >
                              ✓
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400 text-center">{new Date(post.created_at).toLocaleDateString().slice(5)}</td>
                        <td className="px-2 py-2 text-xs text-gray-400 text-center">{post.view_count}</td>
                      </tr>
                    ))}
                    {/* 구인구직 게시판: 직접 작성글 먼저 표시 */}
                    {currentBoard === "job" && filteredPosts.filter(p => !p.is_notice && !p.is_auto).map((post) => (
                      <tr key={post.id} className="bg-green-50 hover:bg-green-100 cursor-pointer" onClick={() => router.push(`/post/${post.id}`)}>
                        <td className="px-2 py-2 text-xs text-green-600 font-bold">직접</td>
                        <td className="px-2 py-2 font-medium text-gray-800">
                          {hotPostIds.includes(post.id) && (
                            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 mr-1.5 rounded-sm font-bold">HOT</span>
                          )}
                          <span className="text-[#355E3B] mr-2 text-[10px] font-bold">[{boardTypeNames[post.board_type] || post.board_type}]</span>
                          {post.title}
                          {post.comment_count > 0 && (
                            <span className="text-red-500 ml-1 text-[10px] font-bold">[{post.comment_count}]</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 truncate max-w-[80px]">
                          {post.author}
                          {post.user_id && (
                            <span
                              className="ml-0.5 text-green-500 font-bold"
                              style={{
                                textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'
                              }}
                              title="회원"
                            >
                              ✓
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400 text-center">{new Date(post.created_at).toLocaleDateString().slice(5)}</td>
                        <td className="px-2 py-2 text-xs text-gray-400 text-center">{post.view_count}</td>
                      </tr>
                    ))}
                    {/* 일반 게시글 (구인구직은 자동 스크래핑 글만, 다른 게시판은 전부) */}
                    {filteredPosts.filter(p => !p.is_notice && (currentBoard !== "job" || p.is_auto)).map((post, idx) => (
                      <tr key={post.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/post/${post.id}`)}>
                        <td className="px-2 py-2 text-xs text-gray-400">{totalCount - filteredPosts.filter(p => p.is_notice).length - (currentBoard === "job" ? filteredPosts.filter(p => !p.is_notice && !p.is_auto).length : 0) - ((currentPage - 1) * POSTS_PER_PAGE) - idx}</td>
                        <td className="px-2 py-2 font-medium text-gray-800">
                          {hotPostIds.includes(post.id) && (
                            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 mr-1.5 rounded-sm font-bold">HOT</span>
                          )}
                          <span className="text-[#355E3B] mr-2 text-[10px] font-bold">[{boardTypeNames[post.board_type] || post.board_type}]</span>
                          {post.title}
                          {post.comment_count > 0 && (
                            <span className="text-red-500 ml-1 text-[10px] font-bold">[{post.comment_count}]</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 truncate max-w-[80px]">
                          {post.author}
                          {post.user_id && (
                            <span
                              className="ml-0.5 text-green-500 font-bold"
                              style={{
                                textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'
                              }}
                              title="회원"
                            >
                              ✓
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400 text-center">{new Date(post.created_at).toLocaleDateString().slice(5)}</td>
                        <td className="px-2 py-2 text-xs text-gray-400 text-center">{post.view_count}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>

            {/* 모바일 카드 뷰 */}
            <div className="md:hidden space-y-2">
              {loading ? (
                <div className="py-10 text-center text-gray-400">불러오는 중...</div>
              ) : filteredPosts.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-xs">작성된 게시물이 없습니다.</div>
              ) : (
                <>
                  {/* 공지사항 */}
                  {filteredPosts.filter(p => p.is_notice).map((post) => (
                    <div
                      key={post.id}
                      className="bg-blue-50 border border-blue-100 rounded p-3 cursor-pointer"
                      onClick={() => router.push(`/post/${post.id}`)}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold shrink-0">공지</span>
                        <span className="text-[10px] text-[#355E3B] font-bold shrink-0">[{boardTypeNames[post.board_type]}]</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-red-500 ml-1 text-[10px]">[{post.comment_count}]</span>
                        )}
                      </h3>
                      <div className="flex items-center text-[10px] text-gray-400 gap-2">
                        <span>{post.author}{post.user_id && <span className="text-green-500 ml-0.5">✓</span>}</span>
                        <span>·</span>
                        <span>{new Date(post.created_at).toLocaleDateString().slice(5)}</span>
                        <span>·</span>
                        <span>조회 {post.view_count}</span>
                      </div>
                    </div>
                  ))}
                  {/* 구인구직 직접작성글 */}
                  {currentBoard === "job" && filteredPosts.filter(p => !p.is_notice && !p.is_auto).map((post) => (
                    <div
                      key={post.id}
                      className="bg-green-50 border border-green-100 rounded p-3 cursor-pointer"
                      onClick={() => router.push(`/post/${post.id}`)}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold shrink-0">직접</span>
                        {hotPostIds.includes(post.id) && (
                          <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold shrink-0">HOT</span>
                        )}
                        <span className="text-[10px] text-[#355E3B] font-bold shrink-0">[{boardTypeNames[post.board_type]}]</span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-red-500 ml-1 text-[10px]">[{post.comment_count}]</span>
                        )}
                      </h3>
                      <div className="flex items-center text-[10px] text-gray-400 gap-2">
                        <span>{post.author}{post.user_id && <span className="text-green-500 ml-0.5">✓</span>}</span>
                        <span>·</span>
                        <span>{new Date(post.created_at).toLocaleDateString().slice(5)}</span>
                        <span>·</span>
                        <span>조회 {post.view_count}</span>
                      </div>
                    </div>
                  ))}
                  {/* 일반 게시글 */}
                  {filteredPosts.filter(p => !p.is_notice && (currentBoard !== "job" || p.is_auto)).map((post) => (
                    <div
                      key={post.id}
                      className="bg-white border border-gray-100 rounded p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/post/${post.id}`)}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        {hotPostIds.includes(post.id) && (
                          <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold shrink-0">HOT</span>
                        )}
                        <span className="text-[10px] text-[#355E3B] font-bold shrink-0">[{boardTypeNames[post.board_type]}]</span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-red-500 ml-1 text-[10px]">[{post.comment_count}]</span>
                        )}
                      </h3>
                      <div className="flex items-center text-[10px] text-gray-400 gap-2">
                        <span>{post.author}{post.user_id && <span className="text-green-500 ml-0.5">✓</span>}</span>
                        <span>·</span>
                        <span>{new Date(post.created_at).toLocaleDateString().slice(5)}</span>
                        <span>·</span>
                        <span>조회 {post.view_count}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-6 space-x-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 text-xs rounded ${
                    currentPage === page
                      ? "bg-[#355E3B] text-white font-bold"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                »
              </button>
              <span className="ml-4 text-xs text-gray-400">
                총 {totalCount.toLocaleString()}개
              </span>
            </div>
          )}
          </>
          )}
        </div>

        {/* Right - Sidebar */}
        <aside className="lg:col-span-1 order-1 lg:order-2">
          {/* Best Posts (Weekly HOT) - 모바일에서 숨김 */}
          {bestPosts.length > 0 && (
            <div className="border border-gray-200 hidden lg:block">
              <div className="bg-yellow-400 text-gray-800 px-3 py-2 text-xs font-bold border-b border-gray-200 flex items-center gap-1">
                <span>🔥</span> 주간 베스트
              </div>
              <ul className="text-xs">
                {bestPosts.slice(0, 5).map((post, idx) => (
                  <li key={post.id} className="border-b border-gray-100 last:border-0">
                    <Link
                      href={`/post/${post.id}`}
                      className="block px-3 py-2 hover:bg-gray-50 text-gray-700"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 font-bold">{idx + 1}</span>
                        <span className="truncate flex-1">{post.title}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 ml-4">
                        조회 {post.view_count || 0} · 댓글 {post.comment_count || 0}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* User Menu for logged in users */}
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
        </aside>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-400">
          <p className="mb-2">© 2026 북위키 (Book-Wiki). All rights reserved.</p>
          <p className="space-x-3">
            <span>문의 <a href="mailto:bookwiki.official@gmail.com" className="text-[#355E3B] hover:underline">bookwiki.official@gmail.com</a></span>
            <Link href="/terms" className="hover:underline">이용약관</Link>
            <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
          </p>
        </div>
      </footer>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <PostList />
    </Suspense>
  );
}
