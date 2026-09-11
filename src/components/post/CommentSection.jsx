"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { COMMENT_COLUMNS } from "@/lib/columns";
import { kstDateTimeLabel } from "@/lib/date";
import { toast, confirmDialog } from "@/lib/notify";
import MentionInput from "@/components/MentionInput";
import Modal, { ModalActions } from "@/components/Modal";
import { MemberBadge } from "@/components/board/PostListItems";

// 비회원 익명 닉네임 (형용사 + 명사 + 번호)
const ADJECTIVES = [
  "마감중인", "교정중인", "밤샘하는", "잉크묻은", "종이굽는", "책장넘기는",
  "오타찾는", "표지그리는", "인쇄걸어둔", "기획안쓰는", "외근나온", "차마시는",
  "서점나들이간", "글발좋은", "문장고치는", "반려당한", "승인받은", "퇴근꿈꾸는",
  "커피수혈중인", "파주사는", "합정가는",
];
const NOUNS = [
  "고양이", "강아지", "에디터", "디자이너", "마케터", "작가님", "제작부장",
  "인쇄기", "북디자인", "만년필", "원고뭉치", "교정지", "서점원", "북클럽",
  "출판사", "책벌레", "종이배", "책갈피", "문장가", "편집장", "팀장",
  "신입사원", "독서가",
];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const generateAnonNickname = () => `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(10 + Math.random() * 90)}`;

async function loadComments(postId) {
  const { data, error } = await supabase
    .from("bw_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[comments] load:", error.message);
    toast("댓글을 불러오지 못했습니다.", "error");
    return null;
  }
  return data || [];
}

function renderWithMentions(content) {
  return content.split(/@(\S+)/g).map((part, idx) =>
    idx % 2 === 1 ? (
      <span key={idx} className="text-blue-600 font-medium">
        @{part}
      </span>
    ) : (
      part
    )
  );
}

function organize(comments) {
  const map = {};
  const roots = [];
  comments.forEach((c) => {
    map[c.id] = { ...c, replies: [] };
  });
  comments.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies.push(map[c.id]);
    else roots.push(map[c.id]);
  });
  return roots;
}

