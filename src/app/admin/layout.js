"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function checkAdmin() {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const { data } = await supabase
                .from("bw_admins")
                .select("email")
                .eq("email", user.email)
                .single();

            if (!data) {
                alert("운영자 권한이 없습니다.");
                router.push("/");
            } else {
                setIsAdmin(true);
            }
            setLoading(false);
        }
        checkAdmin();
    }, [router]);

    if (loading) return <div className="p-10 text-center text-sm text-gray-400">보안 확인 중...</div>;
    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden bg-[#2c3e50] text-white p-4 flex justify-between items-center">
                <h1 className="text-lg font-bold tracking-tighter">운영자 센터</h1>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-2 hover:bg-[#34495e] rounded"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {menuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden bg-[#2c3e50] text-white border-t border-[#34495e]">
                    <nav className="p-4 space-y-2">
                        <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">대시보드</Link>
                        <Link href="/admin/posts" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">게시물 관리</Link>
                        <Link href="/admin/deleted-posts" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">삭제된 게시물</Link>
                        <Link href="/admin/users" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">운영자 관리</Link>
                        <div className="pt-4 border-t border-[#34495e] mt-4">
                            <Link href="/" className="block px-4 py-2 text-sm text-gray-400 hover:text-white transition">메인으로 가기</Link>
                        </div>
                    </nav>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-[#2c3e50] text-white flex-col">
                <div className="p-6 border-b border-[#34495e]">
                    <h1 className="text-xl font-bold tracking-tighter">운영자 센터</h1>
                    <p className="text-[10px] text-gray-400 mt-1">북위키 관리 도구</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin" className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">대시보드</Link>
                    <Link href="/admin/posts" className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">게시물 관리</Link>
                    <Link href="/admin/deleted-posts" className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">삭제된 게시물</Link>
                    <Link href="/admin/users" className="block px-4 py-2 text-sm rounded hover:bg-[#34495e] transition">운영자 관리</Link>
                    <div className="pt-4 border-t border-[#34495e] mt-4">
                        <Link href="/" className="block px-4 py-2 text-sm text-gray-400 hover:text-white transition">메인으로 가기</Link>
                    </div>
                </nav>
                <div className="p-6 text-[10px] text-gray-500">
                    v1.0.0
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 p-4 md:p-10 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
