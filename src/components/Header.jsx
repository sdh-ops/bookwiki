"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const boardCategories = [
  { name: "전체", id: "all" },
  { name: "HOT", id: "hot" },
  { name: "구인구직", id: "job" },
  { name: "지원사업", id: "support" },
  { name: "톡톡", id: "free" },
  { name: "베스트셀러", id: "bestseller", href: "/bestseller" },
  { name: "AI허브", id: "ai" },
];

export default function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
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
          console.log("Admin check error:", e);
        }
      }
    }
    checkUser();

    // Close mobile menu on path changes
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleBoardClick = (cat) => {
    if (cat.href) {
      router.push(cat.href);
      return;
    }
    if (cat.id === "all") {
      router.push("/");
    } else {
      router.push(`/?board=${cat.id}`);
    }
  };

  // Determine active states for styling
  const isBestsellerActive = pathname.startsWith("/bestseller");

  return (
    <header className="bg-[#355E3B] text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 md:space-x-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1 hover:bg-white/10 rounded transition"
            aria-label="메뉴 열기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          
          <Link 
            href="/?board=all" 
            className="text-2xl font-bold tracking-tighter"
            onClick={() => setMobileMenuOpen(false)}
          >
            북위키
          </Link>
          
          <nav className="hidden md:flex space-x-4 text-sm font-medium">
            {boardCategories.map((cat) => {
              const isActive = (cat.id === "bestseller" && isBestsellerActive);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleBoardClick(cat)}
                  className={`hover:underline ${isActive ? "font-bold underline text-white" : "text-white/90"}`}
                >
                  {cat.name}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {isAdmin && (
            <Link href="/admin" className="hidden md:block text-xs font-bold bg-red-500 px-3 py-1.5 rounded hover:bg-red-600 transition tracking-wide text-white">
              관리자
            </Link>
          )}
          
          {user ? (
            <div className="hidden md:flex items-center space-x-3">
              <span className="text-xs text-white/60 font-medium">{user.user_metadata?.nickname || user.email?.split('@')[0]}</span>
              <Link href="/mypage" className="text-xs text-white/80 hover:text-white transition">내 활동</Link>
              <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white transition">로그아웃</button>
            </div>
          ) : (
            <Link href="/login" className="hidden md:block text-sm font-bold border border-white/30 px-3 py-1.5 rounded hover:bg-white/10 transition text-white">
              로그인
            </Link>
          )}
          
          {user ? (
            <button
              onClick={handleLogout}
              className="md:hidden text-xs font-bold border border-white/30 px-2 py-1.5 rounded hover:bg-white/10 transition text-white"
            >
              로그아웃
            </button>
          ) : (
            <Link href="/login" className="md:hidden text-xs font-bold border border-white/30 px-2 py-1.5 rounded hover:bg-white/10 transition text-white">
              로그인
            </Link>
          )}

          {/* Global Create Button */}
          {!pathname.startsWith('/write') && !pathname.startsWith('/login') && (
            <Link href="/write" className="hover:bg-white/30 bg-white/20 transition px-3 py-1.5 rounded text-sm font-bold text-white shadow-sm flex items-center">
              <span className="hidden md:inline mr-1 text-xs">✏️</span> 글쓰기
            </Link>
          )}
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#2A4A2E] border-t border-[#355E3B]">
          <nav className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            {boardCategories.map((cat) => {
              const isActive = (cat.id === "bestseller" && isBestsellerActive);
              return (
                <button
                  key={cat.id}
                  onClick={() => { handleBoardClick(cat); setMobileMenuOpen(false); }}
                  className={`block w-full text-left px-3 py-2.5 text-sm rounded transition ${isActive ? "bg-[#355E3B] font-bold text-white shadow-inner" : "text-white/90 hover:bg-[#355E3B]/50"}`}
                >
                  {cat.name}
                </button>
              );
            })}
            
            <div className="border-t border-[#355E3B] pt-3 mt-3 space-y-1">
              {user ? (
                <>
                  <Link href="/mypage" className="block px-3 py-2.5 text-sm text-white/90 hover:bg-[#355E3B]/50 rounded transition">
                    내 활동
                  </Link>
                  <button onClick={handleLogout} className="block w-full text-left px-3 py-2.5 text-sm text-white/90 hover:bg-[#355E3B]/50 rounded transition">
                    로그아웃
                  </button>
                </>
              ) : (
                <Link href="/login" className="block px-3 py-2.5 text-sm text-white/90 font-bold hover:bg-[#355E3B]/50 rounded transition">
                  로그인 / 회원가입
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="block px-3 py-2.5 text-sm font-bold text-red-300 hover:bg-[#355E3B]/50 rounded transition">
                  관리자 대시보드
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
