"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PLATFORMS = [
  { id: "kyobo", name: "교보문고", color: "#1E40AF" },
  { id: "yes24", name: "예스24", color: "#FF6B00" },
  { id: "aladdin", name: "알라딘", color: "#E62312" },
  { id: "ridi", name: "리디북스", color: "#5B4FFF" },
  { id: "millie", name: "밀리의서재", color: "#00C73C" },
];

const CATEGORIES = ["종합", "소설", "에세이/시", "인문", "경제경영", "자기계발", "사회과학", "역사", "예술", "종교", "과학", "기술/IT", "만화", "여행", "건강"];

// 제목 정규화 함수 (중복 제거용)
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .replace(/\([^)]*\)/g, '')  // 괄호 제거
    .replace(/\[[^\]]*\]/g, '')  // 대괄호 제거
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')  // 특수문자 제거
    .replace(/\s+/g, ' ')  // 연속 공백 정리
    .trim()
    .toLowerCase();
}

export default function AdminBestsellerPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("current"); // current | trend

  // Current dashboard states
  const [loading, setLoading] = useState(true);
  const [platformData, setPlatformData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("종합");
  const [selectedDate, setSelectedDate] = useState(() => {
    // 한국 시간 기준 오늘 날짜 (UTC+9)
    const now = new Date();
    const koreaOffset = 9 * 60; // 9시간을 분으로
    const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000);
    return koreaTime.toISOString().split('T')[0];
  });
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookDetails, setBookDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Trend analysis states
  const [searchType, setSearchType] = useState("book");
  const [searchQuery, setSearchQuery] = useState("");

  // 검색 타입 변경시 검색어 초기화
  const handleSearchTypeChange = (newType) => {
    setSearchType(newType);
    setSearchQuery("");
    setAutocompleteSuggestions([]);
    setShowAutocomplete(false);
  };
  const [searchResults, setSearchResults] = useState([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedTrendBook, setSelectedTrendBook] = useState(null);
  const [selectedBookGroup, setSelectedBookGroup] = useState(null); // 같은 책의 모든 변종
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    if (activeTab === "current") {
      fetchAllData();
    }
  }, [selectedCategory, selectedDate, activeTab]);

  // === CURRENT TAB FUNCTIONS ===
  async function fetchAllData() {
    setLoading(true);

    const { data } = await supabase
      .from("bw_bestseller_snapshots")
      .select(`
        rank,
        rank_change,
        platform,
        snapshot_date,
        is_ebook,
        bw_books!inner (
          id,
          isbn,
          title,
          author,
          publisher,
          cover_url,
          description,
          pub_date
        )
      `)
      .eq("period_type", "daily")
      .eq("common_category", selectedCategory)
      .eq("snapshot_date", selectedDate)
      .order("rank", { ascending: true });

    // Group by platform and remove duplicates
    const grouped = {};
    PLATFORMS.forEach(p => {
      const platformBooks = (data || []).filter(item => item.platform === p.id);

      // 중복 제거: 같은 rank에 여러 책이 있으면 첫 번째만 유지
      const seenRanks = new Set();
      const uniqueBooks = platformBooks.filter(book => {
        if (seenRanks.has(book.rank)) {
          return false; // 이미 본 rank면 제외
        }
        seenRanks.add(book.rank);
        return true;
      });

      grouped[p.id] = uniqueBooks.slice(0, 20);
    });

    setPlatformData(grouped);
    setLoading(false);
  }

  async function handleBookClick(book, platform) {
    setSelectedBook({ ...book, platform });
    setLoadingDetails(true);
    setBookDetails(null);

    try {
      let coverUrl = book.bw_books.cover_url;

      if (!coverUrl && book.bw_books.isbn) {
        const coverResponse = await fetch(`/api/aladin/lookup?isbn=${book.bw_books.isbn}&type=cover`);
        if (coverResponse.ok) {
          const coverData = await coverResponse.json();
          if (coverData.cover) {
            coverUrl = coverData.cover;
            await supabase
              .from('bw_books')
              .update({ cover_url: coverUrl })
              .eq('id', book.bw_books.id);
          }
        }
      }

      if (book.bw_books.isbn) {
        const response = await fetch(`/api/aladin/lookup?isbn=${book.bw_books.isbn}`);
        if (response.ok) {
          const data = await response.json();
          setBookDetails({ ...data, cover_url: coverUrl || data.cover });
        }
      } else {
        setBookDetails({
          title: book.bw_books.title,
          author: book.bw_books.author,
          publisher: book.bw_books.publisher,
          cover_url: coverUrl,
          description: "ISBN 정보가 없어 상세 정보를 불러올 수 없습니다."
        });
      }
    } catch (error) {
      console.error('Error fetching book details:', error);
      setBookDetails({
        title: book.bw_books.title,
        author: book.bw_books.author,
        publisher: book.bw_books.publisher,
        cover_url: book.bw_books.cover_url,
        description: "상세 정보를 불러오는데 실패했습니다."
      });
    } finally {
      setLoadingDetails(false);
    }
  }

  function closeModal() {
    setSelectedBook(null);
    setBookDetails(null);
  }

  // === TREND TAB FUNCTIONS ===
  // 자동완성 처리
  async function handleSearchInput(value) {
    setSearchQuery(value);

    if (value.trim().length < 2) {
      setAutocompleteSuggestions([]);
      setShowAutocomplete(false);
      return;
    }

    try {
      if (searchType === "book") {
        const { data } = await supabase
          .from("bw_books")
          .select("id, title, author, publisher, cover_url")
          .ilike("title", `%${value}%`)
          .limit(10);

        setAutocompleteSuggestions(data || []);
        setShowAutocomplete(true);
      } else {
        const { data } = await supabase
          .from("bw_books")
          .select("publisher")
          .ilike("publisher", `%${value}%`)
          .limit(10);

        // 출판사는 유니크하게
        const uniquePublishers = [...new Set(data?.map(b => b.publisher) || [])];
        setAutocompleteSuggestions(uniquePublishers.map(p => ({ publisher: p })));
        setShowAutocomplete(true);
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setTrendLoading(true);
    setSelectedTrendBook(null);
    setSelectedBookGroup(null);
    setTrendData([]);
    setShowAutocomplete(false);

    try {
      if (searchType === "book") {
        const { data } = await supabase
          .from("bw_books")
          .select("*")
          .ilike("title", `%${searchQuery}%`)
          .limit(50);

        // 정규화된 제목으로 그룹화
        const groups = {};
        (data || []).forEach(book => {
          const normalizedKey = normalizeTitle(book.title);
          if (!groups[normalizedKey]) {
            groups[normalizedKey] = [];
          }
          groups[normalizedKey].push(book);
        });

        // 각 그룹의 대표 책 선택 (ISBN 있는 것 우선, 없으면 첫 번째)
        const representatives = Object.values(groups).map(bookGroup => {
          const withIsbn = bookGroup.find(b => b.isbn);
          const representative = withIsbn || bookGroup[0];
          return {
            ...representative,
            _variants: bookGroup,  // 같은 책의 모든 변종 저장
            _variantCount: bookGroup.length
          };
        });

        setSearchResults(representatives);
      } else {
        const { data } = await supabase
          .from("bw_books")
          .select("*")
          .ilike("publisher", `%${searchQuery}%`)
          .limit(50);

        // 출판사 검색도 동일하게 그룹화 적용
        const groups = {};
        (data || []).forEach(book => {
          const normalizedKey = normalizeTitle(book.title);
          if (!groups[normalizedKey]) {
            groups[normalizedKey] = [];
          }
          groups[normalizedKey].push(book);
        });

        const representatives = Object.values(groups).map(bookGroup => {
          const withIsbn = bookGroup.find(b => b.isbn);
          const representative = withIsbn || bookGroup[0];
          return {
            ...representative,
            _variants: bookGroup,
            _variantCount: bookGroup.length
          };
        });

        setSearchResults(representatives);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setTrendLoading(false);
    }
  }

  async function loadBookTrend(book) {
    console.log('🔍 loadBookTrend 호출:', book?.title, book?.author);
    setSelectedTrendBook(book);
    setSelectedBookGroup(book._variants || [book]);
    setTrendLoading(true);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      console.log('📅 날짜 범위:', startDate.toISOString().split('T')[0], '~', endDate.toISOString().split('T')[0]);

      // 모든 변종의 book_id 수집
      const bookIds = (book._variants || [book]).map(b => b.id);
      console.log('📚 검색할 book_id:', bookIds);

      const { data, error } = await supabase
        .from("bw_bestseller_snapshots")
        .select("*")
        .in("book_id", bookIds)
        .gte("snapshot_date", startDate.toISOString().split('T')[0])
        .lte("snapshot_date", endDate.toISOString().split('T')[0])
        .order("snapshot_date", { ascending: true });

      if (error) {
        console.error('❌ 쿼리 에러:', error);
        setTrendData([]);
        return;
      }

      console.log('✅ 스냅샷 데이터:', data?.length, '개');

      const groupedByDate = {};

      data?.forEach(item => {
        const date = item.snapshot_date;
        if (!groupedByDate[date]) {
          groupedByDate[date] = { date };
        }

        // 같은 날짜, 같은 플랫폼에서 여러 변종이 있으면 가장 높은 순위(낮은 숫자) 사용
        const currentRank = groupedByDate[date][item.platform];
        if (!currentRank || item.rank < currentRank) {
          groupedByDate[date][item.platform] = item.rank;
        }
      });

      const chartData = Object.values(groupedByDate);
      console.log('📊 차트 데이터:', chartData.length, '개 날짜');
      console.log('차트 데이터 상세:', JSON.stringify(chartData, null, 2));
      setTrendData(chartData);

    } catch (error) {
      console.error("❌ Trend load error:", error);
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }

  if (loading && activeTab === "current") {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gray-700 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">베스트셀러</h1>
        <p className="text-xs md:text-sm text-gray-600">5개 서점 베스트셀러 현황 및 트렌드 분석 (교보/예스24/알라딘/리디/밀리)</p>
      </div>

      {/* Tab Switcher */}
      <div className="mb-4 md:mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("current")}
            className={`px-4 md:px-6 py-2 md:py-3 font-semibold text-sm md:text-base transition relative ${
              activeTab === "current"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            현황
            {activeTab === "current" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("trend")}
            className={`px-4 md:px-6 py-2 md:py-3 font-semibold text-sm md:text-base transition relative ${
              activeTab === "trend"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            트렌드
            {activeTab === "trend" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
            )}
          </button>
        </div>
      </div>

      {/* CURRENT TAB */}
      {activeTab === "current" && (
        <>
          {/* Category and Date Filter */}
          <div className="mb-4 md:mb-6 space-y-3">
            {/* Date Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">날짜:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={() => {
                  const now = new Date();
                  const koreaOffset = 9 * 60;
                  const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000);
                  setSelectedDate(koreaTime.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
              >
                오늘
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-gray-900 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Scroll Hint */}
          <div className="mb-2 lg:hidden">
            <p className="text-xs text-gray-500 text-center">← 좌우로 스크롤하여 모든 서점 확인 →</p>
          </div>

          {/* Platform Cards */}
          <div className="flex lg:grid lg:grid-cols-5 gap-3 md:gap-4 overflow-x-auto lg:overflow-visible pb-4 -mx-3 px-3 md:mx-0 md:px-0 snap-x snap-mandatory lg:snap-none scrollbar-hide">
            {PLATFORMS.map(platform => {
              const books = platformData[platform.id] || [];

              return (
                <div key={platform.id} className="flex-shrink-0 lg:flex-shrink w-[260px] md:w-[300px] lg:w-auto bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden snap-start lg:snap-align-none">
                  <div
                    className="px-3 md:px-4 py-2 md:py-3 text-white font-bold text-sm md:text-base"
                    style={{ backgroundColor: platform.color }}
                  >
                    {platform.name}
                  </div>

                  <div className="divide-y divide-gray-100">
                    {books.length > 0 ? (
                      books.map((book, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleBookClick(book, platform.name)}
                          className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 hover:bg-gray-50 cursor-pointer transition ${
                            book.is_ebook ? 'opacity-60' : ''
                          }`}
                        >
                          <div className={`flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 ${
                            book.is_ebook ? 'w-4 h-4 md:w-5 md:h-5 text-[10px]' : 'w-5 h-5 md:w-6 md:h-6 text-xs'
                          }`}>
                            {book.rank}
                          </div>

                          <div className={`flex-shrink-0 bg-gray-100 rounded overflow-hidden ${
                            book.is_ebook ? 'w-7 h-10 md:w-8 md:h-11' : 'w-9 h-12 md:w-10 md:h-14'
                          }`}>
                            {book.bw_books.cover_url ? (
                              <img
                                src={book.bw_books.cover_url}
                                alt={book.bw_books.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                📚
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-gray-900 truncate mb-0.5 leading-tight ${
                              book.is_ebook ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'
                            }`}>
                              {book.bw_books.title}
                              {book.is_ebook && <span className="ml-1 text-[9px] text-gray-400">[전자책]</span>}
                            </p>
                            <p className={`text-gray-500 truncate ${
                              book.is_ebook ? 'text-[9px] md:text-[10px]' : 'text-[10px] md:text-xs'
                            }`}>
                              {book.bw_books.author}
                            </p>
                          </div>

                          {book.rank_change !== null && book.rank_change !== 0 && (
                            <div className="flex-shrink-0">
                              {book.rank_change < 0 ? (
                                <span className="text-red-500 text-xs font-bold">
                                  ↑{Math.abs(book.rank_change)}
                                </span>
                              ) : (
                                <span className="text-blue-500 text-xs font-bold">
                                  ↓{book.rank_change}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        데이터 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Book Details Modal */}
          {selectedBook && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 md:p-4 z-50"
              onClick={closeModal}
            >
              <div
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-gray-900 text-white px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                  <h2 className="text-base md:text-lg font-bold">도서 상세정보</h2>
                  <button
                    onClick={closeModal}
                    className="text-white hover:text-gray-300 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="p-4 md:p-6">
                  {loadingDetails ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-gray-700 mx-auto mb-4"></div>
                      <p className="text-gray-600">상세 정보 불러오는 중...</p>
                    </div>
                  ) : bookDetails ? (
                    <div>
                      <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-6">
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                          <div className="w-32 h-44 md:w-40 md:h-56 bg-gray-100 rounded-lg overflow-hidden shadow-md">
                            {bookDetails.cover_url ? (
                              <img
                                src={bookDetails.cover_url}
                                alt={bookDetails.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl md:text-4xl">
                                📚
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1">
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-2">{bookDetails.title}</h3>

                          <div className="space-y-2 text-sm">
                            {bookDetails.author && (
                              <div className="flex">
                                <span className="text-gray-500 w-20">저자</span>
                                <span className="text-gray-900 font-medium">{bookDetails.author}</span>
                              </div>
                            )}
                            {bookDetails.publisher && (
                              <div className="flex">
                                <span className="text-gray-500 w-20">출판사</span>
                                <span className="text-gray-900">{bookDetails.publisher}</span>
                              </div>
                            )}
                            {bookDetails.pubDate && (
                              <div className="flex">
                                <span className="text-gray-500 w-20">발행일</span>
                                <span className="text-gray-900">{bookDetails.pubDate}</span>
                              </div>
                            )}
                            {bookDetails.isbn && (
                              <div className="flex">
                                <span className="text-gray-500 w-20">ISBN</span>
                                <span className="text-gray-700 font-mono text-xs">{bookDetails.isbn}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {bookDetails.description && (
                        <div className="border-t pt-4">
                          <h4 className="font-bold text-gray-900 mb-2">책 소개</h4>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                            {bookDetails.description}
                          </p>
                        </div>
                      )}

                      <div className="mt-6 flex gap-2">
                        <button
                          onClick={async () => {
                            setLoadingDetails(true);
                            try {
                              const bookId = selectedBook.bw_books.id;
                              const toUpdate = {
                                publisher: bookDetails?.publisher || selectedBook.bw_books.publisher,
                                pub_date: bookDetails?.pubDate || selectedBook.bw_books.pub_date,
                                isbn: bookDetails?.isbn || selectedBook.bw_books.isbn,
                                description: bookDetails?.description || selectedBook.bw_books.description,
                                cover_url: bookDetails?.cover_url || bookDetails?.cover || selectedBook.bw_books.cover_url
                              };
                              
                              const { error } = await supabase.from('bw_books').update(toUpdate).eq('id', bookId);
                              if (error) throw error;
                              alert('도서 정보가 성공적으로 업데이트되었습니다.');
                              fetchAllData();
                            } catch (err) {
                              console.error('Update error:', err);
                              alert('업데이트 중 오류가 발생했습니다.');
                            } finally {
                              setLoadingDetails(false);
                            }
                          }}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                        >
                          🔄 알라딘 정보로 동기화
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      정보를 불러올 수 없습니다
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TREND TAB */}
      {activeTab === "trend" && (
        <div>
          {/* Search Box */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => handleSearchTypeChange("book")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                  searchType === "book"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📚 도서명 검색
              </button>
              <button
                onClick={() => handleSearchTypeChange("publisher")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                  searchType === "publisher"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                🏢 출판사 검색
              </button>
            </div>

            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  onFocus={() => autocompleteSuggestions.length > 0 && setShowAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                  placeholder={
                    searchType === "book"
                      ? "도서명을 입력하세요 (예: 트렌드 코리아)"
                      : "출판사명을 입력하세요 (예: 위즈덤하우스)"
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />

                {/* Autocomplete Dropdown */}
                {showAutocomplete && autocompleteSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
                    {searchType === "book" ? (
                      autocompleteSuggestions.map((book, idx) => (
                        <div
                          key={idx}
                          onClick={async () => {
                            setShowAutocomplete(false);
                            setTrendLoading(true);

                            // 선택한 책의 모든 변종 찾기
                            const { data } = await supabase
                              .from("bw_books")
                              .select("*")
                              .eq("id", book.id);

                            if (data && data.length > 0) {
                              const selectedBook = data[0];
                              // 같은 책의 다른 변종들 찾기
                              const normalizedKey = normalizeTitle(selectedBook.title);
                              const { data: allVariants } = await supabase
                                .from("bw_books")
                                .select("*")
                                .limit(50);

                              const variants = (allVariants || []).filter(b =>
                                normalizeTitle(b.title) === normalizedKey
                              );

                              const bookWithVariants = {
                                ...selectedBook,
                                _variants: variants,
                                _variantCount: variants.length
                              };

                              await loadBookTrend(bookWithVariants);
                            }

                            setTrendLoading(false);
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="flex-shrink-0 w-10 h-14 bg-gray-100 rounded overflow-hidden">
                            {book.cover_url && (
                              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{book.title}</p>
                            <p className="text-xs text-gray-500 truncate">{book.author}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      autocompleteSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchQuery(item.publisher);
                            setShowAutocomplete(false);
                            handleSearch();
                          }}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <p className="font-medium text-sm text-gray-900">{item.publisher}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={trendLoading}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
              >
                검색
              </button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && !selectedTrendBook && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                검색 결과 ({searchResults.length}개)
              </h2>
              <div className="space-y-2">
                {searchResults.map((book) => (
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
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{book.title}</p>
                        {book._variantCount > 1 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            {book._variantCount}개 버전
                          </span>
                        )}
                      </div>
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
          {selectedTrendBook && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <button
                  onClick={() => {
                    setSelectedTrendBook(null);
                    setTrendData([]);
                  }}
                  className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  ← 검색 결과로 돌아가기
                </button>

                <div className="flex gap-4 mb-4">
                  <div className="flex-shrink-0 w-24 h-32 bg-gray-100 rounded overflow-hidden shadow-md">
                    {selectedTrendBook.cover_url && (
                      <img
                        src={selectedTrendBook.cover_url}
                        alt={selectedTrendBook.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedTrendBook.title}</h2>
                    <p className="text-sm text-gray-600 mb-1">저자: {selectedTrendBook.author}</p>
                    <p className="text-sm text-gray-600">출판사: {selectedTrendBook.publisher}</p>
                  </div>
                </div>

                {/* 변종 목록 */}
                {selectedBookGroup && selectedBookGroup.length > 1 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-2">
                      📚 이 책의 다른 버전 ({selectedBookGroup.length}개)
                    </p>
                    <div className="space-y-1">
                      {selectedBookGroup.map((variant, idx) => (
                        <div key={variant.id} className="text-xs text-gray-500 pl-4">
                          {idx + 1}. {variant.title} {variant.isbn && `(ISBN: ${variant.isbn})`}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 pl-4">
                      * 차트는 모든 버전의 데이터를 통합하여 표시합니다
                    </p>
                  </div>
                )}
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
                        loadBookTrend(selectedTrendBook);
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
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📈 베스트셀러 순위 추이 차트</h3>
                  <p className="text-xs text-gray-500 mb-4">* 순위가 낮을수록(1위에 가까울수록) 그래프가 위로 올라갑니다</p>
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        reversed
                        domain={[1, 20]}
                        ticks={[1, 5, 10, 15, 20]}
                        tick={{ fontSize: 12 }}
                        label={{ value: '순위 (낮을수록 상위)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="line"
                      />
                      {PLATFORMS.map((platform) => (
                        <Line
                          key={platform.id}
                          type="monotone"
                          dataKey={platform.id}
                          name={platform.name}
                          stroke={platform.color}
                          strokeWidth={3}
                          dot={{ r: 5, fill: platform.color, strokeWidth: 2, stroke: 'white' }}
                          activeDot={{ r: 7 }}
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
          {searchResults.length === 0 && !selectedTrendBook && !trendLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-600 text-lg font-medium">검색어를 입력하여 분석을 시작하세요</p>
              <p className="text-gray-400 text-sm mt-2">
                출판사 또는 도서명으로 검색하면 순위 추이를 확인할 수 있습니다
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
