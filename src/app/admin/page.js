"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalPosts: 0,
        todayPosts: 0,
        totalComments: 0,
        recentPosts: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Total Posts
            const { count: totalPosts } = await supabase
                .from("bw_posts")
                .select("*", { count: 'exact', head: true });

            // Today's Posts
            const { count: todayPosts } = await supabase
                .from("bw_posts")
                .select("*", { count: 'exact', head: true })
                .gte("created_at", today.toISOString());

            // Total Comments
            const { count: totalComments } = await supabase
                .from("bw_comments")
                .select("*", { count: 'exact', head: true });

            // Recent Posts
            const { data: recentPosts } = await supabase
                .from("bw_posts")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(5);

            setStats({
                totalPosts: totalPosts || 0,
                todayPosts: todayPosts || 0,
                totalComments: totalComments || 0,
                recentPosts: recentPosts || []
            });
            setLoading(false);
        }
        fetchStats();
    }, []);

    if (loading) return <div>데이터 집계 중...</div>;

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-8">대시보드</h2>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 mb-1">전체 게시글</p>
                    <p className="text-3xl font-bold text-[#4a6a8a]">{stats.totalPosts.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 mb-1">오늘 올라온 글</p>
                    <p className="text-3xl font-bold text-green-500">{stats.todayPosts.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 mb-1">전체 댓글</p>
                    <p className="text-3xl font-bold text-gray-700">{stats.totalComments.toLocaleString()}</p>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-700">최근 게시글</h3>
                </div>
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-bold">
                        <tr>
                            <th className="px-6 py-3">제목</th>
                            <th className="px-6 py-3">작성자</th>
                            <th className="px-6 py-3 text-right">작성일시</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {stats.recentPosts.map((post) => (
                            <tr key={post.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-800">{post.title}</td>
                                <td className="px-6 py-4 text-gray-600">{post.author}</td>
                                <td className="px-6 py-4 text-gray-400 text-right">{new Date(post.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
