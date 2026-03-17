"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Editor from "@/components/Editor";

// 비회원 익명 닉네임 생성용 단어 목록
const ADJECTIVES = [
    "마감중인", "교정중인", "밤샘하는", "잉크묻은", "종이굽는", "책장넘기는",
    "오타찾는", "표지그리는", "인쇄걸어둔", "기획안쓰는", "외근나온", "차마시는",
    "서점나들이간", "글발좋은", "문장고치는", "반려당한", "승인받은", "퇴근꿈꾸는",
    "커피수혈중인", "파주사는", "합정가는"
];

const NOUNS = [
    "고양이", "강아지", "에디터", "디자이너", "마케터", "작가님", "제작부장",
    "인쇄기", "북디자인", "만년필", "원고뭉치", "교정지", "서점원", "북클럽",
    "출판사", "책벌레", "종이배", "책갈피", "문장가", "편집장", "팀장",
    "신입사원", "독서가"
];

// 톡톡 게시판 카테고리
const freeBoardCategories = [
    { id: "모집", name: "[모집]" },
    { id: "후기", name: "[후기]" },
    { id: "잡담", name: "[잡담]" },
];

function WritePageContent() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [boardType, setBoardType] = useState("free");
    const [freeCategory, setFreeCategory] = useState("잡담"); // 톡톡 카테고리 (기본값: 잡담)
    const [author, setAuthor] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();

    // 구인구직 추가 필드
    const [jobCategory, setJobCategory] = useState("");
    const [experienceLevel, setExperienceLevel] = useState("");
    const [deadline, setDeadline] = useState("");
    const [contactInfo, setContactInfo] = useState("");

    // URL에서 게시판 파라미터 읽어서 기본값 설정
    useEffect(() => {
        const boardParam = searchParams.get("board");
        if (boardParam && ["free", "job", "support"].includes(boardParam)) {
            setBoardType(boardParam);
        }
    }, [searchParams]);

    // 랜덤 익명 닉네임 생성 (형용사 + 명사 + 번호)
    const generateAnonNickname = () => {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const num = Math.floor(10 + Math.random() * 90); // 10-99
        return `${adj}${noun}${num}`;
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

        // Non-members can only post to 톡톡
        if (!user && boardType !== "free") {
            alert("비회원은 톡톡 게시판에만 글을 작성할 수 있습니다.");
            return;
        }

        // Guest posts require password
        if (!user && !password) {
            alert("비회원 글쓰기는 비밀번호가 필요합니다.");
            return;
        }

        // 톡톡 게시판에서 카테고리 확인
        if (boardType === "free" && !freeCategory) {
            alert("톡톡 게시판에서는 카테고리를 선택해주세요.");
            return;
        }

        // 구인구직 게시판 필수 필드 확인
        if (boardType === "job") {
            if (!jobCategory) {
                alert("직군을 선택해주세요.");
                return;
            }
            if (!experienceLevel) {
                alert("경력을 선택해주세요.");
                return;
            }
            if (!deadline) {
                alert("마감일을 선택해주세요.");
                return;
            }
            if (!contactInfo) {
                alert("연락처를 입력해주세요.");
                return;
            }
        }

        setIsSubmitting(true);

        // 톡톡 게시판인 경우 제목 앞에 카테고리 추가
        let finalTitle = title;
        if (boardType === "free" && freeCategory) {
            finalTitle = `[${freeCategory}] ${title}`;
        }

        const postData = {
            title: finalTitle,
            content,
            author,
            board_type: boardType,
            user_id: user ? user.id : null,
            password: user ? null : password
        };

        // 구인구직 게시판의 경우 추가 필드
        if (boardType === "job") {
            postData.job_category = jobCategory;
            postData.experience_level = experienceLevel;
            postData.deadline = deadline === "충원시" ? null : deadline;
            postData.contact_info = contactInfo;
        }

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
            { name: "톡톡", id: "free" },
            { name: "구인구직", id: "job" },
        ]
        : [
            { name: "톡톡", id: "free" },
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
                        비회원은 <strong>톡톡</strong> 게시판에만 글을 작성할 수 있습니다.
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
                                    onClick={() => {
                                        setBoardType(cat.id);
                                        if (cat.id !== "free") setFreeCategory("");
                                    }}
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

                    {/* 톡톡 게시판 카테고리 선택 */}
                    {boardType === "free" && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                카테고리 선택 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {freeBoardCategories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setFreeCategory(cat.id)}
                                        className={`px-4 py-1.5 text-xs rounded border ${freeCategory === cat.id
                                                ? "bg-blue-500 text-white border-blue-500"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-blue-500"
                                            }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">* 모집: 스터디/모임, 후기: 책/이벤트 후기, 잡담: 자유로운 이야기</p>
                        </div>
                    )}

                    {/* 구인구직 게시판 추가 필드 */}
                    {boardType === "job" && (
                        <div className="space-y-4 bg-blue-50 p-4 rounded border border-blue-200">
                            <h3 className="text-sm font-bold text-gray-700 mb-3">📋 채용 정보</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 직군 */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        직군 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={jobCategory}
                                        onChange={(e) => setJobCategory(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                        required
                                    >
                                        <option value="">선택하세요</option>
                                        <option value="editing">편집</option>
                                        <option value="marketing">마케팅</option>
                                        <option value="design">디자이너</option>
                                        <option value="production">제작</option>
                                        <option value="sales">영업</option>
                                        <option value="writer">작가</option>
                                        <option value="other">기타</option>
                                    </select>
                                </div>

                                {/* 경력 */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        경력 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={experienceLevel}
                                        onChange={(e) => setExperienceLevel(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                        required
                                    >
                                        <option value="">선택하세요</option>
                                        <option value="entry">신입</option>
                                        <option value="1-3">1-3년</option>
                                        <option value="3-5">3-5년</option>
                                        <option value="5-10">5-10년</option>
                                        <option value="10+">10년 이상</option>
                                    </select>
                                </div>
                            </div>

                            {/* 마감일 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    접수 마감일 <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={deadline === "충원시" ? "" : deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setDeadline("충원시")}
                                        className={`px-4 py-2 text-sm rounded border ${deadline === "충원시" ? "bg-[#355E3B] text-white border-[#355E3B]" : "bg-white text-gray-600 border-gray-300 hover:border-[#355E3B]"}`}
                                    >
                                        충원시
                                    </button>
                                </div>
                                {deadline === "충원시" && (
                                    <p className="mt-1 text-xs text-blue-600">✓ 충원시까지로 설정되었습니다</p>
                                )}
                            </div>

                            {/* 연락처 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    연락처 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={contactInfo}
                                    onChange={(e) => setContactInfo(e.target.value)}
                                    placeholder="이메일 또는 전화번호"
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500">* 지원자가 연락할 수 있는 이메일 또는 전화번호를 입력해주세요</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                닉네임 {user && <span className="text-green-600 text-xs font-normal">✓ 회원</span>}
                            </label>
                            <input
                                type="text"
                                value={author}
                                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-100 cursor-not-allowed"
                                placeholder="공개될 이름을 입력하세요"
                                readOnly
                                required
                            />
                            {!user && (
                                <p className="mt-1 text-xs text-gray-500">* 자동 생성된 임시 닉네임입니다. (수정 불가)</p>
                            )}
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
                        <Editor
                            content={content}
                            onChange={setContent}
                        />
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
