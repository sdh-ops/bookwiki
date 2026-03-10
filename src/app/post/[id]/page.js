"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function PostDetailPage() {
    const { id } = useParams();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [commentAuthor, setCommentAuthor] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function fetchPostAndComments() {
            setLoading(true);

            // Fetch post
            const { data: postData, error: postError } = await supabase
                .from("bw_posts")
                .select("*")
                .eq("id", id)
                .single();

            if (postError) {
                alert("게시글을 찾을 수 없습니다.");
                router.push("/");
                return;
            }

            // Increment view count (simple implementation)
            await supabase.rpc('increment_view_count', { post_id: id });

            setPost(postData);

            // Fetch comments
            const { data: commentData, error: commentError } = await supabase
                .from("bw_comments")
                .select("*")
                .eq("post_id", id)
                .order("created_at", { ascending: true });

            if (!commentError) {
                setComments(commentData);
            }

            setLoading(false);
        }

        if (id) fetchPostAndComments();
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
            // Refresh comments
            const { data } = await supabase
                .from("bw_comments")
                .select("*")
                .eq("post_id", id)
                .order("created_at", { ascending: true });
            setComments(data);
        }
        setSubmitting(false);
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!post) return null;

    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
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
                {/* Post Header */}
                <div className="border-b-2 border-gray-200 pb-4 mb-6">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-[#4a6a8a] mb-2">
                        <span>{post.board_type.toUpperCase()}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-400 font-normal">{new Date(post.created_at).toLocaleString()}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                        <span className="font-bold">{post.author}</span>
                        <div className="space-x-4 text-gray-400 text-xs">
                            <span>조회 {post.view_count}</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-[300px] text-gray-800 leading-relaxed whitespace-pre-wrap mb-10 text-sm">
                    {post.content}
                </div>

                {/* Comments Section */}
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

                    {/* Comment Form */}
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

            <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
                    <p>© 2026 북위키 (Book-Wiki). All rights reserved.</p>
                </div>
            </footer>
        </main>
    );
}
