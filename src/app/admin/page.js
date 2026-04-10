"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "톡톡(자유)",
    ai: "AI허브",
};

function downloadCSV(rows, filename) {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// -------------------------------------------------------------
// Helper to grouping dates (Daily, Weekly, Monthly)
// -------------------------------------------------------------
function getGroupKey(dateStr, period) {
    const d = new Date(dateStr);
    const kstTime = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    const year = kstTime.getFullYear();
    const month = String(kstTime.getMonth() + 1).padStart(2, '0');
    const date = String(kstTime.getDate()).padStart(2, '0');

    if (period === "daily") {
        return `${year}-${month}-${date}`;
    } else if (period === "weekly") {
        // Get the Monday of this week
        const diff = kstTime.getDate() - kstTime.getDay() + (kstTime.getDay() === 0 ? -6 : 1);
        const monday = new Date(kstTime.setDate(diff));
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')} (주간)`;
    } else if (period === "monthly") {
        return `${year}-${month}`;
    }
    return `${year}-${month}-${date}`;
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState("visitors"); // visitors, posts, boardViews, postViews
    const [period, setPeriod] = useState("daily"); // daily, weekly, monthly
    const [loading, setLoading] = useState(false);
    const [tableData, setTableData] = useState([]);
    
    // Overall Stats
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalPosts: 0,
        totalComments: 0,
        totalViews: 0
    });

    // 1. 공통 전체 통계 로드
    useEffect(() => {
        async function fetchOverall() {
            const { data: totalUsers } = await supabase.rpc('get_user_count');
            const { count: totalPosts } = await supabase.from("bw_posts").select("*", { count: 'exact', head: true });
            const { count: totalComments } = await supabase.from("bw_comments").select("*", { count: 'exact', head: true });
            const { data: viewData } = await supabase.from("bw_posts").select("view_count");
            const totalViews = viewData?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;

            setStats({
                totalUsers: totalUsers || 0,
                totalPosts: totalPosts || 0,
                totalComments: totalComments || 0,
                totalViews
            });
        }
        fetchOverall();
    }, []);

    // 2. 탭과 주기에 따른 데이터 테이블 로드
    useEffect(() => {
        async function fetchTabData() {
            setLoading(true);
            setTableData([]);

            const limitDate = new Date();
            // 기본 3개월 전까지만 불러서 집계 (원활한 성능을 위해)
            limitDate.setMonth(limitDate.getMonth() - 6);

            try {
                if (activeTab === "visitors") {
                    const { data: viewData, error } = await supabase
                        .from("bw_page_views")
                        .select("session_id, visited_at, user_id")
                        .gte("visited_at", limitDate.toISOString());
                    
                    if (!error && viewData) {
                        const groups = {};
                        viewData.forEach(v => {
                            const key = getGroupKey(v.visited_at, period);
                            if (!groups[key]) groups[key] = { date: key, totalPageviews: 0, sessions: new Set(), members: 0, nonMembers: 0 };
                            
                            groups[key].totalPageviews++;
                            groups[key].sessions.add(v.session_id);
                            if (v.user_id) groups[key].members++;
                            else groups[key].nonMembers++;
                        });

                        const table = Object.values(groups).map(g => ({
                            date: g.date,
                            pageviews: g.totalPageviews,
                            visitors: g.sessions.size,
                            members: g.members,
                            nonMembers: g.nonMembers
                        })).sort((a,b) => b.date.localeCompare(a.date));
                        
                        setTableData(table);
                    }
                } 
                else if (activeTab === "posts") {
                    // Posts
                    const { data: posts } = await supabase.from("bw_posts").select("created_at, user_id").gte("created_at", limitDate.toISOString());
                    // Comments
                    const { data: comments } = await supabase.from("bw_comments").select("created_at, user_id").gte("created_at", limitDate.toISOString());
                    
                    const groups = {};
                    const addData = (dataList, type) => {
                        dataList?.forEach(item => {
                            const key = getGroupKey(item.created_at, period);
                            if (!groups[key]) groups[key] = { date: key, postTotal: 0, postMember: 0, postNon: 0, cmtTotal: 0, cmtMember: 0, cmtNon: 0 };
                            
                            if (type === 'post') {
                                groups[key].postTotal++;
                                if (item.user_id) groups[key].postMember++;
                                else groups[key].postNon++;
                            } else {
                                groups[key].cmtTotal++;
                                if (item.user_id) groups[key].cmtMember++;
                                else groups[key].cmtNon++;
                            }
                        });
                    };
                    
                    addData(posts, 'post');
                    addData(comments, 'cmt');

                    const table = Object.values(groups).map(g => ({ ...g })).sort((a,b) => b.date.localeCompare(a.date));
                    setTableData(table);
                } 
                else if (activeTab === "boardViews") {
                     // 게시판당 조회수 현황 (이 부분은 주기별 구분이 어려우므로, 통째로 집계된 것을 주기에 맞게 나누거나 전체를 보여줌)
                     // 게시글 생성일을 기준으로 그룹핑
                     const { data: posts } = await supabase.from("bw_posts").select("created_at, board_type, view_count").gte("created_at", limitDate.toISOString());
                     const groups = {};
                     posts?.forEach(p => {
                         const key = getGroupKey(p.created_at, period);
                         if (!groups[key]) groups[key] = { date: key, job: 0, support: 0, free: 0, ai: 0, total: 0 };
                         
                         const vCount = p.view_count || 0;
                         groups[key].total += vCount;
                         if (groups[key][p.board_type] !== undefined) {
                             groups[key][p.board_type] += vCount;
                         }
                     });

                     const table = Object.values(groups).sort((a,b) => b.date.localeCompare(a.date));
                     setTableData(table);
                }
                else if (activeTab === "postViews") {
                     // 게시물 전체 누적 조회순 TOP (기간 구분 보다는 전체 인기글 관리가 목적이므로, period가 의미없어질 수 있음. 그래도 일단 보여줌)
                     // 단, 여기서는 표기 방식을 바꿔서 날짜 구분이 아닌 게시물 리스트를 뿌려줌.
                     const { data: posts } = await supabase
                        .from("bw_posts")
                        .select("id, title, author, view_count, board_type, created_at")
                        .order("view_count", { ascending: false })
                        .limit(200);

                     const table = (posts || []).map(p => ({
                        date: new Date(p.created_at).toISOString().split('T')[0],
                        board: boardTypeNames[p.board_type] || p.board_type,
                        title: p.title,
                        author: p.author,
                        views: p.view_count || 0
                     }));
                     setTableData(table);
                }
            } catch (err) {
                console.error(err);
            }
            
            setLoading(false);
        }

        fetchTabData();
    }, [activeTab, period]);


    const handleExportCSV = () => {
        if (!tableData || tableData.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        let headers = [];
        let rows = [];

        if (activeTab === "visitors") {
            headers = ["날짜(기간)", "순방문자수(세션)", "페이지뷰(전체)", "페이지뷰(회원)", "페이지뷰(비회원)"];
            rows = tableData.map(d => [d.date, d.visitors, d.pageviews, d.members, d.nonMembers]);
        } else if (activeTab === "posts") {
            headers = ["날짜(기간)", "게시글(전체)", "게시글(회원)", "게시글(비회원)", "댓글(전체)", "댓글(회원)", "댓글(비회원)"];
            rows = tableData.map(d => [d.date, d.postTotal, d.postMember, d.postNon, d.cmtTotal, d.cmtMember, d.cmtNon]);
        } else if (activeTab === "boardViews") {
            headers = ["날짜(기간)", "총 조회수", "구인구직", "지원사업", "톡톡(자유)", "AI허브"];
            rows = tableData.map(d => [d.date, d.total, d.job, d.support, d.free, d.ai]);
        } else if (activeTab === "postViews") {
            headers = ["작성일", "게시판", "게시글 제목", "작성자", "누적 조회수"];
            rows = tableData.map(d => [d.date, d.board, d.title.replace(/,/g, " "), d.author, d.views]);
        }

        downloadCSV([headers, ...rows], `bookwiki_stats_${activeTab}_${period}.csv`);
    };

    return (
        <div className="bg-gray-50 min-h-screen p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">운영자 대시보드</h2>

            {/* Overall Metrics Wrap */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">총 회원 수</p>
                    <p className="text-2xl font-black text-indigo-600">{stats.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">총 누적 게시글</p>
                    <p className="text-2xl font-black text-emerald-600">{stats.totalPosts.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">총 누적 댓글</p>
                    <p className="text-2xl font-black text-emerald-600">{stats.totalComments.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">총 페이지 조회수</p>
                    <p className="text-2xl font-black text-purple-600">{stats.totalViews.toLocaleString()}</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="flex flex-wrap border-b border-gray-200 bg-gray-50">
                    {[
                        { id: "visitors", label: "방문 현황" },
                        { id: "posts", label: "게시물/댓글 현황" },
                        { id: "boardViews", label: "게시판별 조회수" },
                        { id: "postViews", label: "게시글별 조회수 (인기순)" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-4 text-sm font-bold transition-colors ${
                                activeTab === tab.id 
                                    ? "bg-white text-emerald-700 border-t-2 border-emerald-600 border-r border-l border-gray-200 -mb-px" 
                                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Sub Filters & Export */}
                <div className="p-4 flex flex-wrap justify-between items-center bg-white border-b border-gray-100 gap-4">
                    <div className="flex items-center space-x-2">
                        {activeTab !== "postViews" && (
                            <select 
                                value={period} 
                                onChange={(e) => setPeriod(e.target.value)}
                                className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                            >
                                <option value="daily">일간 단위</option>
                                <option value="weekly">주간 단위</option>
                                <option value="monthly">월간 단위</option>
                            </select>
                        )}
                        {activeTab === "postViews" && (
                            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded">
                                전체 기간 TOP 200 조회
                            </span>
                        )}
                    </div>
                    <div>
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 py-1.5 rounded text-sm font-bold transition"
                        >
                            <span className="mr-2">⬇️</span> 엑셀(CSV) 다운로드
                        </button>
                    </div>
                </div>

                {/* Data Table Area */}
                <div className="overflow-x-auto min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64 text-gray-400">데이터를 불러오는 중입니다...</div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                                {activeTab === "visitors" && (
                                    <tr>
                                        <th className="px-6 py-4">기준 ({period === 'daily' ? '일' : period === 'weekly' ? '주' : '월'})</th>
                                        <th className="px-6 py-4">순방문자수</th>
                                        <th className="px-6 py-4 text-emerald-700">총 조회/방문 (PV)</th>
                                        <th className="px-6 py-4">회원 PV</th>
                                        <th className="px-6 py-4">비회원 PV</th>
                                    </tr>
                                )}
                                {activeTab === "posts" && (
                                    <tr>
                                        <th className="px-6 py-4">기준</th>
                                        <th className="px-6 py-4 text-indigo-700">전체 새 글</th>
                                        <th className="px-6 py-4">회원 글</th>
                                        <th className="px-6 py-4">비회원 글</th>
                                        <th className="px-6 py-4 text-teal-700">전체 새 댓글</th>
                                        <th className="px-6 py-4">회원 댓글</th>
                                        <th className="px-6 py-4">비회원 댓글</th>
                                    </tr>
                                )}
                                {activeTab === "boardViews" && (
                                    <tr>
                                        <th className="px-6 py-4">자료 작성일 기준</th>
                                        <th className="px-6 py-4 text-orange-700">발생 총 조회수</th>
                                        <th className="px-6 py-4">구인구직</th>
                                        <th className="px-6 py-4">지원사업</th>
                                        <th className="px-6 py-4">톡톡(자유)</th>
                                        <th className="px-6 py-4">AI허브</th>
                                    </tr>
                                )}
                                {activeTab === "postViews" && (
                                    <tr>
                                        <th className="px-6 py-4">순위</th>
                                        <th className="px-6 py-4">게시판</th>
                                        <th className="px-6 py-4 w-1/2">제목</th>
                                        <th className="px-6 py-4">작성자</th>
                                        <th className="px-6 py-4 text-purple-700">총 조회수</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tableData.length === 0 ? (
                                    <tr><td colSpan="8" className="px-6 py-10 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                ) : (
                                    activeTab === "visitors" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-700">{row.date}</td>
                                                <td className="px-6 py-4">{row.visitors.toLocaleString()} <span className="text-[10px] text-gray-400">명</span></td>
                                                <td className="px-6 py-4 font-bold text-emerald-700">{row.pageviews.toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{row.members.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{row.nonMembers.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : activeTab === "posts" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-700">{row.date}</td>
                                                <td className="px-6 py-4 font-bold text-indigo-700">{row.postTotal.toLocaleString()}</td>
                                                <td className="px-6 py-4">{row.postMember.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{row.postNon.toLocaleString()}</td>
                                                <td className="px-6 py-4 font-bold text-teal-700 bg-teal-50/30">{row.cmtTotal.toLocaleString()}</td>
                                                <td className="px-6 py-4">{row.cmtMember.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{row.cmtNon.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : activeTab === "boardViews" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-700">{row.date}</td>
                                                <td className="px-6 py-4 font-bold text-orange-700">{row.total.toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{row.job.toLocaleString()}</td>
                                                <td className="px-6 py-4">{row.support.toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{row.free.toLocaleString()}</td>
                                                <td className="px-6 py-4">{row.ai.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : activeTab === "postViews" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-500 font-bold">{i + 1}</td>
                                                <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{row.board}</span></td>
                                                <td className="px-6 py-4 font-medium max-w-[300px] truncate">{row.title}</td>
                                                <td className="px-6 py-4 text-gray-500">{row.author}</td>
                                                <td className="px-6 py-4 font-bold text-purple-700">{row.views.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : null
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
