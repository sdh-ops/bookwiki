"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { POST_COLUMNS } from "@/lib/columns";
import { BOARD_NAMES, boardHref, announceActiveBoard } from "@/lib/boards";
import { kstDateTimeLabel } from "@/lib/date";
import { toast, confirmDialog } from "@/lib/notify";
import Banner from "@/components/Banner";
import SiteFooter from "@/components/SiteFooter";
import Modal, { ModalActions } from "@/components/Modal";
import { MemberBadge } from "@/components/board/PostListItems";
import PostBody from "@/components/post/PostBody";
import CommentSection from "@/components/post/CommentSection";
import { PostTopBar, PostBottomNav } from "@/components/post/PostNav";

function useViewer() {
  const [user, setUser] = useState(undefined); // undefined = 확인 전
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(user || null);
      if (!user) return;
      const { data, error } = await supabase.from("bw_admins").select("email").eq("email", user.email).maybeSingle();
      if (error) console.error("[post] admin check:", error.message);
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isAdmin };
}

function NotFound() {
  return (
    <main className="min-h-[60vh] max-w-xl mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4" aria-hidden="true">📭</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2">글을 찾을 수 없습니다</h1>
      <p className="text-sm text-gray-600 mb-8">삭제됐거나 주소가 잘못됐을 수 있습니다.</p>
      <div className="flex justify-center gap-2">
        <Link href="/" className="inline-flex items-center min-h-11 px-5 rounded-lg bg-[#355E3B] text-white text-sm font-bold">
          전체 글 보기
        </Link>
        <Link href="/?board=job" className="inline-flex items-center min-h-11 px-5 rounded-lg border border-gray-300 text-sm font-bold text-gray-700">
          구인구직
        </Link>
      </div>
    </main>
  );
}

// 관리 버튼 — 작은 글씨지만 누르는 칸은 넉넉하게
const ACTION_BTN = "px-2.5 min-h-9 rounded-md hover:bg-gray-100 transition";

function ManageBar({ post, user, isAdmin, onEdit, onDelete, onToggleHot, onToggleDirect, onMove }) {
  const isOwner = user && post.user_id === user.id;
  const canManage = isAdmin || !post.user_id || isOwner;
  if (!canManage) return null;
  const canEdit = !isAdmin || isOwner; // 관리자는 남의 글을 고치지 않는다(이동·삭제만)

  return (
    <div className="flex flex-wrap items-center justify-end -mr-2 text-xs font-bold text-gray-500">
      {canEdit && (
        <button type="button" onClick={onEdit} className={`${ACTION_BTN} hover:text-gray-900`}>
          수정
        </button>
      )}
      {isAdmin && (
        <>
          <button type="button" onClick={onToggleHot} className={`${ACTION_BTN} text-red-500`}>
            {post.is_hot ? "🔥HOT해제" : "♨️HOT지정"}
          </button>
          <button type="button" onClick={onToggleDirect} className={`${ACTION_BTN} text-green-700`}>
            {post.is_auto ? "✏️직접지정" : "🔄자동전환"}
          </button>
          <button type="button" onClick={onMove} className={`${ACTION_BTN} text-blue-600`}>
            이동
          </button>
        </>
      )}
      <button type="button" onClick={onDelete} className={`${ACTION_BTN} hover:text-red-600`}>
        삭제
      </button>
    </div>
  );
}

