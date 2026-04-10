"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Editor from "@/components/Editor";
import { uploadImage, uploadAttachment, formatFileSize } from "@/lib/upload";

export default function EditPage() {
    const { id } = useParams();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [boardType, setBoardType] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminBadge, setShowAdminBadge] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [attachDragOver, setAttachDragOver] = useState(false);
    const attachFileRef = useRef(null);
    const router = useRouter();

    // 투표 기능
    const [usePoll, setUsePoll] = useState(false);
    const [pollOptions, setPollOptions] = useState([{ id: 1, text: "" }, { id: 2, text: "" }]);

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
            setAttachments(data.attachments || []);
            
            if (data.poll_options && data.poll_options.length > 0) {
                setUsePoll(true);
                setPollOptions(data.poll_options);
            }

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

        const updateData = { title, content, board_type: boardType, attachments };
        if (usePoll) {
            const validOptions = pollOptions.filter(opt => opt.text.trim() !== "");
            if (validOptions.length < 2) {
                alert("투표 항목을 2개 이상 입력해주세요.");
                setIsSubmitting(false);
                return;
            }
            updateData.poll_options = validOptions;
        } else {
            updateData.poll_options = null;
        }

        const { error } = await supabase
            .from("bw_posts")
            .update(updateData)
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
                            onImageUpload={async (file) => {
                                const result = await uploadImage(file);
                                return result.url;
                            }}
                        />
                    </div>

                    {/* 파일 첨부 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">파일 첨부</label>
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${attachDragOver ? "border-[#355E3B] bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                            onDragOver={(e) => { e.preventDefault(); setAttachDragOver(true); }}
                            onDragLeave={() => setAttachDragOver(false)}
                            onDrop={async (e) => {
                                e.preventDefault();
                                setAttachDragOver(false);
                                const files = Array.from(e.dataTransfer.files);
                                if (!files.length) return;
                                setUploadingFiles(true);
                                const results = [];
                                for (const file of files) {
                                    try {
                                        const result = await uploadAttachment(file);
                                        results.push(result);
                                    } catch (err) {
                                        alert(`${file.name} 업로드 실패: ${err.message}`);
                                    }
                                }
                                setAttachments(prev => [...prev, ...results]);
                                setUploadingFiles(false);
                            }}
                            onClick={() => attachFileRef.current?.click()}
                        >
                            <p className="text-2xl mb-1">📎</p>
                            <p className="text-sm text-gray-500">파일을 여기에 드래그하거나 클릭해서 선택</p>
                            <p className="text-xs text-gray-400 mt-1">이미지 5MB · 기타 파일 20MB 이하</p>
                        </div>
                        <input
                            ref={attachFileRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                                const files = Array.from(e.target.files);
                                if (!files.length) return;
                                setUploadingFiles(true);
                                const results = [];
                                for (const file of files) {
                                    try {
                                        const result = await uploadAttachment(file);
                                        results.push(result);
                                    } catch (err) {
                                        alert(`${file.name} 업로드 실패: ${err.message}`);
                                    }
                                }
                                setAttachments(prev => [...prev, ...results]);
                                setUploadingFiles(false);
                                e.target.value = "";
                            }}
                        />
                        {uploadingFiles && <p className="text-xs text-[#355E3B] mt-2 font-medium">업로드 중...</p>}
                        {attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <span className="text-lg flex-shrink-0">{att.type.startsWith("image/") ? "🖼️" : "📄"}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate">{att.name}</p>
                                            <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-gray-300 hover:text-red-500 transition-colors text-sm flex-shrink-0"
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 투표 (Poll) 설정란 */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <label className="flex items-center cursor-pointer mb-2">
                            <input
                                type="checkbox"
                                checked={usePoll}
                                onChange={(e) => setUsePoll(e.target.checked)}
                                className="w-4 h-4 text-[#355E3B] border-gray-300 rounded focus:ring-[#355E3B]"
                            />
                            <span className="ml-2 font-bold text-gray-700 text-sm">참여형 투표 기능 사용하기</span>
                        </label>
                        
                        {usePoll && (
                            <div className="mt-4 space-y-3 pl-6 border-l-2 border-[#355E3B]">
                                <p className="text-xs text-gray-500 mb-2">항목은 최소 2개 이상 필요합니다.</p>
                                {pollOptions.map((opt, index) => (
                                    <div key={opt.id} className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500 w-5">{index + 1}.</span>
                                        <input
                                            type="text"
                                            value={opt.text}
                                            onChange={(e) => {
                                                const newOpts = [...pollOptions];
                                                newOpts[index].text = e.target.value;
                                                setPollOptions(newOpts);
                                            }}
                                            placeholder={`투표 항목 ${index + 1}`}
                                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => setPollOptions(pollOptions.filter(o => o.id !== opt.id))}
                                                className="text-gray-400 hover:text-red-500 font-bold px-2"
                                            >✕</button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 10 && (
                                    <button
                                        type="button"
                                        onClick={() => setPollOptions([...pollOptions, { id: Math.max(0, ...pollOptions.map(o => o.id)) + 1, text: "" }])}
                                        className="text-xs text-[#355E3B] font-bold hover:underline mt-2 flex items-center gap-1"
                                    >
                                        <span>+</span> 항목 추가
                                    </button>
                                )}
                            </div>
                        )}
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
