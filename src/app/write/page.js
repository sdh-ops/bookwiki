"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function WritePageContent() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [boardType, setBoardType] = useState("free");
    const [author, setAuthor] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL에서 게시판 파라미터 읽어서 기본값 설정
    useEffect(() => {
        const boardParam = searchParams.get("board");
        if (boardParam && ["free", "job", "support"].includes(boardParam)) {
            setBoardType(boardParam);
        }
    }, [searchParams]);

    // 랜덤 익명 닉네임 생성
    const generateAnonNickname = () => {
        const num = Math.floor(1000 + Math.random() * 9000); // 1000-9999
        return `위키키${num}`;
    };

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                // Always use nickname, never expose email
                setAuthor(user.user_metadata?.nickname || "익명");
            } else {
                // 비회원은 랜덤 익명 닉네임 자동 생성
                setAuthor(generateAnonNickname());
            }
            setLoading(false);
        };
        fetchUser();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content || !author) {
            alert("모든 필드를 채워주세요.");
            return;
        }

        // Non-members can only post to 자유게시판
        if (!user && boardType !== "free") {
            alert("비회원은 자유게시판에만 글을 작성할 수 있습니다.");
            return;
        }

        // Guest posts require password
        if (!user && !password) {
            alert("비회원 글쓰기는 비밀번호가 필요합니다.");
            return;
        }

        setIsSubmitting(true);

        const postData = {
            title,
            content,
            author,
            board_type: boardType,
            user_id: user ? user.id : null,
            password: user ? null : password
        };

        const { error } = await supabase.from("bw_posts").insert([postData]);

        if (error) {
            alert("글 작성에 실패했습니다: " + error.message);
        } else {
            router.push("/");
            router.refresh();
        }
        setIsSubmitting(false);
    };

    // All boards for logged-in users, only free board for guests
    // AI허브는 글쓰기 게시판이 아님 - AI 기능 제공 페이지
    const boardCategories = user
        ? [
            { name: "자유게시판", id: "free" },
            { name: "구인구직", id: "job" },
            { name: "지원사업", id: "support" },
        ]
        : [
            { name: "자유게시판", id: "free" },
        ];

    if (loading) {
        return <div className="p-10 text-center">로딩 중...</div>;
    }

    return (
        <main className="min-h-screen bg-white">
            <header className="bg-[#355E3B] text-white py-3">
                <div className="max-w-3xl mx-auto px-4 flex items-center">
                    <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                    <span className="ml-4 text-sm font-medium opacity-80">글쓰기</span>
                </div>
            </header>

            <section className="max-w-3xl mx-auto px-4 py-8">
                {!user && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        비회원은 <strong>자유게시판</strong>에만 글을 작성할 수 있습니다.
                        다른 게시판에 글을 쓰려면 <Link href="/login" className="text-[#355E3B] underline font-bold">로그인</Link>해주세요.
                    </div>
                )}

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                닉네임 {user && <span className="text-green-600 text-xs font-normal">✓ 회원</span>}
                            </label>
                            <input
                                type="text"
                                value={author}
                                onChange={(e) => !user && setAuthor(e.target.value)}
                                className={`w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B] ${user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                placeholder="공개될 이름을 입력하세요"
                                readOnly={!!user}
                                required
                            />
                        </div>
                        {!user && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호 (수정/삭제용)</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                    placeholder="비밀번호 4자리 이상"
                                    required={!user}
                                />
                            </div>
                        )}
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
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-80 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B] resize-none"
                            placeholder="내용을 작성해주세요"
                            required
                        ></textarea>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                        <Link href="/" className="px-6 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">취소</Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-6 py-2 text-sm text-white bg-[#355E3B] rounded hover:bg-[#2A4A2E] ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isSubmitting ? "작성 중..." : "등록하기"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}

export default function WritePage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
            <WritePageContent />
        </Suspense>
    );
}
