"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminMembersPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState({ key: 'joinDate', direction: 'desc' });
    const [editingId, setEditingId] = useState(null);
    const [newNickname, setNewNickname] = useState("");

    useEffect(() => {
        fetchMembers();
    }, []);

    async function fetchMembers() {
        setLoading(true);
        try {
            // 1. Fetch Profiles (Members)
            const { data: profiles, error: pError } = await supabase
                .from("profiles")
                .select("id, nickname, created_at, updated_at");
            
            if (pError) throw pError;

            // 2. Fetch Admins
            const { data: admins, error: aError } = await supabase
                .from("bw_admins")
                .select("email");
            
            if (aError) throw aError;
            const adminEmails = new Set(admins.map(a => a.email));

            // 3. Fetch User Emails from auth (Note: We might not have direct access to auth.users in client, 
            // but we can assume email is in profiles or bw_usernames if they exist)
            // Let's check bw_usernames as it seems to map email to id
            const { data: usernames } = await supabase.from("bw_usernames").select("id, email");
            const emailMap = {};
            usernames?.forEach(u => emailMap[u.id] = u.email);

            // 4. Fetch Post Counts
            const { data: posts } = await supabase
                .from("bw_posts")
                .select("user_id, author");
            
            // 5. Fetch Comment Counts
            const { data: comments } = await supabase
                .from("bw_comments")
                .select("user_id, author");

            // Aggregate Counts
            const postCountMap = {};
            const commentCountMap = {};
            const lastActivityMap = {};
            const firstActivityMap = {};

            // Helper to update activity maps
            const updateActivity = (id, date) => {
                if (!date) return;
                const d = new Date(date).getTime();
                if (!lastActivityMap[id] || d > lastActivityMap[id]) lastActivityMap[id] = d;
                if (!firstActivityMap[id] || d < firstActivityMap[id]) firstActivityMap[id] = d;
            };

            // Process Posts
            posts?.forEach(p => {
                const key = p.user_id || `guest_${p.author}`;
                postCountMap[key] = (postCountMap[key] || 0) + 1;
                // Since we can't easily get post date here without fetching it, 
                // we'll fetch counts separately or just skip activity date for now if it's too much data.
                // Actually, let's fetch counts with dates if possible. 
            });

            // Re-fetch for counts and dates to be more accurate
            const { data: postData } = await supabase.from("bw_posts").select("user_id, author, created_at");
            postData?.forEach(p => {
                const key = p.user_id || `guest_${p.author}`;
                postCountMap[key] = (postCountMap[key] || 0) + 1;
                updateActivity(key, p.created_at);
            });

            const { data: commentData } = await supabase.from("bw_comments").select("user_id, author, created_at");
            commentData?.forEach(c => {
                const key = c.user_id || `guest_${c.author}`;
                commentCountMap[key] = (commentCountMap[key] || 0) + 1;
                updateActivity(key, c.created_at);
            });

            // Combine Data
            const memberList = [];

            // Add registered users
            profiles.forEach(p => {
                const email = emailMap[p.id] || "알 수 없음";
                if (adminEmails.has(email)) return; // Skip admins

                memberList.push({
                    id: p.id,
                    email: email,
                    nickname: p.nickname || "N/A",
                    role: "회원",
                    joinDate: p.created_at,
                    postCount: postCountMap[p.id] || 0,
                    commentCount: commentCountMap[p.id] || 0,
                    lastVisit: lastActivityMap[p.id] ? new Date(lastActivityMap[p.id]).toISOString() : null,
                    isGuest: false
                });
            });

            // Add unique guests
            const guestKeys = new Set([
                ...Object.keys(postCountMap).filter(k => k.startsWith("guest_")),
                ...Object.keys(commentCountMap).filter(k => k.startsWith("guest_"))
            ]);

            guestKeys.forEach(gk => {
                const nickname = gk.replace("guest_", "");
                memberList.push({
                    id: gk,
                    email: "비회원",
                    nickname: nickname,
                    role: "비회원",
                    joinDate: firstActivityMap[gk] ? new Date(firstActivityMap[gk]).toISOString() : null,
                    postCount: postCountMap[gk] || 0,
                    commentCount: commentCountMap[gk] || 0,
                    lastVisit: lastActivityMap[gk] ? new Date(lastActivityMap[gk]).toISOString() : null,
                    isGuest: true
                });
            });

            setMembers(memberList);
        } catch (err) {
            console.error("Error fetching members:", err);
        } finally {
            setLoading(false);
        }
    }

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedMembers = useMemo(() => {
        let items = [...members];
        
        // Filter
        if (roleFilter !== "all") {
            items = items.filter(m => m.role === roleFilter);
        }
        if (searchTerm) {
            items = items.filter(m => 
                m.nickname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                m.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort
        items.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === null) return 1;
            if (bValue === null) return -1;

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return items;
    }, [members, sortConfig, roleFilter, searchTerm]);

    const handleEditNickname = async (member) => {
        if (member.isGuest) {
            alert("비회원 닉네임은 수정할 수 없습니다.");
            return;
        }
        setEditingId(member.id);
        setNewNickname(member.nickname);
    };

    const saveNickname = async (id) => {
        if (!newNickname.trim()) return;

        const { error } = await supabase
            .from("profiles")
            .update({ nickname: newNickname.trim() })
            .eq("id", id);

        if (error) {
            alert("수정 실패: " + error.message);
        } else {
            setEditingId(null);
            fetchMembers();
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <header className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800">회원 관리</h2>
                <p className="text-sm text-gray-500 mt-1">회원 목록 및 활동 현황을 관리합니다.</p>
            </header>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="이메일 또는 닉네임 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#355E3B]"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none"
                >
                    <option value="all">전체 구분</option>
                    <option value="회원">회원</option>
                    <option value="비회원">비회원</option>
                </select>
                <button 
                  onClick={fetchMembers}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition-colors"
                >
                  새로고침
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                            <tr>
                                <th onClick={() => handleSort('email')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">아이디 (이메일)</th>
                                <th onClick={() => handleSort('nickname')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">닉네임</th>
                                <th onClick={() => handleSort('role')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">구분</th>
                                <th onClick={() => handleSort('joinDate')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">가입/첫활동</th>
                                <th onClick={() => handleSort('postCount')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors text-center">게시글</th>
                                <th onClick={() => handleSort('commentCount')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors text-center">댓글</th>
                                <th onClick={() => handleSort('lastVisit')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">최근활동</th>
                                <th className="px-6 py-4 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-20 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                                </tr>
                            ) : sortedMembers.length > 0 ? (
                                sortedMembers.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-gray-700">{m.email}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {editingId === m.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={newNickname}
                                                        onChange={(e) => setNewNickname(e.target.value)}
                                                        className="px-2 py-1 border border-[#355E3B] rounded text-xs w-24"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => saveNickname(m.id)} className="text-blue-600 font-bold text-xs">저장</button>
                                                    <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">취소</button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600">{m.nickname}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                m.role === '관리자' ? 'bg-red-100 text-red-600' : 
                                                m.role === '회원' ? 'bg-blue-100 text-blue-600' : 
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {m.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 tabular-nums">
                                            {m.joinDate ? new Date(m.joinDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-gray-700">
                                            {m.postCount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-gray-700">
                                            {m.commentCount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 tabular-nums">
                                            {m.lastVisit ? new Date(m.lastVisit).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!m.isGuest && (
                                                <button 
                                                    onClick={() => handleEditNickname(m)}
                                                    className="text-[#355E3B] hover:underline font-bold text-xs"
                                                >
                                                    닉네임 수정
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-20 text-center text-gray-400">내역이 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
