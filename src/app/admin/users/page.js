"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminUsersPage() {
    const [admins, setAdmins] = useState([]);
    const [newEmail, setNewEmail] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdmins();
    }, []);

    async function fetchAdmins() {
        setLoading(true);
        const { data } = await supabase
            .from("bw_admins")
            .select("*")
            .order("created_at", { ascending: false });
        setAdmins(data || []);
        setLoading(false);
    }

    async function handleAddAdmin(e) {
        e.preventDefault();
        if (!newEmail) return;

        const { error } = await supabase
            .from("bw_admins")
            .insert([{ email: newEmail.trim() }]);

        if (error) {
            alert("이미 추가되었거나 에러가 발생했습니다: " + error.message);
        } else {
            setNewEmail("");
            fetchAdmins();
        }
    }

    async function handleRemoveAdmin(email) {
        if (email === 'sdh@thenanbiz.com') {
            alert("메인 관리자는 삭제할 수 없습니다.");
            return;
        }

        if (confirm("운영자 권한을 삭제하시겠습니까?")) {
            const { error } = await supabase
                .from("bw_admins")
                .delete()
                .eq("email", email);

            if (error) alert("삭제 실패: " + error.message);
            else fetchAdmins();
        }
    }

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-8">운영자 관리</h2>

            {/* Add Admin Form */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-10 max-w-md">
                <h3 className="text-sm font-bold text-gray-700 mb-4">운영자 추가</h3>
                <form onSubmit={handleAddAdmin} className="flex space-x-2">
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="이메일 주소 입력"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                        required
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-[#355E3B] text-white rounded text-sm font-bold hover:bg-[#3a5a7a]"
                    >
                        추가
                    </button>
                </form>
            </div>

            {/* Admin List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-700">운영자 목록</h3>
                </div>
                {loading ? (
                    <div className="p-10 text-center text-xs text-gray-400">로딩 중...</div>
                ) : (
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 font-bold">
                            <tr>
                                <th className="px-6 py-3">이메일</th>
                                <th className="px-6 py-3">등록일시</th>
                                <th className="px-6 py-3 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {admins.map((admin) => (
                                <tr key={admin.email} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-800 font-medium">{admin.email}</td>
                                    <td className="px-6 py-4 text-gray-400">{new Date(admin.created_at).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        {admin.email !== 'sdh@thenanbiz.com' && (
                                            <button
                                                onClick={() => handleRemoveAdmin(admin.email)}
                                                className="text-red-500 hover:underline"
                                            >
                                                삭제
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
