"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "톡톡",
    ai: "AI허브",
};

export default function DeletedPostsPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [boardFilter, setBoardFilter] = useState("all");

    const fetchDeletedPosts = async () => {
        setLoading(true);
        let query = supabase
            .from("bw_posts")
            .select("id, title, author, board_type, deleted_at, deleted_by, created_at")
            .eq("is_deleted", true)
            .order("deleted_at", { ascending: false })
            .limit(100);

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
        fetchDeletedPosts();
    }, [boardFilter]);

    const restorePost = async (postId) => {
        if (!confirm("이 게시글을 복원하시겠습니까?")) return;

        const { error } = await supabase
            .from("bw_posts")
            .update({
                is_deleted: false,
                deleted_at: null,
                deleted_by: null
            })
            .eq("id", postId);

        if (error) {
            alert("복원 실패: " + error.message);
        } else {
            alert("복원되었습니다.");
            setPosts(posts.filter(p => p.id !== postId));
        }
    };

    const permanentDelete = async (postId) => {
        if (!confirm("정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

        // Delete comments first
        await supabase.from("bw_comments").delete().eq("post_id", postId);

        // Delete post permanently
        const { error } = await supabase.from("bw_posts").delete().eq("id", postId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            alert("영구 삭제되었습니다.");
            setPosts(posts.filter(p => p.id !== postId));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800">삭제된 게시물</h2>
                        <div className="flex gap-2">
                            <select
                                value={boardFilter}
                                onChange={(e) => setBoardFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded text-sm"
                            >
                                <option value="all">전체 게시판</option>
                                <option value="free">톡톡</option>
                                <option value="job">구인구직</option>
                                <option value="support">지원사업</option>
                                <option value="ai">AI허브</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-gray-500">로딩 중...</div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">삭제된 게시물이 없습니다.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700 w-12">ID</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700">제목</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700 w-24">게시판</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700 w-32">작성자</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700 w-40">삭제일</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700 w-32">삭제자</th>
                                        <th className="px-4 py-3 text-center font-bold text-gray-700 w-40">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {posts.map((post) => (
                                        <tr key={post.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-600">{post.id}</td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/post/${post.id}`}
                                                    className="text-gray-900 hover:text-[#355E3B] font-medium line-clamp-1"
                                                >
                                                    {post.title}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                                    {boardTypeNames[post.board_type] || post.board_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{post.author}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                {post.deleted_at ? new Date(post.deleted_at).toLocaleString("ko-KR") : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{post.deleted_by || "-"}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center space-x-2">
                                                    <button
                                                        onClick={() => restorePost(post.id)}
                                                        className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                                                    >
                                                        복원
                                                    </button>
                                                    <button
                                                        onClick={() => permanentDelete(post.id)}
                                                        className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                                                    >
                                                        영구삭제
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
