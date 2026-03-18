"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';

const PLATFORMS = [
  { id: "kyobo", name: "교보", fullName: "교보문고", color: "#006633" },
  { id: "yes24", name: "예스24", fullName: "예스24", color: "#005599" },
  { id: "aladdin", name: "알라딘", fullName: "알라딘", color: "#E62312" },
  { id: "ridi", name: "리디", fullName: "리디북스", color: "#1F8CE6" },
  { id: "millie", name: "밀리", fullName: "밀리의서재", color: "#FFB800" },
];

const CATEGORIES = ["종합", "소설", "에세이/시", "인문", "경제경영", "자기계발"];

export default function AdminBestsellerDashboard() {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("종합");
  const [view, setView] = useState("insights"); // insights, list, trends

  useEffect(() => {
    fetchAllData();
  }, [selectedCategory]);

  async function fetchAllData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from("bw_bestseller_snapshots")
      .select(`
        rank,
        rank_change,
        platform,
        snapshot_date,
        bw_books!inner (
          id,
          title,
          author,
          publisher,
          cover_url
        )
      `)
      .eq("period_type", "daily")
      .eq("common_category", selectedCategory)
      .eq("snapshot_date", today)
      .order("rank", { ascending: true });

    setAllData(data || []);
    setLoading(false);
  }

  // 📊 Analytics
  const analytics = useMemo(() => {
    if (!allData.length) return null;

    // 플랫폼별 1위
    const topByPlatform = PLATFORMS.map(p => {
      const top = allData.find(d => d.platform === p.id && d.rank === 1);
      return { platform: p, book: top?.bw_books };
    });

    // 급상승 Top 5
    const rising = [...allData]
      .filter(d => d.rank_change && d.rank_change < 0)
      .sort((a, b) => a.rank_change - b.rank_change)
      .slice(0, 5);

    // 급하락 Top 5
    const falling = [...allData]
      .filter(d => d.rank_change && d.rank_change > 0)
      .sort((a, b) => b.rank_change - a.rank_change)
      .slice(0, 5);

    // 신규 진입 (rank_change가 매우 큰 경우)
    const newEntries = [...allData]
      .filter(d => !d.rank_change || Math.abs(d.rank_change) > 15)
      .slice(0, 5);

    // 플랫폼 합의 Top 10 (여러 플랫폼에서 상위권)
    const booksByTitle = {};
    allData.forEach(d => {
      const key = d.bw_books.title;
      if (!booksByTitle[key]) {
        booksByTitle[key] = { book: d.bw_books, platforms: [], avgRank: 0, count: 0 };
      }
      booksByTitle[key].platforms.push({ platform: d.platform, rank: d.rank });
      booksByTitle[key].avgRank += d.rank;
      booksByTitle[key].count++;
    });

    const consensus = Object.values(booksByTitle)
      .filter(b => b.count >= 3) // 최소 3개 플랫폼
      .map(b => ({ ...b, avgRank: b.avgRank / b.count }))
      .sort((a, b) => a.avgRank - b.avgRank)
      .slice(0, 10);

    // 플랫폼 독점 (한 플랫폼에만 있는 책)
    const exclusive = Object.values(booksByTitle)
      .filter(b => b.count === 1)
      .slice(0, 10);

    // 통계
    const stats = {
      totalBooks: new Set(allData.map(d => d.bw_books.id)).size,
      risingCount: rising.length,
      fallingCount: falling.length,
      newCount: newEntries.length,
      platformCoverage: (consensus.length / 20 * 100).toFixed(0)
    };

    return { topByPlatform, rising, falling, newEntries, consensus, exclusive, stats };
  }, [allData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#355E3B] mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">데이터 분석 중...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-400 text-lg font-medium">데이터가 없습니다</p>
        <p className="text-gray-300 text-sm mt-2">스크래퍼를 실행하여 데이터를 수집해주세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">📚 베스트셀러 인사이트</h1>
        <p className="text-xs md:text-sm text-gray-500">5개 서점 실시간 트렌드 분석 · {new Date().toLocaleDateString('ko-KR')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 md:p-6 rounded-xl shadow-lg">
          <p className="text-[10px] md:text-xs font-bold opacity-80 mb-1">총 도서</p>
          <p className="text-2xl md:text-3xl font-black">{analytics.stats.totalBooks}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 md:p-6 rounded-xl shadow-lg">
          <p className="text-[10px] md:text-xs font-bold opacity-80 mb-1">급상승</p>
          <p className="text-2xl md:text-3xl font-black">↑ {analytics.stats.risingCount}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 md:p-6 rounded-xl shadow-lg">
          <p className="text-[10px] md:text-xs font-bold opacity-80 mb-1">급하락</p>
          <p className="text-2xl md:text-3xl font-black">↓ {analytics.stats.fallingCount}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 md:p-6 rounded-xl shadow-lg">
          <p className="text-[10px] md:text-xs font-bold opacity-80 mb-1">신규 진입</p>
          <p className="text-2xl md:text-3xl font-black">★ {analytics.stats.newCount}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 md:p-6 rounded-xl shadow-lg">
          <p className="text-[10px] md:text-xs font-bold opacity-80 mb-1">플랫폼 일치율</p>
          <p className="text-2xl md:text-3xl font-black">{analytics.stats.platformCoverage}%</p>
        </div>
      </div>

      {/* Category Selector */}
      <div className="flex gap-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-[#355E3B] text-white shadow-md"
                : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: "insights", name: "🔍 인사이트", icon: "🎯" },
          { id: "comparison", name: "⚡ 플랫폼 비교", icon: "📊" },
          { id: "list", name: "📋 전체 목록", icon: "📚" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 md:px-5 py-2 md:py-3 rounded-xl text-xs md:text-sm font-bold transition whitespace-nowrap ${
              view === tab.id
                ? "bg-[#2c3e50] text-white shadow-lg"
                : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content Views */}
      {view === "insights" && (
        <div className="space-y-6">
          {/* 급상승 & 급하락 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* 급상승 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-3 md:p-4">
                <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
                  <span className="text-xl md:text-2xl">🔥</span> 급상승 TOP 5
                </h3>
                <p className="text-[10px] md:text-xs opacity-80 mt-1">순위 상승폭이 가장 큰 도서</p>
              </div>
              <div className="divide-y divide-gray-100">
                {analytics.rising.map((item, idx) => (
                  <div key={idx} className="p-3 md:p-4 hover:bg-gray-50 flex items-center gap-3 md:gap-4">
                    <div className="flex-shrink-0 w-10 h-14 md:w-12 md:h-16 bg-gray-100 rounded overflow-hidden">
                      {item.bw_books.cover_url && (
                        <img src={item.bw_books.cover_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs md:text-sm text-gray-900 truncate">{item.bw_books.title}</p>
                      <p className="text-[10px] md:text-xs text-gray-500">{item.bw_books.author}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl md:text-2xl font-black text-red-500">↑{Math.abs(item.rank_change)}</p>
                      <p className="text-[10px] md:text-xs text-gray-400">{item.rank}위</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 급하락 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 md:p-4">
                <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
                  <span className="text-xl md:text-2xl">📉</span> 급하락 TOP 5
                </h3>
                <p className="text-[10px] md:text-xs opacity-80 mt-1">순위 하락폭이 가장 큰 도서</p>
              </div>
              <div className="divide-y divide-gray-100">
                {analytics.falling.map((item, idx) => (
                  <div key={idx} className="p-3 md:p-4 hover:bg-gray-50 flex items-center gap-3 md:gap-4">
                    <div className="flex-shrink-0 w-10 h-14 md:w-12 md:h-16 bg-gray-100 rounded overflow-hidden">
                      {item.bw_books.cover_url && (
                        <img src={item.bw_books.cover_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs md:text-sm text-gray-900 truncate">{item.bw_books.title}</p>
                      <p className="text-[10px] md:text-xs text-gray-500">{item.bw_books.author}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl md:text-2xl font-black text-blue-500">↓{item.rank_change}</p>
                      <p className="text-[10px] md:text-xs text-gray-400">{item.rank}위</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 플랫폼 합의 Top 10 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="text-2xl">👑</span> 플랫폼 합의 TOP 10
              </h3>
              <p className="text-xs opacity-80 mt-1">3개 이상 플랫폼에서 상위권에 랭크된 도서</p>
            </div>
            <div className="p-6">
              <div className="grid gap-3">
                {analytics.consensus.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-black text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-shrink-0 w-10 h-14 bg-gray-100 rounded overflow-hidden">
                      {item.book.cover_url && (
                        <img src={item.book.cover_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{item.book.title}</p>
                      <p className="text-xs text-gray-500">{item.book.author}</p>
                    </div>
                    <div className="flex gap-1">
                      {item.platforms.map((p, i) => {
                        const platform = PLATFORMS.find(pl => pl.id === p.platform);
                        return (
                          <div
                            key={i}
                            className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: platform?.color }}
                            title={`${platform?.fullName} ${p.rank}위`}
                          >
                            {p.rank}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">평균</p>
                      <p className="text-lg font-black text-purple-600">{item.avgRank.toFixed(1)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "comparison" && (
        <div className="space-y-6">
          {/* 플랫폼별 1위 비교 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-3 md:p-4">
              <h3 className="text-base md:text-lg font-bold">🏆 플랫폼별 1위 도서</h3>
              <p className="text-[10px] md:text-xs opacity-80 mt-1">각 서점의 현재 베스트셀러 1위</p>
            </div>
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                {analytics.topByPlatform.map(({ platform, book }) => (
                  <div key={platform.id} className="text-center">
                    <div className="mb-2 md:mb-3">
                      <div className="inline-block px-2 md:px-3 py-1 rounded-full text-white text-[10px] md:text-xs font-bold" style={{ backgroundColor: platform.color }}>
                        {platform.fullName}
                      </div>
                    </div>
                    {book ? (
                      <div>
                        <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden mb-2 md:mb-3 shadow-md">
                          {book.cover_url && (
                            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <p className="font-bold text-xs md:text-sm text-gray-900 line-clamp-2 mb-1">{book.title}</p>
                        <p className="text-[10px] md:text-xs text-gray-500 line-clamp-1">{book.author}</p>
                      </div>
                    ) : (
                      <div className="text-gray-300 text-[10px] md:text-xs">데이터 없음</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#2c3e50] text-white p-4">
            <h3 className="text-lg font-bold">📋 전체 베스트셀러 목록</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">순위</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">제목</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">저자</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">출판사</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">플랫폼</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-700">변화</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allData.slice(0, 50).map((item, idx) => {
                  const platform = PLATFORMS.find(p => p.id === item.platform);
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold text-gray-700">
                          {item.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.bw_books.title}</td>
                      <td className="px-4 py-3 text-gray-600">{item.bw_books.author}</td>
                      <td className="px-4 py-3 text-gray-500">{item.bw_books.publisher}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 rounded text-white text-xs font-bold" style={{ backgroundColor: platform?.color }}>
                          {platform?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.rank_change > 0 ? (
                          <span className="text-blue-500 font-bold">↓ {item.rank_change}</span>
                        ) : item.rank_change < 0 ? (
                          <span className="text-red-500 font-bold">↑ {Math.abs(item.rank_change)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
