"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminCommentsPage() {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [user, setUser] = useState(null);

    const fetchComments = async () => {
        setLoading(true);

        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        const { data, error } = await supabase
            .from("bw_comments")
            .select(`
                id, 
                content, 
                author, 
                created_at, 
                post_id,
                is_deleted,
                bw_posts (title)
            `)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(100);

        if (!error && data) {
            setComments(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchComments();
    }, []);

    const deleteComment = async (commentId) => {
        if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) return;

        const { error } = await supabase
            .from("bw_comments")
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: user?.email || "admin"
            })
            .eq("id", commentId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            alert("삭제되었습니다.");
            setComments(comments.filter(c => c.id !== commentId));
        }
    };

    const filteredComments = comments.filter(comment => {
        if (!searchQuery) return true;
        return comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
               comment.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
               (comment.bw_posts?.title && comment.bw_posts.title.toLowerCase().includes(searchQuery.toLowerCase()));
    });

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">댓글 관리</h2>
                <div className="w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="내용, 작성자 또는 게시글 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded text-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs font-bold">
                            <tr>
                                <th className="px-3 md:px-4 py-3">내용</th>
                                <th className="px-3 md:px-4 py-3 w-32">게시글</th>
                                <th className="px-3 md:px-4 py-3 w-24">작성자</th>
                                <th className="px-3 md:px-4 py-3 w-28 text-center">작성일</th>
                                <th className="px-3 md:px-4 py-3 w-20 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                        로딩 중...
                                    </td>
                                </tr>
                            ) : filteredComments.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                        댓글이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredComments.map((comment) => (
                                    <tr key={comment.id} className="hover:bg-gray-50">
                                        <td className="px-3 md:px-4 py-3">
                                            <div className="text-gray-800 whitespace-pre-wrap line-clamp-2">
                                                {comment.content}
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-4 py-3">
                                            <Link 
                                                href={`/post/${comment.post_id}`} 
                                                className="text-blue-500 hover:underline text-xs block truncate max-w-[150px]"
                                                title={comment.bw_posts?.title}
                                            >
                                                {comment.bw_posts?.title || "게시글 이동"}
                                            </Link>
                                        </td>
                                        <td className="px-3 md:px-4 py-3 text-xs text-gray-600">{comment.author}</td>
                                        <td className="px-3 md:px-4 py-3 text-xs text-gray-400 text-center">
                                            {new Date(comment.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 md:px-4 py-3 text-center">
                                            <button
                                                onClick={() => deleteComment(comment.id)}
                                                className="px-2 py-1 text-[10px] rounded bg-red-100 text-red-700 hover:bg-red-200"
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-4 text-xs text-gray-400">
                최근 100개의 댓글만 표시됩니다.
            </p>
        </div>
    );
}
