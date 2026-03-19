"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PLATFORMS = [
  { id: "kyobo", name: "교보문고", color: "#2C3E50" },
  { id: "yes24", name: "예스24", color: "#34495E" },
  { id: "aladdin", name: "알라딘", color: "#455A64" },
  { id: "ridi", name: "리디북스", color: "#546E7A" },
  { id: "millie", name: "밀리의서재", color: "#607D8B" },
];

export default function AnalyticsPage() {
  const [searchType, setSearchType] = useState("book"); // book | publisher
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("30"); // 7, 30, 90

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSelectedBook(null);
    setTrendData([]);

    try {
      if (searchType === "book") {
        // 도서명으로 검색
        const { data } = await supabase
          .from("bw_books")
          .select("*")
          .ilike("title", `%${searchQuery}%`)
          .limit(20);

        setResults(data || []);
      } else {
        // 출판사로 검색
        const { data } = await supabase
          .from("bw_books")
          .select("*")
          .ilike("publisher", `%${searchQuery}%`)
          .limit(50);

        setResults(data || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBookTrend(book) {
    setSelectedBook(book);
    setLoading(true);

    try {
      // 날짜 범위 계산
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      const { data } = await supabase
        .from("bw_bestseller_snapshots")
        .select("*")
        .eq("book_id", book.id)
        .gte("snapshot_date", startDate.toISOString().split('T')[0])
        .lte("snapshot_date", endDate.toISOString().split('T')[0])
        .order("snapshot_date", { ascending: true });

      // 데이터 변환 (차트용)
      const groupedByDate = {};

      data?.forEach(item => {
        const date = item.snapshot_date;
        if (!groupedByDate[date]) {
          groupedByDate[date] = { date };
        }
        groupedByDate[date][item.platform] = item.rank;
      });

      const chartData = Object.values(groupedByDate);
      setTrendData(chartData);

    } catch (error) {
      console.error("Trend load error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          📊 베스트셀러 트렌드 분석
        </h1>
        <p className="text-sm text-gray-600">출판사 또는 도서명으로 검색하여 순위 추이를 확인하세요</p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setSearchType("book")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              searchType === "book"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📚 도서명 검색
          </button>
          <button
            onClick={() => setSearchType("publisher")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              searchType === "publisher"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🏢 출판사 검색
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            placeholder={
              searchType === "book"
                ? "도서명을 입력하세요 (예: 트렌드 코리아)"
                : "출판사명을 입력하세요 (예: 위즈덤하우스)"
            }
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            검색
          </button>
        </div>
      </div>

      {/* Search Results */}
      {results.length > 0 && !selectedBook && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            검색 결과 ({results.length}개)
          </h2>
          <div className="space-y-2">
            {results.map((book) => (
              <div
                key={book.id}
                onClick={() => loadBookTrend(book)}
                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
              >
                <div className="flex-shrink-0 w-12 h-16 bg-gray-100 rounded overflow-hidden">
                  {book.cover_url && (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{book.title}</p>
                  <p className="text-xs text-gray-500">{book.author}</p>
                  <p className="text-xs text-gray-400">{book.publisher}</p>
                </div>
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book Trend Analysis */}
      {selectedBook && (
        <div className="space-y-6">
          {/* Back Button + Book Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <button
              onClick={() => {
                setSelectedBook(null);
                setTrendData([]);
              }}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              ← 검색 결과로 돌아가기
            </button>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-24 h-32 bg-gray-100 rounded overflow-hidden shadow-md">
                {selectedBook.cover_url && (
                  <img
                    src={selectedBook.cover_url}
                    alt={selectedBook.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedBook.title}</h2>
                <p className="text-sm text-gray-600 mb-1">저자: {selectedBook.author}</p>
                <p className="text-sm text-gray-600">출판사: {selectedBook.publisher}</p>
              </div>
            </div>
          </div>

          {/* Period Selector */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex gap-2">
              {[
                { value: "7", label: "최근 7일" },
                { value: "30", label: "최근 30일" },
                { value: "90", label: "최근 90일" }
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    setPeriod(p.value);
                    loadBookTrend(selectedBook);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    period === p.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trend Chart */}
          {trendData.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">순위 추이</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    reversed
                    domain={[1, 20]}
                    tick={{ fontSize: 12 }}
                    label={{ value: '순위', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  {PLATFORMS.map((platform) => (
                    <Line
                      key={platform.id}
                      type="monotone"
                      dataKey={platform.id}
                      name={platform.name}
                      stroke={platform.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">선택한 기간에 베스트셀러 데이터가 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !selectedBook && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-600 text-lg font-medium">검색어를 입력하여 분석을 시작하세요</p>
          <p className="text-gray-400 text-sm mt-2">
            출판사 또는 도서명으로 검색하면 순위 추이를 확인할 수 있습니다
          </p>
        </div>
      )}
    </div>
  );
}
