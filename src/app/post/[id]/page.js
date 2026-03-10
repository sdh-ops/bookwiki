"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// Board type to Korean name mapping
const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "자유게시판",
    ai: "AI허브",
};

export default function PostDetailPage() {
    const { id } = useParams();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [commentAuthor, setCommentAuthor] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [tempPassword, setTempPassword] = useState("");
    const [managementType, setManagementType] = useState("");
    const router = useRouter();

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            // Get current user
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
                    console.log("Admin check failed:", e);
                }
            }

            // Fetch post (include password field)
            const { data: postData, error: postError } = await supabase
                .from("bw_posts")
                .select("*")
                .eq("id", id)
                .single();

            if (postError || !postData) {
                alert("게시글을 찾을 수 없습니다.");
                router.push("/");
                return;
            }

            // Increment view count
            const newViewCount = (postData.view_count || 0) + 1;
            await supabase
                .from("bw_posts")
                .update({ view_count: newViewCount })
                .eq("id", id);

            setPost({ ...postData, view_count: newViewCount });

            // Fetch comments
            const { data: commentData } = await supabase
                .from("bw_comments")
                .select("*")
                .eq("post_id", id)
                .order("created_at", { ascending: true });

            if (commentData) {
                setComments(commentData);
            }

            setLoading(false);
        }

        if (id) fetchData();
    }, [id, router]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment || !commentAuthor) {
            alert("이름과 내용을 입력해주세요.");
            return;
        }

        setSubmitting(true);
        const { error } = await supabase.from("bw_comments").insert([
            { post_id: id, content: newComment, author: commentAuthor }
        ]);

        if (error) {
            alert("댓글 작성 실패: " + error.message);
        } else {
            setNewComment("");
            const { data } = await supabase
                .from("bw_comments")
                .select("*")
                .eq("post_id", id)
                .order("created_at", { ascending: true });
            setComments(data || []);
        }
        setSubmitting(false);
    };

    const handleManagement = (type) => {
        if (!post) return;

        // If Admin or Owner (user_id match)
        if (isAdmin || (user && post.user_id === user.id)) {
            if (type === 'delete') {
                if (confirm("정말로 삭제하시겠습니까?")) executeDelete();
            } else {
                router.push(`/post/${id}/edit`);
            }
            return;
        }

        // Guest post with password (check if password exists)
        if (!post.user_id && post.password) {
            setManagementType(type);
            setShowPasswordModal(true);
        } else {
            alert("권한이 없습니다.");
        }
    };

    const executeDelete = async () => {
        const { error } = await supabase.from("bw_posts").delete().eq("id", id);
        if (error) alert("삭제 실패: " + error.message);
        else {
            alert("삭제되었습니다.");
            router.push("/");
        }
    };

    const handlePasswordConfirm = async () => {
        if (post && tempPassword === post.password) {
            if (managementType === 'delete') executeDelete();
            else router.push(`/post/${id}/edit`);
        } else {
            alert("비밀번호가 틀렸습니다.");
        }
        setShowPasswordModal(false);
        setTempPassword("");
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!post) return <div className="p-10 text-center">게시글을 찾을 수 없습니다.</div>;

    // Check if current user can edit/delete
    const canManage = isAdmin || !post.user_id || (user && post.user_id === user.id);

    return (
        <main className="min-h-screen bg-white">
            <header className="bg-[#4a6a8a] text-white py-3">
                <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                    <div className="flex space-x-3 text-xs">
                        <Link href="/" className="hover:underline opacity-80">목록으로</Link>
                        <Link href="/write" className="hover:underline font-bold">글쓰기</Link>
                    </div>
                </div>
            </header>

            <article className="max-w-4xl mx-auto px-4 py-8">
                <div className="border-b-2 border-gray-200 pb-4 mb-6">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2 text-[10px] font-bold text-[#4a6a8a]">
                            <span>{boardTypeNames[post.board_type] || post.board_type}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-400 font-normal">{new Date(post.created_at).toLocaleString()}</span>
                        </div>
                        {canManage && (
                            <div className="flex space-x-2 text-[10px] text-gray-400 font-bold">
                                <button onClick={() => handleManagement('edit')} className="hover:text-black">수정</button>
                                <button onClick={() => handleManagement('delete')} className="hover:text-red-500">삭제</button>
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                        <span className="font-bold">{post.author}</span>
                        <div className="space-x-4 text-gray-400 text-xs">
                            <span>조회 {post.view_count || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="min-h-[300px] text-gray-800 leading-relaxed text-sm">
                    <div className="whitespace-pre-wrap mb-10" dangerouslySetInnerHTML={{ __html: post.content }}></div>

                    {post.source_url && (
                        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col space-y-2">
                            <a
                                href={post.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm font-bold text-[#4a6a8a] border border-[#4a6a8a] px-4 py-2 rounded hover:bg-[#4a6a8a] hover:text-white transition w-fit"
                            >
                                원문 보기 →
                            </a>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-200 pt-8">
                    <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center">
                        댓글 <span className="ml-2 bg-[#4a6a8a] text-white text-[10px] px-2 py-0.5 rounded-full">{comments.length}</span>
                    </h3>

                    <div className="space-y-4 mb-10">
                        {comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-50 p-4 rounded border border-gray-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-700">{comment.author}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="bg-white border border-gray-200 rounded p-4">
                        <div className="mb-3">
                            <input
                                type="text"
                                placeholder="닉네임"
                                value={commentAuthor}
                                onChange={(e) => setCommentAuthor(e.target.value)}
                                className="w-32 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#4a6a8a]"
                                required
                            />
                        </div>
                        <textarea
                            placeholder="댓글을 남겨보세요"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full h-24 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#4a6a8a] resize-none mb-3"
                            required
                        ></textarea>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`bg-[#4a6a8a] text-white px-6 py-2 rounded text-xs transition hover:bg-[#3a5a7a] ${submitting ? "opacity-50" : ""}`}
                            >
                                댓글 등록
                            </button>
                        </div>
                    </form>
                </div>
            </article>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded p-6 max-w-xs w-full shadow-2xl">
                        <h4 className="text-sm font-bold mb-4">비밀번호 확인</h4>
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={tempPassword}
                            onChange={(e) => setTempPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-4 focus:outline-none focus:border-[#4a6a8a]"
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded border border-gray-100"
                            >
                                취소
                            </button>
                            <button
                                onClick={handlePasswordConfirm}
                                className="flex-1 py-2 text-xs bg-[#4a6a8a] text-white rounded hover:bg-[#3a5a7a]"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
                    <p>© 2026 북위키 (Book-Wiki). All rights reserved.</p>
                </div>
            </footer>
        </main>
    );
}
