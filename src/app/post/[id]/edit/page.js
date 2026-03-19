"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Editor from "@/components/Editor";

export default function EditPage() {
    const { id } = useParams();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [boardType, setBoardType] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminBadge, setShowAdminBadge] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function fetchPost() {
            // Check user and admin status
            const { data: { user } } = await supabase.auth.getUser();
            let adminStatus = false;

            if (user) {
                try {
                    const { data: adminData } = await supabase
                        .from("bw_admins")
                        .select("email")
                        .eq("email", user.email)
                        .maybeSingle();
                    adminStatus = !!adminData;
                    setIsAdmin(adminStatus);
                } catch (e) {
                    console.log("Admin check failed:", e);
                }
            }

            const { data, error } = await supabase
                .from("bw_posts")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                alert("게시글을 찾을 수 없습니다.");
                router.push("/");
                return;
            }

            // Permission check: owner or guest post only (admin cannot edit others' posts)
            const isOwner = user && data.user_id === user.id;
            const isGuestPost = !data.user_id;

            // 관리자는 본인 글이 아니면 수정 불가
            if (adminStatus && !isOwner) {
                alert("관리자는 다른 사용자의 게시글을 수정할 수 없습니다. 삭제만 가능합니다.");
                router.push(`/post/${id}`);
                return;
            }

            // 본인 글이거나 비회원 글이어야 수정 가능
            if (!isOwner && !isGuestPost) {
                alert("수정 권한이 없습니다.");
                router.push(`/post/${id}`);
                return;
            }

            setTitle(data.title);
            setContent(data.content);
            setBoardType(data.board_type);
            setShowAdminBadge(adminStatus && !isOwner);
            setLoading(false);
        }
        fetchPost();
    }, [id, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content) {
            alert("모든 필드를 채워주세요.");
            return;
        }

        setIsSubmitting(true);
        const { error } = await supabase
            .from("bw_posts")
            .update({ title, content, board_type: boardType })
            .eq("id", id);

        if (error) {
            alert("수정에 실패했습니다: " + error.message);
        } else {
            router.push(`/post/${id}`);
            router.refresh();
        }
        setIsSubmitting(false);
    };

    const boardCategories = [
        { name: "자유게시판", id: "free" },
        { name: "구인구직", id: "job" },
        { name: "지원사업", id: "support" },
        { name: "AI허브", id: "ai" },
    ];

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;

    return (
        <main className="min-h-screen bg-white">
            <header className="bg-[#355E3B] text-white py-3">
                <div className="max-w-3xl mx-auto px-4 flex items-center">
                    <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                    <span className="ml-4 text-sm font-medium opacity-80">글 수정하기</span>
                    {isAdmin && showAdminBadge && (
                        <span className="ml-2 text-[10px] bg-red-500 px-2 py-0.5 rounded font-bold">관리자 수정</span>
                    )}
                </div>
            </header>

            <section className="max-w-3xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">게시판 선택</label>
                        <div className="flex flex-wrap gap-2">
                            {boardCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setBoardType(cat.id)}
                                    className={`px-4 py-1.5 text-xs rounded border ${boardType === cat.id
                                            ? "bg-[#355E3B] text-white border-[#355E3B]"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-[#355E3B]"
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-medium focus:outline-none focus:border-[#355E3B]"
                            placeholder="제목을 입력하세요"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">내용</label>
                        <Editor
                            content={content}
                            onChange={setContent}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                        <Link href={`/post/${id}`} className="px-6 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">취소</Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-6 py-2 text-sm text-white bg-[#355E3B] rounded hover:bg-[#2A4A2E] ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isSubmitting ? "수정 중..." : "저장하기"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
