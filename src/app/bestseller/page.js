"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { generateBookReport, generatePublisherReport } from "@/lib/reportGenerator";

const PLATFORMS = [
  { id: "kyobo", name: "교보문고", color: "#1E40AF" },
  { id: "yes24", name: "예스24", color: "#FF6B00" },
  { id: "aladdin", name: "알라딘", color: "#E62312" },
  { id: "ridi", name: "리디북스", color: "#5B4FFF" },
  { id: "millie", name: "밀리의서재", color: "#00C73C" },
];

const CATEGORIES = [
  "종합", "소설", "에세이/시", "인문", "역사", "사회과학",
  "경제경영", "자기계발", "과학", "어린이/청소년"
];

const PERIODS = [
  { id: "daily", name: "일간" },
  { id: "weekly", name: "주간" },
  { id: "monthly", name: "월간" },
];

export default function BestsellerPage() {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [selectedCategory, setSelectedCategory] = useState("종합");

  const [selectedBook, setSelectedBook] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [targetPublisher, setTargetPublisher] = useState("더난출판");

  // 인사이트 데이터 계산
  const insights = useMemo(() => {
    if (snapshots.length === 0) return null;

    // 1. 순위 급상승 (Big Movers)
    const bigMovers = [...snapshots]
      .filter(s => s.rank_change > 0)
      .sort((a, b) => b.rank_change - a.rank_change)
      .slice(0, 3);

    // 2. 신간 (New Releases - 30일 이내)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newReleases = snapshots.filter(s => {
      if (!s.bw_books?.pub_date) return false;
      return new Date(s.bw_books.pub_date) >= thirtyDaysAgo;
    }).slice(0, 5);

    // 3. 자사 도서 (Our Books)
    const ourBooks = snapshots.filter(s => 
      s.bw_books?.publisher?.includes(targetPublisher)
    );

    // 4. 시장 점유율 (출판사별 권수)
    const pubCounts = snapshots.reduce((acc, s) => {
      const pub = s.bw_books?.publisher || "알수없음";
      acc[pub] = (acc[pub] || 0) + 1;
      return acc;
    }, {});
    const topPublishers = Object.entries(pubCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { bigMovers, newReleases, ourBooks, topPublishers };
  }, [snapshots, targetPublisher]);

  useEffect(() => {
    async function fetchBestsellers() {
      setLoading(true);
      let query = supabase
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
            cover_url,
            isbn,
            pub_date
          )
        `)
        .eq("period_type", selectedPeriod)
        .eq("common_category", selectedCategory)
        .order("snapshot_date", { ascending: false })
        .order("rank", { ascending: true });

      // 전일 데이터 표시 (KST 어제 = 실제 판매 데이터 날짜)
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      kstNow.setDate(kstNow.getDate() - 1);
      const yesterday = kstNow.toISOString().split('T')[0];
      
      query = query.eq("snapshot_date", yesterday);

      if (selectedPlatform !== "all") {
        query = query.eq("platform", selectedPlatform);
      }

      const { data, error } = await query.limit(100);

      if (data) {
        setSnapshots(data);
      }
      setLoading(false);
    }
    fetchBestsellers();
  }, [selectedPlatform, selectedPeriod, selectedCategory]);

  const fetchTrend = async (bookId) => {
    const { data } = await supabase
      .from("bw_bestseller_snapshots")
      .select("snapshot_date, rank, platform")
      .eq("book_id", bookId)
      .order("snapshot_date", { ascending: true });
    
    if (data) {
      const formatted = data.reduce((acc, curr) => {
        const date = curr.snapshot_date;
        if (!acc[date]) acc[date] = { date };
        acc[date][curr.platform] = curr.rank;
        return acc;
      }, {});
      setTrendData(Object.values(formatted));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#355E3B] text-white py-4 px-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold tracking-tighter">북위키 베스트셀러</Link>
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${selectedPeriod === p.id ? "bg-white text-[#355E3B]" : "bg-white/10 hover:bg-white/20"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Platform Selection */}
        <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedPlatform("all")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${selectedPlatform === "all" ? "bg-black text-white" : "bg-white text-gray-500 shadow-sm border border-gray-100 hover:bg-gray-50"}`}
          >
            전체 통합
          </button>
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap shadow-sm border border-gray-100 ${selectedPlatform === p.id ? "bg-white text-gray-900 border-2" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              style={selectedPlatform === p.id ? { borderColor: p.color } : {}}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Category Selection */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex gap-2 mr-4 pr-4 border-r border-gray-100 items-center">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedPeriod === p.id ? "bg-black text-white" : "text-gray-400 hover:text-gray-900"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedCategory === cat ? "bg-[#355E3B] text-white shadow-lg" : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Insight Dashboard */}
        {!loading && insights && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 overflow-x-auto pb-2">
            {/* Card 1: Our Summary */}
            <div className="bg-gradient-to-br from-[#355E3B] to-[#1A2F1D] p-6 rounded-3xl text-white shadow-xl min-w-[300px]">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black tracking-widest opacity-60 uppercase">Our Performance</span>
                <span className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold">{targetPublisher}</span>
              </div>
              <div className="text-3xl font-black mb-1">
                {insights.ourBooks.length}<span className="text-sm font-medium opacity-60 ml-1">Books in Top 50</span>
              </div>
              <p className="text-[11px] opacity-70 mb-4">
                {insights.ourBooks.length > 0 
                  ? `가장 높은 순위: ${Math.min(...insights.ourBooks.map(b => b.rank))}위`
                  : "현재 순위권 도서가 없습니다."}
              </p>
              <div className="flex -space-x-2 mb-6">
                {insights.ourBooks.slice(0, 4).map((b, i) => (
                  <img key={i} src={b.bw_books.cover_url} className="w-8 h-10 rounded-sm border border-white/20 object-cover shadow-lg" />
                ))}
              </div>
              <button 
                onClick={() => generatePublisherReport(targetPublisher, insights, snapshots)}
                className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-2"
              >
                📄 전문 성과 리포트 PDF 추출
              </button>
            </div>

            {/* Card 2: Big Movers */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-w-[300px]">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black tracking-widest text-red-500 uppercase">Big Movers</span>
                <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold">Today's Hot</span>
              </div>
              <div className="space-y-3">
                {insights.bigMovers.length > 0 ? insights.bigMovers.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{b.rank}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{b.bw_books.title}</p>
                      <p className="text-[10px] text-gray-400">▲ {b.rank_change} spots</p>
                    </div>
                  </div>
                )) : <p className="text-xs text-gray-400">급상승 도서가 없습니다.</p>}
              </div>
            </div>

            {/* Card 3: New Releases */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-w-[300px]">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black tracking-widest text-[#5B4FFF] uppercase">New Releases</span>
                <span className="bg-[#5B4FFF]/10 text-[#5B4FFF] px-2 py-1 rounded text-[10px] font-bold">Recently Published</span>
              </div>
              <div className="space-y-3">
                {insights.newReleases.length > 0 ? insights.newReleases.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <img src={b.bw_books.cover_url} className="w-6 h-8 rounded-sm object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{b.bw_books.title}</p>
                      <p className="text-[10px] text-gray-400">{b.bw_books.pub_date} 출간</p>
                    </div>
                  </div>
                )) : <p className="text-xs text-gray-400">최근 신간이 없습니다.</p>}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#355E3B]"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-gray-400 font-medium">조회된 데이터가 없습니다.</p>
            <p className="text-gray-300 text-xs mt-1">스크래퍼를 실행하여 데이터를 수집해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {snapshots.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  setSelectedBook(item.bw_books);
                  fetchTrend(item.bw_books.id);
                }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 group cursor-pointer active:scale-95"
              >
                <div className="relative aspect-[3/4] bg-gray-50 flex items-center justify-center overflow-hidden">
                  <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                    <div className="bg-black/80 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm backdrop-blur-sm group-hover:scale-110 transition-transform">
                      {item.rank}
                    </div>
                    {item.rank_change >= 5 && (
                      <div className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">HOT</div>
                    )}
                    {(item.bw_books?.pub_date && new Date(item.bw_books.pub_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) && (
                      <div className="bg-[#5B4FFF] text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">NEW</div>
                    )}
                  </div>
                  {item.bw_books?.cover_url ? (
                    <img 
                      src={item.bw_books.cover_url} 
                      alt={item.bw_books.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-gray-300 text-xs">표지 없음</div>
                  )}
                  <div className="absolute bottom-3 right-3 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm border border-gray-100">
                    {PLATFORMS.find(p => p.id === item.platform)?.name}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1 group-hover:text-[#355E3B] transition-colors">{item.bw_books?.title}</h3>
                  <p className="text-[11px] text-gray-500 line-clamp-1 font-medium italic">{item.bw_books?.author} / {item.bw_books?.publisher}</p>
                  
                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-semibold tracking-wider">
                    <span>TREND ANALYSIS</span>
                    {item.rank_change > 0 ? (
                      <span className="text-red-500 flex items-center gap-0.5">▲ {item.rank_change}</span>
                    ) : item.rank_change < 0 ? (
                      <span className="text-blue-500 flex items-center gap-0.5">▼ {Math.abs(item.rank_change)}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Trend Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
            <div className="md:w-1/3 bg-gray-50 p-8 border-r border-gray-100 flex flex-col items-center">
              <div className="w-48 aspect-[3/4] rounded-xl shadow-xl border-4 border-white overflow-hidden mb-6">
                <img src={selectedBook.cover_url} alt={selectedBook.title} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 text-center mb-2">{selectedBook.title}</h2>
              <p className="text-sm text-gray-400 text-center">{selectedBook.author}</p>
              <div className="mt-auto w-full space-y-2">
                <button 
                  onClick={() => generateBookReport(selectedBook, trendData, PLATFORMS)}
                  className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  📄 도서 분석 리포트 PDF
                </button>
                <button 
                  onClick={() => setSelectedBook(null)}
                  className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-lg hover:bg-black transition-all active:scale-95"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="flex-1 p-8 flex flex-col">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h4 className="text-[10px] font-black tracking-widest text-[#355E3B] mb-1">RANKING TREND</h4>
                  <h3 className="text-2xl font-bold text-gray-900">플랫폼별 순위 변화</h3>
                </div>
                <span className="text-[10px] bg-gray-100 px-3 py-1 rounded-full font-bold text-gray-400">DAILY REPORT</span>
              </div>
              
              <div className="flex-1 min-h-[300px]" id="trend-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8'}}
                      dy={10}
                    />
                    <YAxis 
                      reversed 
                      domain={[1, 50]} 
                      axisLine={false} 
                      tickLine={false}
                      tick={{fontSize: 10, fill: '#94a3b8'}}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend iconType="circle" />
                    {PLATFORMS.map(p => (
                      <Line 
                        key={p.id}
                        type="monotone" 
                        dataKey={p.id} 
                        name={p.name}
                        stroke={p.color} 
                        strokeWidth={4}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-gray-200 mt-12 text-center text-gray-400">
        <p className="text-xs font-medium">© 2026 BOOKWIKI TREND ENGINE. ALL RIGHTS RESERVED.</p>
        <p className="text-[10px] mt-2 opacity-50">DATA UPDATED AT: {new Date().toLocaleString()}</p>
      </footer>

      <style jsx global>{`
        body {
          letter-spacing: -0.01em;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
