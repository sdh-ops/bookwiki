"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function EditPage() {
    const { id } = useParams();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [boardType, setBoardType] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function fetchPost() {
            const { data, error } = await supabase
                .from("bw_posts")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                alert("게시글을 찾을 수 없습니다.");
                router.push("/");
            } else {
                setTitle(data.title);
                setContent(data.content);
                setBoardType(data.board_type);
            }
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
            <header className="bg-[#4a6a8a] text-white py-3">
                <div className="max-w-3xl mx-auto px-4 flex items-center">
                    <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                    <span className="ml-4 text-sm font-medium opacity-80">글 수정하기</span>
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
                                            ? "bg-[#4a6a8a] text-white border-[#4a6a8a]"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-[#4a6a8a]"
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
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-medium focus:outline-none focus:border-[#4a6a8a]"
                            placeholder="제목을 입력하세요"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-80 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#4a6a8a] resize-none"
                            placeholder="내용을 작성해주세요"
                            required
                        ></textarea>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                        <Link href={`/post/${id}`} className="px-6 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">취소</Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-6 py-2 text-sm text-white bg-[#4a6a8a] rounded hover:bg-[#3a5a7a] ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isSubmitting ? "수정 중..." : "저장하기"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
