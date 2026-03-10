"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// Board type to Korean name mapping
const boardTypeNames = {
  job: "구인구직",
  support: "지원사업",
  free: "자유게시판",
  ai: "AI허브",
};

const POSTS_PER_PAGE = 50;

function PostList() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [hotPostIds, setHotPostIds] = useState([]);
  const [bestPosts, setBestPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentBoard = searchParams.get("board") || "all";
  const pageParam = searchParams.get("page");

  useEffect(() => {
    const page = parseInt(pageParam) || 1;
    setCurrentPage(page);
  }, [pageParam]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const boardCategories = [
    { name: "전체", id: "all" },
    { name: "HOT", id: "hot" },
    { name: "구인구직", id: "job" },
    { name: "지원사업", id: "support" },
    { name: "자유게시판", id: "free" },
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

  return (
    <>
      {/* Header */}
      <header className="bg-[#4a6a8a] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-2xl font-bold tracking-tighter">북위키</Link>
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
          <div className="flex items-center space-x-4">
            {isAdmin && (
              <Link href="/admin" className="text-xs font-bold bg-red-500 px-3 py-1.5 rounded hover:bg-red-600 transition">
                관리자
              </Link>
            )}
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-white/60">{user.user_metadata?.nickname || user.email.split('@')[0]}</span>
                <Link href="/mypage" className="text-xs text-white/80 hover:text-white">내 활동</Link>
                <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">로그아웃</button>
              </div>
            ) : (
              <Link href="/login" className="text-sm border border-white/30 px-3 py-1 rounded hover:bg-white/10">로그인</Link>
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="게시판 찾기"
                className="bg-[#3a5a7a] text-xs px-3 py-1.5 rounded w-32 md:w-48 outline-none placeholder:text-gray-300"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left - Board List */}
        <aside className="lg:col-span-1 hidden lg:block">
          <div className="border border-gray-200">
            <div className="bg-gray-100 px-3 py-2 text-xs font-bold border-b border-gray-200">주요 게시판</div>
            <ul className="text-xs">
              {boardCategories.map((cat) => (
                <li key={cat.id} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => handleBoardClick(cat.id)}
                    className={`block w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 ${currentBoard === cat.id ? "bg-gray-50 font-bold" : ""}`}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
              <li className="border-b border-gray-100 last:border-0">
                <Link
                  href="/calendar"
                  className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-1"
                >
                  <span>📅</span> 마감 캘린더
                </Link>
              </li>
            </ul>
          </div>

          {/* Best Posts (Weekly HOT) */}
          {bestPosts.length > 0 && (
            <div className="border border-gray-200 mt-4">
              <div className="bg-red-500 text-white px-3 py-2 text-xs font-bold border-b border-gray-200 flex items-center gap-1">
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
            <div className="border border-gray-200 mt-4">
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

        {/* Center - Post List */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-[#4a6a8a]">
            <h2 className="text-lg font-bold text-[#4a6a8a]">
              {currentBoard === "hot" ? "HOT 인기글 (최근 7일)" : `${boardCategories.find(c => c.id === currentBoard)?.name} 최신글`}
            </h2>
            <Link href="/write" className="text-xs bg-[#4a6a8a] text-white px-3 py-1 rounded">글쓰기</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
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
                ) : posts.length === 0 ? (
                  <tr><td colSpan="5" className="py-10 text-center text-gray-400 text-xs">작성된 게시물이 없습니다.</td></tr>
                ) : (
                  posts.map((post, idx) => (
                    <tr key={post.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/post/${post.id}`)}>
                      <td className="px-2 py-2 text-xs text-gray-400">{totalCount - ((currentPage - 1) * POSTS_PER_PAGE) - idx}</td>
                      <td className="px-2 py-2 font-medium text-gray-800">
                        {hotPostIds.includes(post.id) && (
                          <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 mr-1.5 rounded-sm font-bold">HOT</span>
                        )}
                        <span className="text-[#4a6a8a] mr-2 text-[10px] font-bold">[{boardTypeNames[post.board_type] || post.board_type}]</span>
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-red-500 ml-1 text-[10px] font-bold">[{post.comment_count}]</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-600 truncate max-w-[80px]">{post.author}</td>
                      <td className="px-2 py-2 text-xs text-gray-400 text-center">{new Date(post.created_at).toLocaleDateString()}</td>
                      <td className="px-2 py-2 text-xs text-gray-400 text-center">{post.view_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                      ? "bg-[#4a6a8a] text-white font-bold"
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
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>© 2026 북위키 (Book-Wiki). All rights reserved.</p>
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
