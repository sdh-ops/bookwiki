"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import MentionInput from "@/components/MentionInput";

// Board type to Korean name mapping
const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "톡톡",
    ai: "AI허브",
};

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

// 랜덤 익명 닉네임 생성 (형용사 + 명사 + 번호)
const generateAnonNickname = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(10 + Math.random() * 90); // 10-99
    return `${adj}${noun}${num}`;
};

// Comment Item Component (recursive)
function CommentItem({ comment, depth, handleReply, handleCommentAction }) {
    const isReply = depth > 0;
    const marginLeft = depth > 0 ? 'ml-6 md:ml-10' : '';

    // @mention 강조 표시
    const renderContentWithMentions = (content) => {
        const mentionRegex = /@(\S+)/g;
        const parts = content.split(mentionRegex);

        return parts.map((part, idx) => {
            if (idx % 2 === 1) {
                // mention 부분
                return (
                    <span key={idx} className="text-blue-500 font-medium">
                        @{part}
                    </span>
                );
            }
            return part;
        });
    };

    return (
        <div className="space-y-4">
            <div className={`p-4 rounded border bg-gray-50 border-gray-100 ${isReply ? `${marginLeft} border-l-4 border-l-[#355E3B]` : ''}`}>
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        {isReply && <span className="text-[#355E3B] font-bold text-sm mr-1">ㄴ</span>}
                        <span className="text-xs font-bold text-gray-700">
                            {comment.author}
                            {comment.user_id && (
                                <span
                                    className="ml-0.5 text-green-500 font-bold"
                                    style={{
                                        textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                                        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'
                                    }}
                                    title="회원"
                                >
                                    ✓
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                        <div className="flex gap-1 text-[10px]">
                            <button
                                onClick={() => handleReply(comment.id, comment.author)}
                                className="text-blue-500 hover:underline"
                            >
                                답글
                            </button>
                            <button
                                onClick={() => handleCommentAction('delete', comment)}
                                className="text-red-500 hover:underline"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-sm whitespace-pre-wrap text-gray-700">
                    {renderContentWithMentions(comment.content)}
                </p>
            </div>

            {/* Render replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="space-y-4">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            depth={depth + 1}
                            handleReply={handleReply}
                            handleCommentAction={handleCommentAction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function PostDetailPage() {
    const { id } = useParams();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [commentAuthor, setCommentAuthor] = useState("");
    const [commentPassword, setCommentPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [targetBoard, setTargetBoard] = useState("");
    const [tempPassword, setTempPassword] = useState("");
    const [managementType, setManagementType] = useState("");
    const router = useRouter();

    // Comment management states
    const [commentModal, setCommentModal] = useState({ show: false, type: '', commentId: null });
    const [commentTempPassword, setCommentTempPassword] = useState("");
    const [replyToId, setReplyToId] = useState(null);
    const [replyToAuthor, setReplyToAuthor] = useState('');
    const commentInputRef = useRef(null);

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

            // Fetch comments (삭제되지 않은 댓글만)
            const { data: commentData } = await supabase
                .from("bw_comments")
                .select("*")
                .eq("post_id", id)
                .eq("is_deleted", false)
                .order("created_at", { ascending: true });

            if (commentData) {
                setComments(commentData);
            }

            setLoading(false);
        }

        if (id) fetchData();
    }, [id, router]);

    // Auto-set nickname for users
    useEffect(() => {
        if (user) {
            const nickname = user.user_metadata?.nickname || user.email.split('@')[0];
            setCommentAuthor(nickname);
        } else if (user === null && !commentAuthor) {
            // 비회원은 랜덤 익명 닉네임 자동 생성
            setCommentAuthor(generateAnonNickname());
        }
    }, [user, commentAuthor]);

    const refreshComments = async () => {
        const { data } = await supabase
            .from("bw_comments")
            .select("*")
            .eq("post_id", id)
            .order("created_at", { ascending: true });
        setComments(data || []);
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment || !commentAuthor) {
            alert("이름과 내용을 입력해주세요.");
            return;
        }
        // 비회원만 비밀번호 필요
        if (!user && !commentPassword) {
            alert("비밀번호를 입력해주세요.");
            return;
        }

        setSubmitting(true);
        const commentData = {
            post_id: id,
            content: newComment,
            author: commentAuthor,
            is_deleted: false,
            parent_id: replyToId // 대댓글이면 parent_id 저장
        };
        // 회원이면 user_id 저장, 비회원이면 password 저장
        if (user) {
            commentData.user_id = user.id;
        } else {
            commentData.password = commentPassword;
        }

        // 1. 댓글 저장
        const { data: insertedComment, error } = await supabase
            .from("bw_comments")
            .insert([commentData])
            .select()
            .single();

        if (error) {
            alert("댓글 작성 실패: " + error.message);
            setSubmitting(false);
            return;
        }

        // 2. @mention 파싱 및 저장
        const mentionRegex = /@(\S+)/g;
        const foundMentions = [...newComment.matchAll(mentionRegex)].map(m => m[1]);

        if (foundMentions.length > 0 && user) {
            // 멘션된 사용자 조회
            const { data: mentionedUsers } = await supabase
                .from('bw_comments')
                .select('author, user_id')
                .eq('post_id', id)
                .in('author', foundMentions)
                .not('user_id', 'is', null); // 회원만

            if (mentionedUsers && mentionedUsers.length > 0) {
                // bw_comment_mentions에 저장
                const mentionData = mentionedUsers.map(mu => ({
                    comment_id: insertedComment.id,
                    mentioned_user_id: mu.user_id,
                    mentioned_username: mu.author
                }));

                await supabase.from('bw_comment_mentions').insert(mentionData);
            }
        }

        // 3. UI 업데이트
        setNewComment("");
        setCommentPassword("");
        setReplyToId(null);
        setReplyToAuthor('');
        await refreshComments();

        // Update comment count on post
        await supabase
            .from("bw_posts")
            .update({ comment_count: comments.length + 1 })
            .eq("id", id);

        setSubmitting(false);
    };

    // Reply to comment
    const handleReply = (commentId, authorName) => {
        setReplyToId(commentId);
        setReplyToAuthor(authorName);
        // 답글 작성 시 닉네임을 태그해서 입력창에 넣어줌
        setNewComment(`@${authorName} `);
        commentInputRef.current?.focus();
    };

    // Organize comments hierarchically
    const organizeComments = (comments) => {
        const commentMap = {};
        const rootComments = [];

        // Create a map of all comments
        comments.forEach(comment => {
            commentMap[comment.id] = { ...comment, replies: [] };
        });

        // Organize into hierarchy
        comments.forEach(comment => {
            if (comment.parent_id && commentMap[comment.parent_id]) {
                commentMap[comment.parent_id].replies.push(commentMap[comment.id]);
            } else {
                rootComments.push(commentMap[comment.id]);
            }
        });

        return rootComments;
    };

    // Comment management
    const handleCommentAction = (type, comment) => {
        if (isAdmin) {
            // Admin can delete without password
            if (type === 'delete') {
                if (confirm("댓글을 삭제하시겠습니까? (복원 가능)")) executeCommentDelete(comment.id);
            }
        } else {
            // Need password verification
            setCommentModal({ show: true, type, commentId: comment.id, comment });
        }
    };

    const executeCommentDelete = async (commentId) => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        // 소프트 삭제: is_deleted = true로 설정
        const { error } = await supabase
            .from("bw_comments")
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: currentUser?.email || (isAdmin ? "admin" : "user")
            })
            .eq("id", commentId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            await refreshComments();
            // Update comment count
            await supabase
                .from("bw_posts")
                .update({ comment_count: Math.max(0, comments.length - 1) })
                .eq("id", id);
        }
    };

    const handleCommentPasswordConfirm = async () => {
        const { type, comment } = commentModal;

        if (commentTempPassword === comment.password) {
            if (type === 'delete') {
                await executeCommentDelete(comment.id);
            }
        } else {
            alert("비밀번호가 틀렸습니다.");
        }
        setCommentModal({ show: false, type: '', commentId: null });
        setCommentTempPassword("");
    };

    const handleManagement = (type) => {
        if (!post) return;

        // 관리자는 다른 사용자 글 수정 불가 (게시판 이동은 가능)
        if (isAdmin && type === 'edit' && post.user_id !== user?.id) {
            alert("관리자는 다른 사용자의 게시글을 수정할 수 없습니다.");
            return;
        }

        // 게시판 이동 (관리자 전용)
        if (type === 'move') {
            if (isAdmin) {
                setTargetBoard(post.board_type);
                setShowMoveModal(true);
            } else {
                alert("게시판 이동 권한이 없습니다.");
            }
            return;
        }

        // If Owner (user_id match)
        if (user && post.user_id === user.id) {
            if (type === 'delete') {
                if (confirm("정말로 삭제하시겠습니까?")) executeDelete();
            } else {
                router.push(`/post/${id}/edit`);
            }
            return;
        }

        // If Admin (delete only)
        if (isAdmin) {
            if (type === 'delete') {
                if (confirm("정말로 삭제하시겠습니까?")) executeDelete();
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
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        // 소프트 삭제: is_deleted = true로 설정
        const { error } = await supabase
            .from("bw_posts")
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: currentUser?.email || (isAdmin ? "admin" : "user")
            })
            .eq("id", id);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
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

    const handleMovePost = async () => {
        if (!targetBoard) return;
        if (targetBoard === post.board_type) {
            setShowMoveModal(false);
            return;
        }

        const { error } = await supabase
            .from("bw_posts")
            .update({ board_type: targetBoard })
            .eq("id", id);

        if (error) {
            alert("게시판 이동 실패: " + error.message);
        } else {
            alert(`게시글이 [${boardTypeNames[targetBoard]}] 게시판으로 이동되었습니다.`);
            setShowMoveModal(false);
            window.location.reload(); // 리프레시하여 변경된 헤더/게시판 명칭 반영
        }
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!post) return <div className="p-10 text-center">게시글을 찾을 수 없습니다.</div>;

    // Check if current user can edit/delete
    const canManage = isAdmin || !post.user_id || (user && post.user_id === user.id);

    return (
        <main className="min-h-screen bg-white">
            <header className="bg-[#355E3B] text-white py-3">
                <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                        <nav className="hidden md:flex space-x-4 text-sm font-medium">
                            <Link href="/" className="hover:underline">전체</Link>
                            <Link href="/?board=hot" className="hover:underline">HOT</Link>
                            <Link href="/?board=job" className="hover:underline">구인구직</Link>
                            <Link href="/?board=support" className="hover:underline">지원사업</Link>
                            <Link href="/?board=free" className="hover:underline">톡톡</Link>
                            <Link href="/?board=ai" className="hover:underline">AI허브</Link>
                        </nav>
                    </div>
                    <div className="flex items-center space-x-3 text-xs">
                        {user ? (
                            <>
                                <span className="text-white/60 hidden md:inline">{user.user_metadata?.nickname || user.email?.split('@')[0]}</span>
                                <Link href="/mypage" className="hover:underline opacity-80 hidden md:inline">내 활동</Link>
                            </>
                        ) : (
                            <Link href="/login" className="hover:underline opacity-80">로그인</Link>
                        )}
                        <Link href="/write" className="hover:underline font-bold">글쓰기</Link>
                    </div>
                </div>
            </header>

            <article className="max-w-4xl mx-auto px-4 py-8">
                <div className="border-b-2 border-gray-200 pb-4 mb-6">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2 text-[10px] font-bold text-[#355E3B]">
                            <span>{boardTypeNames[post.board_type] || post.board_type}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-400 font-normal">{new Date(post.created_at).toLocaleString()}</span>
                        </div>
                        {canManage && (
                            <div className="flex space-x-2 text-[10px] text-gray-400 font-bold">
                                {/* 관리자가 다른 사용자 글일 때 수정 버튼 숨김 */}
                                {(!isAdmin || (user && post.user_id === user.id)) && (
                                    <button onClick={() => handleManagement('edit')} className="hover:text-black">수정</button>
                                )}
                                {isAdmin && (
                                    <button onClick={() => handleManagement('move')} className="text-blue-500 hover:underline">이동</button>
                                )}
                                <button onClick={() => handleManagement('delete')} className="hover:text-red-500">삭제</button>
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                        <span className="font-bold">
                            {post.author}
                            {post.user_id && (
                  <span
                    className="ml-1 text-green-500 text-xs font-bold"
                    style={{
                      textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                      filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'
                    }}
                    title="회원"
                  >
                    ✓
                  </span>
                )}
                        </span>
                        <div className="space-x-4 text-gray-400 text-xs">
                            <span>조회 {post.view_count || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="min-h-[300px] text-gray-800 leading-relaxed text-sm">
                    <style jsx global>{`
                        .post-content iframe {
                            max-width: 100%;
                            height: auto;
                            min-height: 400px;
                        }
                        @media (max-width: 640px) {
                            .post-content iframe {
                                height: 350px !important;
                                min-height: 350px;
                            }
                        }
                        .post-content img {
                            max-width: 100%;
                            height: auto;
                        }
                        .post-content table {
                            max-width: 100%;
                            overflow-x: auto;
                            display: block;
                        }
                    `}</style>
                    <div className="post-content mb-6 overflow-x-auto" dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(post.content, {
                            ADD_TAGS: ['iframe'], // Keep for backward compatibility if any
                            ADD_ATTR: ['src', 'allowfullscreen', 'frameborder', 'allow'],
                            ALLOWED_TAGS: [
                                'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4',
                                'h5', 'h6', 'hgroup', 'main', 'nav', 'section', 'blockquote', 'dd', 'div',
                                'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'main', 'ol', 'p', 'pre',
                                'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
                                'em', 'i', 'kbd', 'mark', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp',
                                'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'caption',
                                'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'img',
                                'iframe'
                            ],
                            ALLOWED_ATTR: [
                                'accept', 'accesskey', 'action', 'align', 'alt', 'autocomplete', 'autofocus',
                                'autoplay', 'bgcolor', 'border', 'challenge', 'charset', 'checked', 'cite',
                                'class', 'cols', 'colspan', 'content', 'contenteditable', 'contextmenu',
                                'controls', 'coords', 'data', 'datetime', 'default', 'defer', 'dir',
                                'disabled', 'download', 'draggable', 'enctype', 'for', 'form', 'formaction',
                                'formenctype', 'formmethod', 'formnovalidate', 'formtarget', 'headers',
                                'height', 'hidden', 'high', 'href', 'hreflang', 'http-equiv', 'icon', 'id',
                                'importance', 'integrity', 'ismap', 'itemprop', 'keytype', 'kind', 'label',
                                'lang', 'list', 'loop', 'low', 'manifest', 'max', 'maxlength', 'media',
                                'method', 'min', 'minlength', 'multiple', 'muted', 'name', 'novalidate',
                                'open', 'optimum', 'pattern', 'placeholder', 'poster', 'preload', 'radiogroup',
                                'readonly', 'rel', 'required', 'reversed', 'rows', 'rowspan', 'sandbox',
                                'scope', 'scoped', 'selected', 'shape', 'size', 'sizes', 'slot', 'span',
                                'spellcheck', 'src', 'srcdoc', 'srclang', 'srcset', 'start', 'step', 'style',
                                'summary', 'tabindex', 'target', 'title', 'translate', 'type', 'usemap',
                                'value', 'width', 'wrap', 'allowfullscreen', 'frameborder', 'allow'
                            ]
                        }) 
                    }}></div>

                    {/* 첨부파일 */}
                    {post.attachments?.length > 0 && (
                        <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">첨부파일 ({post.attachments.length})</h4>
                            <div className="space-y-2">
                                {post.attachments.map((att, i) => (
                                    <a
                                        key={i}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={att.name}
                                        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-[#355E3B] hover:shadow-sm transition-all group"
                                    >
                                        <span className="text-xl flex-shrink-0">{att.type?.startsWith("image/") ? "🖼️" : "📄"}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate group-hover:text-[#355E3B]">{att.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {att.size < 1024 ? att.size + " B"
                                                    : att.size < 1024 * 1024 ? (att.size / 1024).toFixed(1) + " KB"
                                                    : (att.size / (1024 * 1024)).toFixed(1) + " MB"}
                                            </p>
                                        </div>
                                        <span className="text-xs text-gray-400 group-hover:text-[#355E3B] flex-shrink-0">↓ 다운로드</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 실시간 미리보기 필드 (새로운 방식) */}
                    {post.preview_url && (
                        <div className="mb-10 p-1 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 flex justify-between items-center border-bottom border-gray-200">
                                <span>📄 미리보기</span>
                                <a href={post.preview_url.split('file=')[1] || post.preview_url.split('src=')[1] || "#"} target="_blank" className="text-blue-500 hover:underline">새창으로 열기</a>
                            </div>
                            <div className="relative w-full h-[600px] bg-white">
                                <iframe 
                                    src={post.preview_url}
                                    className="w-full h-full border-none"
                                    allowFullScreen
                                    title="Document Preview"
                                ></iframe>
                            </div>
                        </div>
                    )}

                    {/* 구인구직 채용 정보 */}
                    {post.board_type === "job" && (post.job_type || post.job_category || post.experience_level || post.deadline) && (
                        <div className="mt-6 mb-10 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                                <span className="text-lg mr-2">📋</span> 채용 정보
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {post.job_type && (
                                    <div>
                                        <span className="font-bold text-gray-700">분류:</span>
                                        <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                                            post.job_type === 'hiring'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-green-100 text-green-700'
                                        }`}>
                                            {post.job_type === 'hiring' ? '구인 (채용)' : '구직 (지원 희망)'}
                                        </span>
                                    </div>
                                )}
                                {post.job_category && (
                                    <div>
                                        <span className="font-bold text-gray-700">직군:</span>
                                        <span className="ml-2 text-gray-600">
                                            {{
                                                editing: "편집",
                                                marketing: "마케팅",
                                                design: "디자이너",
                                                production: "제작",
                                                sales: "영업",
                                                writer: "작가",
                                                other: "기타"
                                            }[post.job_category] || post.job_category}
                                        </span>
                                    </div>
                                )}
                                {post.experience_level && (
                                    <div>
                                        <span className="font-bold text-gray-700">경력:</span>
                                        <span className="ml-2 text-gray-600">
                                            {{
                                                entry: "신입",
                                                "1-3": "1-3년",
                                                "3-5": "3-5년",
                                                "5-10": "5-10년",
                                                "10+": "10년 이상"
                                            }[post.experience_level] || post.experience_level}
                                        </span>
                                    </div>
                                )}
                                {(post.deadline || post.deadline === null) && (
                                    <div>
                                        <span className="font-bold text-gray-700">마감일:</span>
                                        <span className="ml-2 text-gray-600">
                                            {post.deadline ? new Date(post.deadline).toLocaleDateString() : "충원시"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                <div className="border-t border-gray-200 pt-8">
                    <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center">
                        댓글 <span className="ml-2 bg-[#355E3B] text-white text-[10px] px-2 py-0.5 rounded-full">{comments.length}</span>
                    </h3>

                    <div className="space-y-4 mb-10">
                        {organizeComments(comments).map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                depth={0}
                                handleReply={handleReply}
                                handleCommentAction={handleCommentAction}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="bg-white border border-gray-200 rounded p-4">
                        {replyToId && (
                            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                                <span className="text-xs text-blue-700">
                                    <span className="font-bold">{replyToAuthor}</span>님에게 답글 작성 중
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReplyToId(null);
                                        setReplyToAuthor('');
                                    }}
                                    className="text-xs text-blue-500 hover:text-blue-700"
                                >
                                    취소
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2 mb-3 flex-wrap">
                            <input
                                type="text"
                                placeholder="닉네임"
                                value={commentAuthor}
                                onChange={(e) => !user && setCommentAuthor(e.target.value)}
                                className={`w-full md:w-auto md:flex-1 max-w-xs px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#355E3B] ${user || !user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                readOnly={true}
                                required
                            />
                            {!user && (
                                <input
                                    type="password"
                                    placeholder="비밀번호"
                                    value={commentPassword}
                                    onChange={(e) => setCommentPassword(e.target.value)}
                                    className="w-28 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#355E3B]"
                                    required
                                />
                            )}
                            {user && (
                                <span className="text-[10px] text-green-600 flex items-center">✓ 회원</span>
                            )}
                        </div>
                        <MentionInput
                            value={newComment}
                            onChange={setNewComment}
                            placeholder={replyToId ? `${replyToAuthor}님에게 답글을 작성하세요... (@로 태그)` : "댓글을 남겨보세요 (@로 태그 가능)"}
                            className="w-full h-24 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B] resize-none mb-3"
                            postId={id}
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`bg-[#355E3B] text-white px-6 py-2 rounded text-xs transition hover:bg-[#2A4A2E] ${submitting ? "opacity-50" : ""}`}
                            >
                                {replyToId ? '답글 등록' : '댓글 등록'}
                            </button>
                        </div>
                    </form>
                </div>
            </article>

            {/* Board Move Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded p-6 max-w-xs w-full shadow-2xl">
                        <h4 className="text-sm font-bold mb-4">게시판 이동</h4>
                        <div className="space-y-2 mb-6">
                            {Object.entries(boardTypeNames).map(([id, name]) => (
                                <button
                                    key={id}
                                    onClick={() => setTargetBoard(id)}
                                    className={`w-full text-left px-4 py-2 text-sm rounded border ${
                                        targetBoard === id ? "bg-[#355E3B] text-white border-[#355E3B]" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                    }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setShowMoveModal(false)}
                                className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded border border-gray-100"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleMovePost}
                                className="flex-1 py-2 text-xs bg-[#355E3B] text-white rounded hover:bg-[#2A4A2E]"
                            >
                                이동하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Post Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded p-6 max-w-xs w-full shadow-2xl">
                        <h4 className="text-sm font-bold mb-4">비밀번호 확인</h4>
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={tempPassword}
                            onChange={(e) => setTempPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-4 focus:outline-none focus:border-[#355E3B]"
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
                                className="flex-1 py-2 text-xs bg-[#355E3B] text-white rounded hover:bg-[#2A4A2E]"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comment Password Modal */}
            {commentModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded p-6 max-w-xs w-full shadow-2xl">
                        <h4 className="text-sm font-bold mb-4">댓글 비밀번호 확인</h4>
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={commentTempPassword}
                            onChange={(e) => setCommentTempPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-4 focus:outline-none focus:border-[#355E3B]"
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => { setCommentModal({ show: false, type: '', commentId: null }); setCommentTempPassword(""); }}
                                className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded border border-gray-100"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCommentPasswordConfirm}
                                className="flex-1 py-2 text-xs bg-[#355E3B] text-white rounded hover:bg-[#2A4A2E]"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
                    <p className="mb-2">© 2026 북위키 (Book-Wiki). All rights reserved.</p>
                    <p className="space-x-3">
                        <Link href="/terms" className="hover:underline">이용약관</Link>
                        <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
                    </p>
                </div>
            </footer>
        </main>
    );
}