function CommentItem({ comment, depth, onReply, onDelete }) {
  const isReply = depth > 0;
  return (
    <div className="space-y-3">
      <div className={`p-3.5 md:p-4 rounded-lg border bg-gray-50 border-gray-100 ${isReply ? "ml-5 md:ml-10 border-l-4 border-l-[#355E3B]" : ""}`}>
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <div className="min-w-0">
            <span className="text-sm font-bold text-gray-800">
              {isReply && <span className="text-[#355E3B] mr-1" aria-hidden="true">ㄴ</span>}
              {comment.author}
              {comment.user_id && <MemberBadge />}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">{kstDateTimeLabel(comment.created_at)}</span>
          </div>
          <div className="flex shrink-0 -mr-1.5">
            <button type="button" onClick={() => onReply(comment)} className="text-xs text-blue-600 hover:bg-blue-50 rounded px-2.5 min-h-9">
              답글
            </button>
            <button type="button" onClick={() => onDelete(comment)} className="text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded px-2.5 min-h-9">
              삭제
            </button>
          </div>
        </div>
        {/* 공백 없는 긴 주소도 칸 안에서 줄바꿈 */}
        <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-gray-700 leading-relaxed">{renderWithMentions(comment.content)}</p>
      </div>
      {comment.replies?.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 댓글 목록 + 작성 + 삭제.
 * 구인구직 게시판은 댓글을 받지 않는다(예전 글에 달린 댓글은 목록만 보여 준다).
 */
export default function CommentSection({ postId, boardType, user, isAdmin }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, author }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef(null);
  const commentsClosed = boardType === "job";

  const applyLoaded = useCallback((rows) => {
    if (rows) setComments(rows);
    setLoaded(true);
  }, []);

  const refresh = useCallback(() => loadComments(postId).then(applyLoaded), [postId, applyLoaded]);

  useEffect(() => {
    let cancelled = false;
    loadComments(postId).then((rows) => !cancelled && applyLoaded(rows));
    return () => {
      cancelled = true;
    };
  }, [postId, applyLoaded]);

  // 비회원 익명 닉네임은 무작위라 서버 그림과 어긋나지 않게 브라우저에서 한 번만 짓는다
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 무작위 값은 마운트 뒤에만 정할 수 있다(하이드레이션 불일치 방지)
    setGuestName((prev) => prev || generateAnonNickname());
  }, []);

  // 회원은 계정 닉네임 고정, 비회원은 지어 준 이름을 고칠 수 있다
  const memberName = user ? user.user_metadata?.nickname || user.email.split("@")[0] : null;
  const author = memberName ?? guestName;
  const setAuthor = setGuestName;

  const handleReply = (comment) => {
    setReplyTo({ id: comment.id, author: comment.author });
    setNewComment(`@${comment.author} `);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => formRef.current?.querySelector("textarea")?.focus(), 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast("댓글 내용을 입력해 주세요.", "error");
      return;
    }
    if (!author.trim()) {
      toast("닉네임을 입력해 주세요.", "error");
      return;
    }
    if (!user && !password) {
      toast("나중에 지울 때 쓸 비밀번호를 입력해 주세요.", "error");
      return;
    }

    setSubmitting(true);
    const row = { post_id: postId, content: newComment, author, is_deleted: false, parent_id: replyTo?.id ?? null };
    if (user) row.user_id = user.id;
    else row.password = password;

    // 인자 없는 select() 는 select=* 라 password 까지 요구한다 — 뒤에서 쓰는 id 만 받는다
    const { data: inserted, error } = await supabase.from("bw_comments").insert([row]).select("id").single();
    if (error) {
      toast(`댓글을 등록하지 못했습니다: ${error.message}`, "error");
      setSubmitting(false);
      return;
    }

    // @멘션 (회원만)
    const mentions = [...newComment.matchAll(/@(\S+)/g)].map((m) => m[1]);
    if (mentions.length > 0 && user) {
      const { data: mentioned } = await supabase
        .from("bw_comments")
        .select("author, user_id")
        .eq("post_id", postId)
        .in("author", mentions)
        .not("user_id", "is", null);
      if (mentioned?.length) {
        const { error: mentionError } = await supabase.from("bw_comment_mentions").insert(
          mentioned.map((m) => ({ comment_id: inserted.id, mentioned_user_id: m.user_id, mentioned_username: m.author }))
        );
        if (mentionError) console.error("[comments] mention:", mentionError.message);
      }
    }

    setNewComment("");
    setPassword("");
    setReplyTo(null);
    await refresh();
    setSubmitting(false);
    toast(replyTo ? "답글을 등록했습니다." : "댓글을 등록했습니다.");
  };

  const deleteComment = async (commentId, pw = null) => {
    const { error } = await supabase.rpc("soft_delete_comment", { p_comment_id: commentId, p_password: pw });
    if (error) {
      toast(error.message || "삭제하지 못했습니다.", "error");
      return false;
    }
    await refresh();
    toast("댓글을 삭제했습니다.");
    return true;
  };

  const handleDelete = async (comment) => {
    const isMine = user && comment.user_id && String(comment.user_id) === String(user.id);
    if (isAdmin || isMine) {
      const ok = await confirmDialog({ title: "댓글을 삭제할까요?", confirmLabel: "삭제", danger: true });
      if (ok) await deleteComment(comment.id);
      return;
    }
    if (comment.user_id) {
      toast("회원 댓글은 쓴 사람만 지울 수 있습니다.", "error");
      return;
    }
    setDeleteTarget(comment);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeletePassword("");
  };

  const confirmGuestDelete = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    const ok = await deleteComment(deleteTarget.id, deletePassword);
    setDeleting(false);
    if (ok) closeDeleteModal();
  };

  const tree = organize(comments);

  return (
    <section aria-labelledby="comments-heading" className="border-t border-gray-200 pt-8 mt-8">
      {(!commentsClosed || comments.length > 0) && (
        <h2 id="comments-heading" className="text-base font-bold text-gray-900 mb-5 flex items-center">
          댓글
          <span className="ml-2 bg-[#355E3B] text-white text-xs px-2 py-0.5 rounded-full">{comments.length}</span>
        </h2>
      )}

      {comments.length > 0 && (
        <div className="space-y-3 mb-8">
          {tree.map((c) => (
            <CommentItem key={c.id} comment={c} depth={0} onReply={handleReply} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {commentsClosed ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600">구인구직 게시판은 댓글을 받지 않습니다.</p>
          <p className="text-xs text-gray-500 mt-1">문의는 본문의 연락처를 이용해 주세요.</p>
        </div>
      ) : (
        <>
          {loaded && comments.length === 0 && <p className="text-sm text-gray-500 mb-4">첫 댓글을 남겨 보세요.</p>}
          <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-3.5 md:p-4">
            {replyTo && (
              <div className="mb-3 pl-3 pr-1 py-1 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                <span className="text-sm text-blue-800">
                  <span className="font-bold">{replyTo.author}</span>님에게 답글
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setNewComment("");
                  }}
                  className="text-sm text-blue-700 hover:bg-blue-100 rounded px-3 min-h-9"
                >
                  취소
                </button>
              </div>
            )}
            <div className="flex gap-2 mb-3 flex-wrap items-center">
              <label className="sr-only" htmlFor="comment-author">닉네임</label>
              <input
                id="comment-author"
                type="text"
                placeholder="닉네임"
                value={author}
                onChange={(e) => !user && setAuthor(e.target.value)}
                readOnly={!!user}
                className={`flex-1 min-w-0 max-w-xs h-10 px-3 border border-gray-200 rounded-md text-base md:text-sm focus:outline-none focus:border-[#355E3B] ${user ? "bg-gray-100 text-gray-600" : "bg-white"}`}
              />
              {user ? (
                <span className="text-xs text-green-700 font-medium">✓ 회원</span>
              ) : (
                <>
                  <label className="sr-only" htmlFor="comment-password">비밀번호 (삭제할 때 필요)</label>
                  <input
                    id="comment-password"
                    type="password"
                    placeholder="비밀번호"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-32 h-10 px-3 border border-gray-200 rounded-md text-base md:text-sm focus:outline-none focus:border-[#355E3B]"
                  />
                </>
              )}
            </div>
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              placeholder={replyTo ? `${replyTo.author}님에게 답글 (@로 태그)` : "댓글을 남겨 보세요 (@로 태그 가능)"}
              className="w-full h-24 px-3 py-2 border border-gray-200 rounded-md text-base md:text-sm focus:outline-none focus:border-[#355E3B] resize-none mb-3"
              postId={postId}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">{user ? "" : "비회원 댓글은 비밀번호로 지울 수 있습니다."}</p>
              <button
                type="submit"
                disabled={submitting}
                className="shrink-0 bg-[#355E3B] text-white min-h-10 px-6 rounded-md text-sm font-bold transition hover:bg-[#2A4A2E] disabled:opacity-50"
              >
                {submitting ? "등록 중..." : replyTo ? "답글 등록" : "댓글 등록"}
              </button>
            </div>
          </form>
        </>
      )}

      <Modal open={!!deleteTarget} onClose={closeDeleteModal} title="댓글 삭제">
        <form onSubmit={confirmGuestDelete}>
          <p className="text-sm text-gray-600 mb-3">댓글을 쓸 때 입력한 비밀번호를 넣어 주세요.</p>
          <input
            type="password"
            placeholder="비밀번호"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            className="w-full h-11 px-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-[#355E3B]"
          />
          <ModalActions onCancel={closeDeleteModal} confirmLabel="삭제" danger busy={deleting} confirmType="submit" />
        </form>
      </Modal>
    </section>
  );
}
