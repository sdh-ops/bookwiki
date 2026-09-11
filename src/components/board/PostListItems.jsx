"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { boardName, rememberListPosition } from "@/lib/boards";
import { kstShortDateLabel } from "@/lib/date";

export function MemberBadge({ className = "" }) {
  return (
    <span
      className={`ml-0.5 text-green-500 font-bold ${className}`}
      style={{
        textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)",
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.2))",
      }}
      title="회원"
      aria-label="회원"
    >
      ✓
    </span>
  );
}

function HotTag({ mobile = false }) {
  return (
    <span className={`bg-red-500 text-white rounded-sm font-bold ${mobile ? "text-[11px] px-1.5 py-0.5" : "text-[10px] px-1.5 py-0.5 mr-1.5"}`}>
      HOT
    </span>
  );
}

const ROW_TONES = {
  notice: { row: "bg-blue-50 hover:bg-blue-100", label: "공지", labelClass: "text-blue-600 font-bold", title: "font-bold text-gray-900" },
  pinned: { row: "bg-green-50 hover:bg-green-100", label: "직접", labelClass: "text-green-600 font-bold", title: "font-medium text-gray-800" },
  normal: { row: "hover:bg-gray-50", label: null, labelClass: "text-gray-400", title: "font-medium text-gray-800" },
};

/**
 * PC 목록 한 줄.
 * 제목은 진짜 링크(<a>)라 새 탭(Ctrl·휠 클릭)·키보드 이동·검색엔진 수집이 된다.
 * 줄의 빈 곳을 눌러도 열리도록 행 클릭은 보조로 남기되, 링크를 누른 경우엔 링크에 맡긴다.
 */
export function PostRow({ post, tone = "normal", number }) {
  const router = useRouter();
  const href = `/post/${post.id}`;
  const t = ROW_TONES[tone];

  const onRowClick = (e) => {
    if (e.target.closest("a")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    rememberListPosition();
    router.push(href);
  };

  return (
    <tr className={`${t.row} cursor-pointer`} onClick={onRowClick}>
      <td className={`px-2 py-2.5 text-xs ${t.labelClass}`}>{t.label ?? number}</td>
      <td className={`px-2 py-2.5 ${t.title}`}>
        {post.is_hot && tone !== "notice" && <HotTag />}
        <span className="text-[#355E3B] mr-2 text-[11px] font-bold">[{boardName(post.board_type)}]</span>
        <Link href={href} onClick={rememberListPosition} className="hover:underline underline-offset-2">
          {post.title}
        </Link>
        {post.comment_count > 0 && (
          <span className="text-red-500 ml-1 text-[11px] font-bold" aria-label={`댓글 ${post.comment_count}개`}>
            [{post.comment_count}]
          </span>
        )}
      </td>
      <td className="px-2 py-2.5 text-xs text-gray-600 truncate max-w-[80px]">
        {post.author}
        {post.user_id && <MemberBadge />}
      </td>
      <td className="px-2 py-2.5 text-xs text-gray-500 text-center whitespace-nowrap">{kstShortDateLabel(post.created_at)}</td>
      <td className="px-2 py-2.5 text-xs text-gray-500 text-center">{post.view_count}</td>
    </tr>
  );
}

const CARD_TONES = {
  notice: "bg-blue-50 border-blue-100",
  pinned: "bg-green-50 border-green-100",
  normal: "bg-white border-gray-100 active:bg-gray-50",
};

// 모바일 목록 카드 — 카드 전체가 하나의 링크
export function PostCard({ post, tone = "normal" }) {
  return (
    <Link
      href={`/post/${post.id}`}
      onClick={rememberListPosition}
      className={`block border rounded-lg p-3.5 ${CARD_TONES[tone]}`}
    >
      {(tone !== "normal" || post.is_hot) && (
        <div className="flex items-center gap-1.5 mb-1.5">
          {tone === "notice" && <span className="text-[11px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">공지</span>}
          {tone === "pinned" && <span className="text-[11px] bg-green-600 text-white px-1.5 py-0.5 rounded font-bold">직접</span>}
          {post.is_hot && tone !== "notice" && <HotTag mobile />}
        </div>
      )}
      <h3 className={`text-[15px] leading-snug mb-2 line-clamp-2 ${tone === "notice" ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
        <span className="text-xs text-[#355E3B] font-bold mr-1">[{boardName(post.board_type)}]</span>
        {post.title}
        {post.comment_count > 0 && <span className="text-red-500 ml-1 text-xs font-bold">[{post.comment_count}]</span>}
      </h3>
      <div className="flex items-center text-xs text-gray-500 gap-1.5 min-w-0">
        <span className="truncate">
          {post.author}
          {post.user_id && <MemberBadge />}
        </span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">{kstShortDateLabel(post.created_at)}</span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">조회 {post.view_count}</span>
      </div>
    </Link>
  );
}
