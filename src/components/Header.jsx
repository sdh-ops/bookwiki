"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NAV_TABS, subscribeActiveBoard, getAnnouncedBoard } from "@/lib/boards";

// 글쓰기 버튼이 지금 보는 게시판을 미리 골라 두는 게시판 (비회원·자동수집 게시판은 제외)
const WRITABLE_BOARDS = new Set(["job", "free"]);

/**
 * 지금 보고 있는 탭.
 * 목록은 주소의 board, 베스트셀러는 경로, 글 상세는 그 글이 알려 준 게시판(ACTIVE_BOARD_EVENT).
 */
function useActiveTab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // { path, board } — 알려 준 화면의 경로를 같이 들고 있어, 다른 글로 옮기면 저절로 무효가 된다
  const pageBoard = useSyncExternalStore(subscribeActiveBoard, getAnnouncedBoard, () => null);

  if (pathname === "/") return searchParams.get("board") || "all";
  if (pathname.startsWith("/bestseller")) return "bestseller";
  if (pageBoard?.path === pathname) return pageBoard.board;
  return null;
}

function DesktopTabs({ active }) {
  return (
    <nav aria-label="게시판" className="hidden md:flex items-center gap-1 text-sm font-medium">
      {NAV_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`px-2.5 py-1.5 rounded-md transition ${
              isActive ? "bg-white/15 text-white font-bold" : "text-white/85 hover:text-white hover:bg-white/10"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}

// 모바일: 게시판을 햄버거 안에 숨기지 않고 헤더 아래 가로 줄로 항상 보여준다
function MobileTabs({ active }) {
  const stripRef = useRef(null);
  const activeRef = useRef(null);

  // 선택된 탭을 가로 줄 가운데로. scrollIntoView 는 페이지까지 위로 끌어올리므로 쓰지 않는다.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = activeRef.current;
    if (!strip || !tab) return;
    strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2;
  }, [active]);

  return (
    <nav aria-label="게시판" className="md:hidden border-t border-white/10">
      <div ref={stripRef} className="relative flex overflow-x-auto scrollbar-hide px-2">
        {NAV_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              ref={isActive ? activeRef : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`relative shrink-0 px-3 h-11 flex items-center text-sm transition ${
                isActive ? "text-white font-bold" : "text-white/75"
              }`}
            >
              {tab.name}
              {isActive && <span className="absolute left-3 right-3 bottom-0 h-[3px] rounded-t bg-white" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function WriteButton({ active }) {
  const href = WRITABLE_BOARDS.has(active) ? `/write?board=${active}` : "/write";
  return (
    <Link
      href={href}
      className="bg-white/20 hover:bg-white/30 transition px-3 h-9 rounded-md text-sm font-bold text-white shadow-sm flex items-center gap-1"
    >
      <span aria-hidden="true" className="text-xs">✏️</span>
      글쓰기
    </Link>
  );
}

// 모바일 계정 메뉴 — 바깥을 누르거나 Esc 를 누르면 닫힌다
function MobileAccountMenu({ user, isAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nickname = user.user_metadata?.nickname || user.email?.split("@")[0];

  return (
    <div ref={wrapRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "내 메뉴 닫기" : "내 메뉴 열기"}
        className="h-9 max-w-[7.5rem] px-2.5 rounded-md border border-white/30 text-xs font-bold text-white flex items-center gap-1"
      >
        <span className="truncate">{nickname}</span>
        <span aria-hidden="true" className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        // 메뉴 안의 항목을 누르면(페이지 이동·로그아웃) 닫는다
        <div role="menu" onClick={() => setOpen(false)} className="absolute right-0 top-11 z-50 w-44 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 text-sm">
          <Link role="menuitem" href="/mypage" className="block px-4 py-3 text-gray-700 hover:bg-gray-50">
            내 활동
          </Link>
          {isAdmin && (
            <Link role="menuitem" href="/admin" className="block px-4 py-3 font-bold text-red-600 hover:bg-gray-50">
              관리자
            </Link>
          )}
          <button role="menuitem" type="button" onClick={onLogout} className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 border-t border-gray-100">
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderInner({ active }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(user);
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data: adminData, error } = await supabase
        .from("bw_admins")
        .select("email")
        .eq("email", user.email)
        .maybeSingle();
      if (error) console.error("[Header] admin check:", error.message);
      if (!cancelled) setIsAdmin(!!adminData);
    }
    checkUser();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const showWrite = !pathname.startsWith("/write") && !pathname.startsWith("/login");

  return (
    <header className="bg-[#355E3B] text-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="text-2xl font-bold tracking-tighter shrink-0">
            북위키
          </Link>
          <DesktopTabs active={active} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <Link href="/admin" className="hidden md:inline-flex items-center h-8 text-xs font-bold bg-red-500 px-3 rounded hover:bg-red-600 transition tracking-wide text-white">
              관리자
            </Link>
          )}

          {user ? (
            <>
              <div className="hidden md:flex items-center gap-3">
                <span className="text-xs text-white/70 font-medium">{user.user_metadata?.nickname || user.email?.split("@")[0]}</span>
                <Link href="/mypage" className="text-xs text-white/85 hover:text-white transition py-2">
                  내 활동
                </Link>
                <button type="button" onClick={handleLogout} className="text-xs text-white/75 hover:text-white transition py-2">
                  로그아웃
                </button>
              </div>
              <MobileAccountMenu user={user} isAdmin={isAdmin} onLogout={handleLogout} />
            </>
          ) : (
            <Link href="/login" className="inline-flex items-center h-9 text-sm font-bold border border-white/30 px-3 rounded-md hover:bg-white/10 transition text-white">
              로그인
            </Link>
          )}

          {showWrite && <WriteButton active={active} />}
        </div>
      </div>
      <MobileTabs active={active} />
    </header>
  );
}

function HeaderWithActiveTab() {
  return <HeaderInner active={useActiveTab()} />;
}

// useSearchParams 를 쓰므로 Suspense 로 감싼다(정적 페이지 빌드가 통째로 클라이언트 렌더로 떨어지지 않게).
// 대기 화면도 같은 헤더를 그린다 — 빈 초록 띠만 보이다 탭이 튀어나오지 않게(현재 탭 표시만 잠깐 늦다).
export default function Header() {
  return (
    <Suspense fallback={<HeaderInner active={null} />}>
      <HeaderWithActiveTab />
    </Suspense>
  );
}