export default function PostDetailClient({ id, initialPost, initialNeighbors }) {
  const router = useRouter();
  const { user, isAdmin } = useViewer();
  // 서버가 그려 보낸 글이면 조회수는 이번 방문을 더한 값으로 보여 준다(바로 아래에서 +1 한다)
  const [post, setPost] = useState(() => (initialPost ? { ...initialPost, view_count: (initialPost.view_count || 0) + 1 } : null));
  const [status, setStatus] = useState(initialPost ? "ready" : "loading");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetBoard, setTargetBoard] = useState("");
  const [moving, setMoving] = useState(false);

  // 조회수 +1 (방문마다). 공개 조회로 안 보인 글은 로그인 세션으로 다시 읽는다.
  // router.refresh() 가 initialPost 를 새 객체로 다시 내려줘도 한 번만 돌도록 첫 값만 본다.
  const [serverRendered] = useState(() => !!initialPost);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!serverRendered) {
        const { data, error } = await supabase.from("bw_posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          if (error && error.code !== "22P02") console.error("[post] load:", error.message);
          setStatus("missing");
          return;
        }
        setPost({ ...data, view_count: (data.view_count || 0) + 1 });
        setStatus("ready");
      }
      const { error: viewError } = await supabase.rpc("increment_view_count", { post_id: id });
      if (viewError) console.error("[post] view count:", viewError.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, serverRendered]);

  // 헤더 탭에 「지금 이 게시판」 표시
  useEffect(() => {
    if (post?.board_type) announceActiveBoard(post.board_type);
  }, [post?.board_type]);

  if (status === "missing") return <NotFound />;
  if (!post) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8" aria-busy="true">
        <div className="h-5 w-24 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="h-8 w-3/4 bg-gray-100 rounded mb-8 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  const executeDelete = async (password = null) => {
    const { error } = await supabase.rpc("soft_delete_post", { p_post_id: id, p_password: password });
    if (error) {
      toast(error.message || "삭제하지 못했습니다.", "error");
      return false;
    }
    toast("글을 삭제했습니다.");
    router.push(boardHref(post.board_type));
    return true;
  };

  const handleEdit = () => {
    if (isAdmin && post.user_id !== user?.id) {
      toast("관리자는 다른 사람의 글을 고칠 수 없습니다.", "error");
      return;
    }
    if (post.user_id && post.user_id !== user?.id) {
      toast("쓴 사람만 고칠 수 있습니다.", "error");
      return;
    }
    // 비회원 글은 수정 화면에서 비밀번호를 받아 저장할 때 서버가 확인한다.
    // (예전엔 여기서 브라우저에 없는 비밀번호와 비교해 늘 「틀렸습니다」가 떴다.)
    router.push(`/post/${id}/edit`);
  };

  const handleDelete = async () => {
    const isOwner = user && post.user_id === user.id;
    if (isOwner || isAdmin) {
      const ok = await confirmDialog({
        title: "이 글을 삭제할까요?",
        message: isAdmin && !isOwner ? "관리자 휴지통에서 되살릴 수 있습니다." : "",
        confirmLabel: "삭제",
        danger: true,
      });
      if (ok) await executeDelete();
      return;
    }
    if (post.user_id) {
      toast("쓴 사람만 지울 수 있습니다.", "error");
      return;
    }
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletePassword("");
  };

  const confirmGuestDelete = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    const ok = await executeDelete(deletePassword);
    setDeleting(false);
    if (ok) closeDeleteModal();
  };

  const updateFlag = async (patch, confirmTitle, doneMessage) => {
    if (!isAdmin) return;
    if (!(await confirmDialog({ title: confirmTitle }))) return;
    const { error } = await supabase.from("bw_posts").update(patch).eq("id", id);
    if (error) {
      toast(`바꾸지 못했습니다: ${error.message}`, "error");
      return;
    }
    setPost((prev) => ({ ...prev, ...patch }));
    toast(doneMessage);
  };

  const handleToggleHot = () => {
    const next = !post.is_hot;
    // 해제할 땐 오버라이드를 켜서 20분 크론이 다시 HOT 으로 올리지 않게 한다
    updateFlag(
      { is_hot: next, admin_hot_override: !next },
      `HOT 게시판에 ${next ? "지정" : "해제"}할까요?`,
      `HOT 게시판에서 ${next ? "지정" : "해제"}했습니다.`
    );
  };

  const handleToggleDirect = () => {
    const nextAuto = !post.is_auto;
    const label = nextAuto ? "자동" : "직접";
    updateFlag({ is_auto: nextAuto }, `'${label}' 글로 바꿀까요?`, `'${label}' 글로 바꿨습니다.`);
  };

  const openMove = () => {
    setTargetBoard(post.board_type);
    setShowMoveModal(true);
  };

  const handleMovePost = async () => {
    if (!targetBoard || targetBoard === post.board_type) {
      setShowMoveModal(false);
      return;
    }
    setMoving(true);
    const { error } = await supabase.from("bw_posts").update({ board_type: targetBoard }).eq("id", id);
    setMoving(false);
    if (error) {
      toast(`게시판을 옮기지 못했습니다: ${error.message}`, "error");
      return;
    }
    setPost((prev) => ({ ...prev, board_type: targetBoard }));
    setShowMoveModal(false);
    toast(`[${BOARD_NAMES[targetBoard]}] 게시판으로 옮겼습니다.`);
    router.refresh(); // 다음글·이전글을 새 게시판 기준으로
  };

  return (
    <>
      <main className="bg-white">
        <article className="max-w-4xl mx-auto px-4 pt-4 pb-8 md:pt-6">
          <PostTopBar post={post} />

          {post.is_deleted && (
            <p className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              삭제된 글입니다. 관리자에게만 보입니다.
            </p>
          )}

          <header className="border-b-2 border-gray-200 pb-4 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug break-words mb-3">{post.title}</h1>
            <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                <span className="font-bold text-gray-800">
                  {post.author}
                  {post.user_id && <MemberBadge className="text-xs" />}
                </span>
                <time dateTime={post.created_at} className="text-xs text-gray-500">
                  {kstDateTimeLabel(post.created_at)}
                </time>
                <span className="text-xs text-gray-500">조회 {post.view_count || 0}</span>
              </div>
              {user !== undefined && (
                <ManageBar
                  post={post}
                  user={user}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleHot={handleToggleHot}
                  onToggleDirect={handleToggleDirect}
                  onMove={openMove}
                />
              )}
            </div>
          </header>

          <PostBody post={post} postId={id} user={user || null} />

          {/* 본문과 댓글 사이 — 체류가 가장 긴 자리 */}
          <Banner placement="post_bottom" />

          <PostBottomNav post={post} neighbors={initialNeighbors} />

          <CommentSection postId={id} boardType={post.board_type} user={user || null} isAdmin={isAdmin} />
        </article>
      </main>

      <Modal open={showDeleteModal} onClose={closeDeleteModal} title="글 삭제">
        <form onSubmit={confirmGuestDelete}>
          <p className="text-sm text-gray-600 mb-3">글을 쓸 때 입력한 비밀번호를 넣어 주세요.</p>
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

      <Modal open={showMoveModal} onClose={() => setShowMoveModal(false)} title="게시판 이동">
        <div className="space-y-2" role="radiogroup" aria-label="옮길 게시판">
          {Object.entries(BOARD_NAMES).map(([boardId, name]) => (
            <button
              key={boardId}
              type="button"
              role="radio"
              aria-checked={targetBoard === boardId}
              onClick={() => setTargetBoard(boardId)}
              className={`w-full text-left px-4 min-h-11 text-sm rounded-lg border ${
                targetBoard === boardId ? "bg-[#355E3B] text-white border-[#355E3B] font-bold" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <ModalActions onCancel={() => setShowMoveModal(false)} onConfirm={handleMovePost} confirmLabel="이동하기" busy={moving} />
      </Modal>

      <SiteFooter narrow />
    </>
  );
}
