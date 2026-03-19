"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const PLATFORMS = [
  { id: "kyobo", name: "교보문고", color: "#006633" },
  { id: "yes24", name: "예스24", color: "#005599" },
  { id: "aladdin", name: "알라딘", color: "#E62312" },
  { id: "ridi", name: "리디북스", color: "#1F8CE6" },
  { id: "millie", name: "밀리의서재", color: "#FFEB00" },
];

const CATEGORIES = [
  "종합", "소설", "에세이/시", "인문", "경제경영", "자기계발", 
  "사회정치", "역사", "예술/문화", "자연과학", "IT/컴퓨터", 
  "어린이", "유아", "청소년", "만화"
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
            isbn
          )
        `)
        .eq("period_type", selectedPeriod)
        .eq("common_category", selectedCategory)
        .order("snapshot_date", { ascending: false })
        .order("rank", { ascending: true });

      if (selectedPlatform !== "all") {
        query = query.eq("platform", selectedPlatform);
      } else {
        // For 'all', just get current day's data
        query = query.eq("snapshot_date", new Date().toISOString().split('T')[0]);
      }

      const { data, error } = await query.limit(100);

      if (data) {
        setSnapshots(data);
      }
      setLoading(false);
    }
    fetchBestsellers();
  }, [selectedPlatform, selectedPeriod]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <div className="absolute top-3 left-3 z-10 bg-black/80 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm backdrop-blur-sm group-hover:scale-110 transition-transform">
                    {item.rank}
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
              <button 
                onClick={() => setSelectedBook(null)}
                className="mt-auto w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-lg hover:bg-black transition-all active:scale-95"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 p-8 flex flex-col">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h4 className="text-[10px] font-black tracking-widest text-[#355E3B] mb-1">RANKING TREND</h4>
                  <h3 className="text-2xl font-bold text-gray-900">플랫폼별 순위 변화</h3>
                </div>
                <span className="text-[10px] bg-gray-100 px-3 py-1 rounded-full font-bold text-gray-400">DAILY REPORT</span>
              </div>
              
              <div className="flex-1 min-h-[300px]">
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
                      domain={[1, 20]} 
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
