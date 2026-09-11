"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { boardHref, boardName, backToListHref, readListPosition } from "@/lib/boards";
import { toast } from "@/lib/notify";

/**
 * 「목록으로」가 갈 주소. 보던 목록(페이지·검색어 포함)이 있으면 그리로, 없으면 이 글의 게시판.
 * sessionStorage 는 브라우저에만 있으므로 첫 그림은 게시판 주소로 그리고 곧바로 바꾼다.
 */
const noSubscribe = () => () => {};

function useBackHref(boardType) {
  // 서버·하이드레이션 땐 게시판 주소, 브라우저에선 보던 목록 주소 (문자열로 비교해 매 렌더 새 객체를 만들지 않는다)
  const snapshot = useSyncExternalStore(
    noSubscribe,
    () => {
      const href = backToListHref(boardType);
      const saved = readListPosition();
      // 보던 자리로 돌려놓을 수 있으면 Next 의 「이동하면 맨 위로」를 끈다(목록이 스스로 스크롤한다)
      const keepScroll = saved?.url === href && typeof saved.scrollY === "number";
      return `${keepScroll ? 1 : 0}${href}`;
    },
    () => `0${boardHref(boardType)}`
  );
  return { href: snapshot.slice(1), keepScroll: snapshot[0] === "1" };
}

async function sharePost(title) {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // 사용자가 공유 창을 닫음
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("링크를 복사했습니다.");
  } catch {
    toast("링크 복사가 막혀 있습니다. 주소창의 주소를 복사해 주세요.", "error");
  }
}

// 글 맨 위 — 어느 게시판 글인지, 한 번에 목록으로
export function PostTopBar({ post }) {
  const back = useBackHref(post.board_type);
  return (
    <nav aria-label="위치" className="flex items-center gap-2 mb-3 text-sm">
      <Link
        href={back.href}
        scroll={!back.keepScroll}
        className="inline-flex items-center gap-1 h-9 -ml-2 px-2 rounded-md text-gray-600 hover:text-[#355E3B] hover:bg-gray-50 font-medium"
      >
        <span aria-hidden="true" className="text-base leading-none">←</span>
        목록
      </Link>
      <span className="text-gray-300" aria-hidden="true">/</span>
      <Link href={boardHref(post.board_type)} className="font-bold text-[#355E3B] hover:underline underline-offset-2 py-2">
        {boardName(post.board_type)}
      </Link>
    </nav>
  );
}

function NeighborLink({ label, post }) {
  return (
    <div className="flex items-center gap-3 px-3 md:px-4 min-h-12 border-b border-gray-100 last:border-b-0">
      <span className="shrink-0 w-14 text-xs font-bold text-gray-500">{label}</span>
      {post ? (
        <Link href={`/post/${post.id}`} className="flex-1 min-w-0 truncate text-sm text-gray-800 hover:text-[#355E3B] hover:underline underline-offset-2 py-3">
          {post.title}
        </Link>
      ) : (
        <span className="flex-1 text-sm text-gray-400 py-3">{label === "다음글" ? "가장 최근 글입니다" : "첫 글입니다"}</span>
      )}
    </div>
  );
}

// 글 아래 — 목록으로 · 공유 · 다음글/이전글
export function PostBottomNav({ post, neighbors }) {
  const back = useBackHref(post.board_type);
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link
          href={back.href}
          scroll={!back.keepScroll}
          className="inline-flex items-center justify-center gap-1 min-h-11 px-5 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          <span aria-hidden="true">☰</span> 목록으로
        </Link>
        <button
          type="button"
          onClick={() => sharePost(post.title)}
          className="inline-flex items-center justify-center gap-1 min-h-11 px-4 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <span aria-hidden="true">🔗</span> 공유
        </button>
      </div>
      {neighbors && (
        <div className="border-y border-gray-200">
          <NeighborLink label="다음글" post={neighbors.newer} />
          <NeighborLink label="이전글" post={neighbors.older} />
        </div>
      )}
    </div>
  );
}
