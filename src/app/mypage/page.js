"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function MyPageContent() {
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentTab = searchParams.get("tab") || "posts";

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert("로그인이 필요합니다.");
                router.push("/login");
                return;
            }

            setUser(user);

            // Fetch user's posts
            const { data: postsData } = await supabase
                .from("bw_posts")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (postsData) setPosts(postsData);

            // Fetch user's comments with post info
            const { data: commentsData } = await supabase
                .from("bw_comments")
                .select("*, bw_posts(id, title)")
                .eq("author", user.user_metadata?.nickname || user.email.split('@')[0])
                .order("created_at", { ascending: false });

            if (commentsData) setComments(commentsData);

            setLoading(false);
        }

        fetchData();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!user) return null;

    return (
        <main className="min-h-screen bg-white">
            <header className="bg-[#4a6a8a] text-white py-3">
                <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                        <span className="ml-4 text-sm font-medium opacity-80">내 활동</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-xs text-white/70">{user.email}</span>
                        <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">로그아웃</button>
                    </div>
                </div>
            </header>

            <section className="max-w-4xl mx-auto px-4 py-8">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => router.push("/mypage")}
                        className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${currentTab === "posts" ? "border-[#4a6a8a] text-[#4a6a8a]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                        내가 쓴 글 ({posts.length})
                    </button>
                    <button
                        onClick={() => router.push("/mypage?tab=comments")}
                        className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${currentTab === "comments" ? "border-[#4a6a8a] text-[#4a6a8a]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                        내가 쓴 댓글 ({comments.length})
                    </button>
                </div>

                {/* Posts Tab */}
                {currentTab === "posts" && (
                    <div>
                        {posts.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 text-sm">
                                작성한 글이 없습니다.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-2 py-2 font-medium">제목</th>
                                        <th className="px-2 py-2 font-medium w-24">게시판</th>
                                        <th className="px-2 py-2 font-medium w-24 text-center">날짜</th>
                                        <th className="px-2 py-2 font-medium w-16 text-center">조회</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {posts.map((post) => (
                                        <tr
                                            key={post.id}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => router.push(`/post/${post.id}`)}
                                        >
                                            <td className="px-2 py-3 font-medium text-gray-800">
                                                {post.title}
                                                {post.comment_count > 0 && (
                                                    <span className="text-red-500 ml-1 text-[10px] font-bold">[{post.comment_count}]</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-3 text-xs text-[#4a6a8a] font-bold">{post.board_type.toUpperCase()}</td>
                                            <td className="px-2 py-3 text-xs text-gray-400 text-center">{new Date(post.created_at).toLocaleDateString()}</td>
                                            <td className="px-2 py-3 text-xs text-gray-400 text-center">{post.view_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Comments Tab */}
                {currentTab === "comments" && (
                    <div>
                        {comments.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 text-sm">
                                작성한 댓글이 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className="border border-gray-200 rounded p-4 hover:bg-gray-50 cursor-pointer"
                                        onClick={() => router.push(`/post/${comment.post_id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs text-[#4a6a8a] font-bold">
                                                {comment.bw_posts?.title || "삭제된 게시글"}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(comment.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">
                                            {comment.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
                    <p>© 2026 북위키 (Book-Wiki). All rights reserved.</p>
                </div>
            </footer>
        </main>
    );
}

export default function MyPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
            <MyPageContent />
        </Suspense>
    );
}
