"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "자유게시판",
    ai: "AI허브",
};

export default function AdminPostsPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // all, notice, normal
    const [boardFilter, setBoardFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const fetchPosts = async () => {
        setLoading(true);
        let query = supabase
            .from("bw_posts")
            .select("id, title, author, board_type, is_notice, is_auto, created_at, view_count")
            .order("created_at", { ascending: false })
            .limit(100);

        if (filter === "notice") {
            query = query.eq("is_notice", true);
        } else if (filter === "normal") {
            query = query.eq("is_notice", false);
        }

        if (boardFilter !== "all") {
            query = query.eq("board_type", boardFilter);
        }

        const { data, error } = await query;
        if (!error && data) {
            setPosts(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPosts();
    }, [filter, boardFilter]);

    const toggleNotice = async (postId, currentStatus) => {
        const { error } = await supabase
            .from("bw_posts")
            .update({ is_notice: !currentStatus })
            .eq("id", postId);

        if (error) {
            alert("공지 설정 실패: " + error.message);
        } else {
            // Update local state
            setPosts(posts.map(p =>
                p.id === postId ? { ...p, is_notice: !currentStatus } : p
            ));
        }
    };

    const deletePost = async (postId) => {
        if (!confirm("정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

        // Delete comments first
        await supabase.from("bw_comments").delete().eq("post_id", postId);

        // Delete post
        const { error } = await supabase.from("bw_posts").delete().eq("id", postId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            setPosts(posts.filter(p => p.id !== postId));
        }
    };

    const filteredPosts = posts.filter(post => {
        if (!searchQuery) return true;
        return post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
               post.author.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">게시물 관리</h2>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="제목 또는 작성자 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded text-sm w-48"
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <div className="flex gap-2">
                    <span className="text-sm text-gray-500 self-center">상태:</span>
                    {[
                        { id: "all", name: "전체" },
                        { id: "notice", name: "공지만" },
                        { id: "normal", name: "일반만" },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-3 py-1.5 text-xs rounded ${
                                filter === f.id
                                    ? "bg-[#355E3B] text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            {f.name}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <span className="text-sm text-gray-500 self-center">게시판:</span>
                    {[
                        { id: "all", name: "전체" },
                        { id: "free", name: "자유게시판" },
                        { id: "job", name: "구인구직" },
                        { id: "support", name: "지원사업" },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setBoardFilter(f.id)}
                            className={`px-3 py-1.5 text-xs rounded ${
                                boardFilter === f.id
                                    ? "bg-[#355E3B] text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            {f.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Posts Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs font-bold">
                        <tr>
                            <th className="px-4 py-3 w-16">상태</th>
                            <th className="px-4 py-3">제목</th>
                            <th className="px-4 py-3 w-24">게시판</th>
                            <th className="px-4 py-3 w-24">작성자</th>
                            <th className="px-4 py-3 w-20 text-center">조회</th>
                            <th className="px-4 py-3 w-32 text-center">작성일</th>
                            <th className="px-4 py-3 w-32 text-center">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                                    로딩 중...
                                </td>
                            </tr>
                        ) : filteredPosts.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                                    게시물이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredPosts.map((post) => (
                                <tr key={post.id} className={`hover:bg-gray-50 ${post.is_notice ? 'bg-blue-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        {post.is_notice ? (
                                            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-bold">공지</span>
                                        ) : post.is_auto ? (
                                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">자동</span>
                                        ) : (
                                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">직접</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link href={`/post/${post.id}`} className="text-gray-800 hover:text-[#355E3B] font-medium">
                                            {post.title.length > 40 ? post.title.substring(0, 40) + "..." : post.title}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                        {boardTypeNames[post.board_type] || post.board_type}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">{post.author}</td>
                                    <td className="px-4 py-3 text-xs text-gray-400 text-center">{post.view_count || 0}</td>
                                    <td className="px-4 py-3 text-xs text-gray-400 text-center">
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex gap-1 justify-center">
                                            <button
                                                onClick={() => toggleNotice(post.id, post.is_notice)}
                                                className={`px-2 py-1 text-xs rounded ${
                                                    post.is_notice
                                                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                                }`}
                                            >
                                                {post.is_notice ? "공지해제" : "공지지정"}
                                            </button>
                                            <button
                                                onClick={() => deletePost(post.id)}
                                                className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-xs text-gray-400">
                최근 100개 게시물만 표시됩니다. 더 많은 게시물을 보려면 필터를 사용하세요.
            </p>
        </div>
    );
}
