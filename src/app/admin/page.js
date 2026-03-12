"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "자유게시판",
    ai: "AI허브",
};

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        todaySignups: 0,
        totalPosts: 0,
        todayPosts: 0,
        totalComments: 0,
        todayComments: 0,
        totalViews: 0,
        activeUsers: 0,
        boardStats: [],
        hotPosts: [],
        weeklyTrend: [],
        recentPosts: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            // Total Users (from RPC function)
            const { data: totalUsers } = await supabase.rpc('get_user_count');

            // Today's Signups (from RPC function)
            const { data: todaySignups } = await supabase.rpc('get_today_signup_count');

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

            // Today's Comments
            const { count: todayComments } = await supabase
                .from("bw_comments")
                .select("*", { count: 'exact', head: true })
                .gte("created_at", today.toISOString());

            // Total Views (sum of all view_count)
            const { data: viewData } = await supabase
                .from("bw_posts")
                .select("view_count");
            const totalViews = viewData?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;

            // Active Users (unique users who posted/commented in last 7 days)
            const { data: activePostUsers } = await supabase
                .from("bw_posts")
                .select("user_id")
                .not("user_id", "is", null)
                .gte("created_at", oneWeekAgo.toISOString());
            const { data: activeCommentUsers } = await supabase
                .from("bw_comments")
                .select("user_id")
                .not("user_id", "is", null)
                .gte("created_at", oneWeekAgo.toISOString());
            const uniqueActiveUsers = new Set([
                ...(activePostUsers?.map(p => p.user_id) || []),
                ...(activeCommentUsers?.map(c => c.user_id) || [])
            ]);
            const activeUsers = uniqueActiveUsers.size;

            // Board-wise Post Counts
            const { data: allPosts } = await supabase
                .from("bw_posts")
                .select("board_type");
            const boardCounts = {};
            allPosts?.forEach(p => {
                boardCounts[p.board_type] = (boardCounts[p.board_type] || 0) + 1;
            });
            const boardStats = Object.entries(boardCounts).map(([type, count]) => ({
                type,
                name: boardTypeNames[type] || type,
                count
            }));

            // Hot Posts (Top 5 this week by views)
            const { data: hotPosts } = await supabase
                .from("bw_posts")
                .select("id, title, author, view_count, board_type")
                .gte("created_at", oneWeekAgo.toISOString())
                .order("view_count", { ascending: false })
                .limit(5);

            // Weekly Trend (posts per day for last 7 days)
            const { data: weekPosts } = await supabase
                .from("bw_posts")
                .select("created_at")
                .gte("created_at", oneWeekAgo.toISOString());
            const dayCounts = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split('T')[0];
                dayCounts[key] = 0;
            }
            weekPosts?.forEach(p => {
                const key = p.created_at.split('T')[0];
                if (dayCounts[key] !== undefined) {
                    dayCounts[key]++;
                }
            });
            const weeklyTrend = Object.entries(dayCounts).map(([date, count]) => ({
                date: date.slice(5), // MM-DD format
                count
            }));

            // Recent Posts
            const { data: recentPosts } = await supabase
                .from("bw_posts")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(5);

            setStats({
                totalUsers: totalUsers || 0,
                todaySignups: todaySignups || 0,
                totalPosts: totalPosts || 0,
                todayPosts: todayPosts || 0,
                totalComments: totalComments || 0,
                todayComments: todayComments || 0,
                totalViews,
                activeUsers,
                boardStats,
                hotPosts: hotPosts || [],
                weeklyTrend,
                recentPosts: recentPosts || []
            });
            setLoading(false);
        }
        fetchStats();
    }, []);

    if (loading) return <div>데이터 집계 중...</div>;

    const maxTrend = Math.max(...stats.weeklyTrend.map(d => d.count), 1);

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-8">대시보드</h2>

            {/* Main Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">전체 회원</p>
                    <p className="text-2xl font-bold text-indigo-600">{stats.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">오늘 가입</p>
                    <p className="text-2xl font-bold text-indigo-400">+{stats.todaySignups.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">전체 게시글</p>
                    <p className="text-2xl font-bold text-[#355E3B]">{stats.totalPosts.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">오늘 게시글</p>
                    <p className="text-2xl font-bold text-green-500">+{stats.todayPosts.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">전체 댓글</p>
                    <p className="text-2xl font-bold text-gray-700">{stats.totalComments.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">오늘 댓글</p>
                    <p className="text-2xl font-bold text-blue-500">+{stats.todayComments.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">총 조회수</p>
                    <p className="text-2xl font-bold text-purple-500">{stats.totalViews.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">활성 사용자 (7일)</p>
                    <p className="text-2xl font-bold text-orange-500">{stats.activeUsers.toLocaleString()}</p>
                </div>
            </div>

            {/* Board Stats & Weekly Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Board-wise Stats */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700">게시판별 현황</h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-3">
                            {stats.boardStats.map((board) => (
                                <div key={board.type} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">{board.name}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#355E3B] rounded-full"
                                                style={{ width: `${(board.count / stats.totalPosts) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-bold text-gray-800 w-12 text-right">{board.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Weekly Trend */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700">최근 7일 게시글 추이</h3>
                    </div>
                    <div className="p-6">
                        <div className="flex items-end justify-between gap-2 h-32">
                            {stats.weeklyTrend.map((day, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-600">{day.count}</span>
                                    <div
                                        className="w-full bg-[#355E3B] rounded-t"
                                        style={{ height: `${(day.count / maxTrend) * 80}px`, minHeight: day.count > 0 ? '4px' : '0' }}
                                    />
                                    <span className="text-[10px] text-gray-400">{day.date}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hot Posts & Recent Posts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hot Posts */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold">HOT</span>
                        <h3 className="text-sm font-bold text-gray-700">이번 주 인기글 TOP 5</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {stats.hotPosts.length === 0 ? (
                            <div className="px-6 py-8 text-center text-xs text-gray-400">이번 주 게시글이 없습니다.</div>
                        ) : (
                            stats.hotPosts.map((post, idx) => (
                                <div key={post.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50">
                                    <span className="text-lg font-bold text-[#355E3B] w-6">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{post.title}</p>
                                        <p className="text-[10px] text-gray-400">{boardTypeNames[post.board_type]} · {post.author}</p>
                                    </div>
                                    <span className="text-xs text-gray-500">{post.view_count.toLocaleString()} 조회</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Posts */}
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
                                    <td className="px-6 py-4 font-medium text-gray-800 truncate max-w-[200px]">{post.title}</td>
                                    <td className="px-6 py-4 text-gray-600">{post.author}</td>
                                    <td className="px-6 py-4 text-gray-400 text-right whitespace-nowrap">{new Date(post.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
