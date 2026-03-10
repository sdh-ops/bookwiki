"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from("bw_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error) {
        setPosts(data);
      }
      setLoading(false);
    }
    fetchPosts();
  }, []);

  const boardCategories = [
    { name: "전체", id: "all" },
    { name: "HOT", id: "hot" },
    { name: "구인구직", id: "job" },
    { name: "지원사업", id: "support" },
    { name: "자유게시판", id: "free" },
    { name: "AI허브", id: "ai" },
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#4a6a8a] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold tracking-tighter">북위키</h1>
            <nav className="hidden md:flex space-x-4 text-sm font-medium">
              {boardCategories.map((cat) => (
                <a key={cat.id} href="#" className="hover:underline">
                  {cat.name}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-sm border border-white/30 px-3 py-1 rounded hover:bg-white/10">로그인</button>
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
        {/* Left - Board List (Theqoo Style Side) */}
        <aside className="lg:col-span-1 hidden lg:block">
          <div className="border border-gray-200">
            <div className="bg-gray-100 px-3 py-2 text-xs font-bold border-b border-gray-200">주요 게시판</div>
            <ul className="text-xs">
              {boardCategories.map((cat) => (
                <li key={cat.id} className="border-b border-gray-100 last:border-0">
                  <a href="#" className="block px-3 py-2 hover:bg-gray-50 text-gray-700">
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Center - Post List */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-[#4a6a8a]">
            <h2 className="text-lg font-bold text-[#4a6a8a]">전체 최신글</h2>
            <button className="text-xs bg-[#4a6a8a] text-white px-3 py-1 rounded">글쓰기</button>
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
                    <tr key={post.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-2 py-2 text-xs text-gray-400">{posts.length - idx}</td>
                      <td className="px-2 py-2 font-medium text-gray-800">
                        <span className="text-[#4a6a8a] mr-2 text-[10px] font-bold">[{post.board_type}]</span>
                        {post.title}
                        {post.comment_count > 0 && <span className="text-red-500 ml-1 text-xs">({post.comment_count})</span>}
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
    </main>
  );
}
