"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "톡톡(자유)",
    ai: "AI허브",
    bestseller: "베스트셀러",
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
    // en-CA 로케일은 항상 YYYY-MM-DD 형식으로 반환 (KST 기준)
    const kstDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // "2026-04-09"

    if (period === "daily") {
        return kstDate;
    } else if (period === "weekly") {
        const kstMidnight = new Date(`${kstDate}T00:00:00+09:00`);
        const dow = kstMidnight.getDay(); // 0=일, 1=월 ...
        const diff = dow === 0 ? -6 : 1 - dow;
        kstMidnight.setDate(kstMidnight.getDate() + diff);
        const monday = kstMidnight.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        return `${monday} (주간)`;
    } else if (period === "monthly") {
        return kstDate.slice(0, 7); // "2026-04"
    }
    return kstDate;
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
                    const { data: rpcData, error } = await supabase
                        .rpc('get_page_view_stats', { days_back: 180 });

                    if (error) {
                        console.error("[Dashboard] get_page_view_stats 오류:", error.message, error.code);
                    }
                    if (!error && rpcData) {
                        if (period === "daily") {
                            const table = rpcData.map(row => ({
                                date: row.kst_date,
                                pageviews: Number(row.total_pageviews),
                                visitors: Number(row.unique_sessions),
                                members: Number(row.member_pageviews),
                                nonMembers: Number(row.non_member_pageviews),
                            }));
                            setTableData(table);
                        } else {
                            // 주간/월간: 일별 집계 결과를 재그룹핑
                            const groups = {};
                            rpcData.forEach(row => {
                                const key = getGroupKey(row.kst_date + 'T12:00:00+09:00', period);
                                if (!groups[key]) groups[key] = { date: key, pageviews: 0, visitors: 0, members: 0, nonMembers: 0 };
                                groups[key].pageviews += Number(row.total_pageviews);
                                groups[key].visitors += Number(row.unique_sessions);
                                groups[key].members += Number(row.member_pageviews);
                                groups[key].nonMembers += Number(row.non_member_pageviews);
                            });
                            const table = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
                            setTableData(table);
                        }
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
                     // 게시판당 조회수 현황
                     // 1. 일반 게시글 조회수 가져오기
                     const { data: posts } = await supabase.from("bw_posts").select("created_at, board_type, view_count").gte("created_at", limitDate.toISOString());
                     
                     // 2. 베스트셀러 페이지 조회수 가져오기 (게시글 형태가 아니므로 page_views에서 집계)
                     const { data: bestViews } = await supabase.from("bw_page_views")
                        .select("visited_at, path")
                        .gte("visited_at", limitDate.toISOString())
                        .or("path.ilike./bestseller%,path.ilike./api/bestseller%");

                     const groups = {};
                     
                     // 게시글 기반 조회수 집계
                     posts?.forEach(p => {
                         const key = getGroupKey(p.created_at, period);
                         if (!groups[key]) groups[key] = { date: key, job: 0, support: 0, free: 0, ai: 0, bestseller: 0, total: 0 };
                         
                         const vCount = p.view_count || 0;
                         groups[key].total += vCount;
                         if (groups[key][p.board_type] !== undefined) {
                             groups[key][p.board_type] += vCount;
                         }
                     });

                     // 베스트셀러 페이지뷰 추가 집계
                     bestViews?.forEach(bv => {
                        const key = getGroupKey(bv.visited_at, period);
                        if (!groups[key]) groups[key] = { date: key, job: 0, support: 0, free: 0, ai: 0, bestseller: 0, total: 0 };
                        
                        groups[key].total += 1;
                        groups[key].bestseller += 1;
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
            headers = ["날짜(기간)", "총 조회수", "구인구직", "지원사업", "톡톡(자유)", "AI허브", "베스트셀러"];
            rows = tableData.map(d => [d.date, d.total, d.job, d.support, d.free, d.ai, d.bestseller]);
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
                    <p className="text-2xl font-black text-indigo-600">{(stats.totalUsers || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">총 누적 게시글</p>
                    <p className="text-2xl font-black text-emerald-600">{(stats.totalPosts || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">총 누적 댓글</p>
                    <p className="text-2xl font-black text-emerald-600">{(stats.totalComments || 0).toLocaleString()}</p>
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
                                        <th className="px-6 py-4">베스트셀러</th>
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
                                                <td className="px-6 py-4">{(row.visitors || 0).toLocaleString()} <span className="text-[10px] text-gray-400">명</span></td>
                                                <td className="px-6 py-4 font-bold text-emerald-700">{(row.pageviews || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{(row.members || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{(row.nonMembers || 0).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : activeTab === "posts" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-700">{row.date}</td>
                                                <td className="px-6 py-4 font-bold text-indigo-700">{(row.postTotal || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">{(row.postMember || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{(row.postNon || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 font-bold text-teal-700 bg-teal-50/30">{(row.cmtTotal || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">{(row.cmtMember || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{(row.cmtNon || 0).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : activeTab === "boardViews" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-700">{row.date}</td>
                                                <td className="px-6 py-4 font-bold text-orange-700">{(row.total || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{(row.job || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">{(row.support || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{(row.free || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">{(row.ai || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 bg-gray-50/50">{(row.bestseller || 0).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : activeTab === "postViews" ? (
                                        tableData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-500 font-bold">{i + 1}</td>
                                                <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{row.board}</span></td>
                                                <td className="px-6 py-4 font-medium max-w-[300px] truncate">{row.title}</td>
                                                <td className="px-6 py-4 text-gray-500">{row.author}</td>
                                                <td className="px-6 py-4 font-bold text-purple-700">{(row.views || 0).toLocaleString()}</td>
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
