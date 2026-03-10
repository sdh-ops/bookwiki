"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WritePage() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [boardType, setBoardType] = useState("free");
    const [author, setAuthor] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content || !author) {
            alert("모든 필드를 채워주세요.");
            return;
        }

        setIsSubmitting(true);
        const { error } = await supabase.from("bw_posts").insert([
            { title, content, author, board_type: boardType }
        ]);

        if (error) {
            alert("글 작성에 실패했습니다: " + error.message);
        } else {
            router.push("/");
        }
        setIsSubmitting(false);
    };

    const boardCategories = [
        { name: "자유게시판", id: "free" },
        { name: "구인구직", id: "job" },
        { name: "지원사업", id: "support" },
        { name: "AI허브", id: "ai" },
    ];

    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
            <header className="bg-[#4a6a8a] text-white py-3">
                <div className="max-w-3xl mx-auto px-4 flex items-center">
                    <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                    <span className="ml-4 text-sm font-medium opacity-80">글쓰기</span>
                </div>
            </header>

            <section className="max-w-3xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Board Selector */}
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

                    {/* Author */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">닉네임</label>
                        <input
                            type="text"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#4a6a8a]"
                            placeholder="글쓴이 이름을 입력하세요"
                            required
                        />
                    </div>

                    {/* Title */}
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

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-64 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#4a6a8a] resize-none"
                            placeholder="내용을 작성해주세요"
                            required
                        ></textarea>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                        <Link href="/" className="px-6 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">취소</Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-6 py-2 text-sm text-white bg-[#4a6a8a] rounded hover:bg-[#3a5a7a] ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isSubmitting ? "작성 중..." : "등록하기"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
