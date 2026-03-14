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
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 md:mb-8">운영자 관리</h2>

            {/* Add Admin Form */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-100 mb-6 md:mb-10">
                <h3 className="text-sm font-bold text-gray-700 mb-4">운영자 추가</h3>
                <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-2">
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
                <div className="px-4 md:px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-700">운영자 목록</h3>
                </div>
                {loading ? (
                    <div className="p-10 text-center text-xs text-gray-400">로딩 중...</div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="sm:hidden divide-y divide-gray-100">
                            {admins.map((admin) => (
                                <div key={admin.email} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-800 font-medium break-all">{admin.email}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{new Date(admin.created_at).toLocaleDateString()}</p>
                                        </div>
                                        {admin.email !== 'sdh@thenanbiz.com' && (
                                            <button
                                                onClick={() => handleRemoveAdmin(admin.email)}
                                                className="text-xs text-red-500 hover:underline ml-2"
                                            >
                                                삭제
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <table className="hidden sm:table w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr>
                                    <th className="px-4 md:px-6 py-3">이메일</th>
                                    <th className="px-4 md:px-6 py-3 hidden md:table-cell">등록일시</th>
                                    <th className="px-4 md:px-6 py-3 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {admins.map((admin) => (
                                    <tr key={admin.email} className="hover:bg-gray-50">
                                        <td className="px-4 md:px-6 py-4 text-gray-800 font-medium">{admin.email}</td>
                                        <td className="px-4 md:px-6 py-4 text-gray-400 hidden md:table-cell">{new Date(admin.created_at).toLocaleString()}</td>
                                        <td className="px-4 md:px-6 py-4 text-right">
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
                    </>
                )}
            </div>
        </div>
    );
}
