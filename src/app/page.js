"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function PostList() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentBoard = searchParams.get("board") || "all";

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      let query = supabase
        .from("bw_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentBoard !== "all") {
        query = query.eq("board_type", currentBoard);
      }

      const { data: postsData } = await query.limit(20);
      if (postsData) setPosts(postsData);

      // Check login and admin
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: adminData } = await supabase
          .from("bw_admins")
          .select("email")
          .eq("email", user.email)
          .single();
        setIsAdmin(!!adminData);
      }
      setLoading(false);
    }
    fetchData();
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
              <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">로그아웃</button>
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
            </ul>
          </div>
        </aside>

        {/* Center - Post List */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-[#4a6a8a]">
            <h2 className="text-lg font-bold text-[#4a6a8a]">
              {boardCategories.find(c => c.id === currentBoard)?.name} 최신글
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
                      <td className="px-2 py-2 text-xs text-gray-400">{posts.length - idx}</td>
                      <td className="px-2 py-2 font-medium text-gray-800">
                        <span className="text-[#4a6a8a] mr-2 text-[10px] font-bold">[{post.board_type.toUpperCase()}]</span>
                        {post.is_auto && (
                          <span className="text-[10px] bg-slate-500 text-white px-1 mr-1 rounded-sm">자동수집</span>
                        )}
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
