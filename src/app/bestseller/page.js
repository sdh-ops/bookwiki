"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { generateBookReport, generatePublisherReport } from "@/lib/reportGenerator";

const PLATFORMS = [
  { id: "kyobo", name: "교보문고", color: "#1E40AF" },
  { id: "yes24", name: "예스24", color: "#FF6B00" },
  { id: "aladin", name: "알라딘", color: "#FBBE00" },
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

export default function BestsellerPage() {
  const [activeTab, setActiveTab] = useState("current"); // current | trend
  const [loading, setLoading] = useState(true);
  const [platformData, setPlatformData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("종합");
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const koreaOffset = 9 * 60; 
    const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000);
    // 데이터는 보통 어제 날짜까지 있으므로 어제로 설정
    koreaTime.setDate(koreaTime.getDate() - 1);
    return koreaTime.toISOString().split('T')[0];
  });

  const [selectedBook, setSelectedBook] = useState(null);
  const [bookDetails, setBookDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Navigation states
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Trend analysis states
  const [searchType, setSearchType] = useState("book");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedTrendBook, setSelectedTrendBook] = useState(null);
  const [selectedBookGroup, setSelectedBookGroup] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [period, setPeriod] = useState("30");
  const [publisherHighlight, setPublisherHighlight] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [publisherInsights, setPublisherInsights] = useState(null);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        try {
          const { data: adminData } = await supabase
            .from("bw_admins")
            .select("email")
            .eq("email", user.email)
            .maybeSingle();
          setIsAdmin(!!adminData);
        } catch (e) {
          console.log("Admin check error:", e);
        }
      }
    }
    checkUser();
  }, []);

  useEffect(() => {
    if (activeTab === "current") {
      fetchAllData();
    }
  }, [selectedCategory, selectedDate, activeTab]);

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

    const grouped = {};
    PLATFORMS.forEach(p => {
      const platformBooks = (data || []).filter(item => item.platform === p.id);
      const seenRanks = new Set();
      const uniqueBooks = platformBooks.filter(book => {
        if (seenRanks.has(book.rank)) return false;
        seenRanks.add(book.rank);
        return true;
      });
      grouped[p.id] = uniqueBooks.slice(0, 20);
    });

    setPlatformData(grouped);
    
    // Insights calculation
    if (data && data.length > 0) {
      const pubMap = {};
      data.forEach(item => {
        const pub = item.bw_books.publisher;
        if (pub) pubMap[pub] = (pubMap[pub] || 0) + 1;
      });
      const topPublishers = Object.entries(pubMap)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5);
      
      const ourBooks = publisherHighlight 
        ? data.filter(item => item.bw_books.publisher?.includes(publisherHighlight))
        : [];

      setPublisherInsights({ topPublishers, ourBooks, allBooks: data });
    }
    
    setLoading(false);
  }

  async function handleBookClick(book, platform) {
    setSelectedBook({ ...book, platform });
    setLoadingDetails(true);
    setBookDetails(null);

    try {
      if (book.bw_books.description) {
        setBookDetails({
          title: book.bw_books.title,
          author: book.bw_books.author,
          publisher: book.bw_books.publisher,
          description: book.bw_books.description
        });
      } else if (book.bw_books.isbn) {
        const response = await fetch(`/api/aladin/lookup?isbn=${book.bw_books.isbn}`);
        if (response.ok) {
          const data = await response.json();
          setBookDetails({ ...data }); // No cover
        } else {
          // Fallback to title/author search if ISBN lookup fails (e.g. invalid ISBN)
          const fallbackRes = await fetch(`/api/aladin/lookup?title=${encodeURIComponent(book.bw_books.title)}&author=${encodeURIComponent(book.bw_books.author || '')}`);
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            setBookDetails({ ...data });
          } else {
            setBookDetails({
              title: book.bw_books.title,
              author: book.bw_books.author,
              publisher: book.bw_books.publisher,
              description: "상세 정보를 찾을 수 없습니다."
            });
          }
        }
      } else {
        // Fallback to title/author search directly if no ISBN is available
        const titleRes = await fetch(`/api/aladin/lookup?title=${encodeURIComponent(book.bw_books.title)}&author=${encodeURIComponent(book.bw_books.author || '')}`);
        if (titleRes.ok) {
          const data = await titleRes.json();
          setBookDetails({ ...data });
        } else {
          setBookDetails({
            title: book.bw_books.title,
            author: book.bw_books.author,
            publisher: book.bw_books.publisher,
            description: "ISBN 정보가 없어 상세 정보를 불러올 수 없습니다."
          });
        }
      }
    } catch (error) {
      setBookDetails({
        title: book.bw_books.title,
        author: book.bw_books.author,
        publisher: book.bw_books.publisher,
        description: "상세 정보를 불러오는데 실패했습니다."
      });
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSearchInput(value, isFocus = false) {
    if (!isFocus) setSearchQuery(value);
    const term = isFocus ? value.trim() : value;

    try {
      if (searchType === "book") {
        if (term.length < 2) {
          const { data } = await supabase.from("bw_books").select("id, title, author, publisher, cover_url").order("id", { ascending: false }).limit(7);
          setAutocompleteSuggestions(data || []);
        } else {
          const { data } = await supabase.from("bw_books").select("id, title, author, publisher, cover_url").ilike("title", `%${term}%`).limit(10);
          setAutocompleteSuggestions(data || []);
        }
      } else {
        if (term.length < 2) {
          const defaultPubs = ["더난출판사", "웅진지식하우스", "문학동네", "다산북스", "김영사", "민음사", "위즈덤하우스"];
          setAutocompleteSuggestions(defaultPubs.map(p => ({ publisher: p })));
        } else {
          const { data } = await supabase.from("bw_books").select("publisher").ilike("publisher", `%${term}%`).limit(15);
          const uniquePublishers = [...new Set(data?.map(b => b.publisher) || [])];
          setAutocompleteSuggestions(uniquePublishers.map(p => ({ publisher: p })));
        }
      }
      setShowAutocomplete(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setTrendLoading(true);
    setSelectedTrendBook(null);
    setTrendData([]);
    setShowAutocomplete(false);

    try {
      const { data } = await supabase
        .from("bw_books")
        .select("*")
        .ilike(searchType === "book" ? "title" : "publisher", `%${searchQuery}%`)
        .limit(50);

      const groups = {};
      (data || []).forEach(book => {
        const normalizedKey = normalizeTitle(book.title);
        if (!groups[normalizedKey]) groups[normalizedKey] = [];
        groups[normalizedKey].push(book);
      });

      const representatives = Object.values(groups).map(bookGroup => {
        const withIsbn = bookGroup.find(b => b.isbn);
        return { ...(withIsbn || bookGroup[0]), _variants: bookGroup, _variantCount: bookGroup.length };
      });

      setSearchResults(representatives);
    } catch (e) {} finally {
      setTrendLoading(false);
    }
  }

  async function loadBookTrend(book) {
    setSelectedTrendBook(book);
    setSelectedBookGroup(book._variants || [book]);
    setTrendLoading(true);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      const bookIds = (book._variants || [book]).map(b => b.id);

      const { data } = await supabase
        .from("bw_bestseller_snapshots")
        .select("*")
        .in("book_id", bookIds)
        .gte("snapshot_date", startDate.toISOString().split('T')[0])
        .order("snapshot_date", { ascending: true });

      const groupedByDate = {};
      data?.forEach(item => {
        const date = item.snapshot_date;
        if (!groupedByDate[date]) groupedByDate[date] = { date };
        if (!groupedByDate[date][item.platform] || item.rank < groupedByDate[date][item.platform]) {
          groupedByDate[date][item.platform] = item.rank;
        }
      });
      setTrendData(Object.values(groupedByDate));
    } catch (e) {} finally {
      setTrendLoading(false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const boardCategories = [
    { name: "전체", id: "all" },
    { name: "HOT", id: "hot" },
    { name: "구인구직", id: "job" },
    { name: "지원사업", id: "support" },
    { name: "톡톡", id: "free" },
    { name: "베스트셀러", id: "bestseller", href: "/bestseller" },
    { name: "AI허브", id: "ai" },
  ];

  const handleBoardClick = (cat) => {
    if (cat.href) {
      router.push(cat.href);
      return;
    }
    if (cat.id === "all") {
      router.push("/");
    } else {
      router.push(`/?board=${cat.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-[#355E3B] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-2xl font-bold tracking-tighter md:pointer-events-none"
            >
              북위키
            </button>
            <nav className="hidden md:flex space-x-4 text-sm font-medium">
              {boardCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleBoardClick(cat)}
                  className={`hover:underline ${cat.id === "bestseller" ? "font-bold underline" : ""}`}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {isAdmin && (
              <Link href="/admin" className="hidden md:block text-xs font-bold bg-red-500 px-3 py-1.5 rounded hover:bg-red-600 transition">
                관리자
              </Link>
            )}
            {user ? (
              <div className="hidden md:flex items-center space-x-3">
                <span className="text-xs text-white/60">{user.user_metadata?.nickname || user.email?.split('@')[0]}</span>
                <Link href="/mypage" className="text-xs text-white/80 hover:text-white">내 활동</Link>
                <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">로그아웃</button>
              </div>
            ) : (
              <Link href="/login" className="hidden md:block text-sm border border-white/30 px-3 py-1 rounded hover:bg-white/10">로그인</Link>
            )}
            {user ? (
              <button
                onClick={handleLogout}
                className="md:hidden text-xs border border-white/30 px-2 py-1 rounded hover:bg-white/10"
              >
                로그아웃
              </button>
            ) : (
              <Link href="/login" className="md:hidden text-xs border border-white/30 px-2 py-1 rounded hover:bg-white/10">
                로그인
              </Link>
            )}
          </div>
        </div>
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#2A4A2E] border-t border-[#355E3B]">
            <nav className="max-w-6xl mx-auto px-4 py-2 space-y-1">
              {boardCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { handleBoardClick(cat); setMobileMenuOpen(false); }}
                  className={`block w-full text-left px-3 py-2 text-sm rounded ${cat.id === "bestseller" ? "bg-[#355E3B] font-bold" : "hover:bg-[#355E3B]/50"}`}
                >
                  {cat.name}
                </button>
              ))}
              <div className="border-t border-[#355E3B] pt-2 mt-2">
                {user ? (
                  <>
                    <Link href="/mypage" className="block px-3 py-2 text-sm hover:bg-[#355E3B]/50 rounded">내 활동</Link>
                    <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm hover:bg-[#355E3B]/50 rounded">로그아웃</button>
                  </>
                ) : (
                  <Link href="/login" className="block px-3 py-2 text-sm hover:bg-[#355E3B]/50 rounded">로그인/회원가입</Link>
                )}
                {isAdmin && <Link href="/admin" className="block px-3 py-2 text-sm text-red-300 hover:bg-[#355E3B]/50 rounded">관리자</Link>}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* TAB CONTROLS */}
        <div className="flex justify-center mb-8">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm shadow-sm bg-white">
            <button
              onClick={() => setActiveTab("current")}
              className={`px-8 py-2.5 transition-all font-bold ${activeTab === "current" ? "bg-[#355E3B] text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              현재 현황
            </button>
            <button
              onClick={() => setActiveTab("trend")}
              className={`px-8 py-2.5 transition-all font-bold ${activeTab === "trend" ? "bg-[#355E3B] text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              트렌드 분석
            </button>
          </div>
        </div>

        {/* CURRENT TAB */}
        {activeTab === "current" && (
          <>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm justify-between items-start md:items-center">
              <div className="flex flex-wrap gap-2 w-full md:flex-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-md text-[13px] font-bold transition whitespace-nowrap ${selectedCategory === cat ? "bg-[#355E3B] text-white" : "bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="강조할 출판사 입력..."
                    value={publisherHighlight}
                    onChange={(e) => setPublisherHighlight(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-transparent rounded-lg text-[13px] font-medium focus:outline-none focus:border-[#355E3B] focus:bg-white transition-all w-52"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-[13px] font-medium focus:outline-none focus:border-[#355E3B] transition-colors"
                />
              </div>
            </div>

            {/* Publisher Insights Summary (Visible when publisher is set) */}
            {publisherHighlight && publisherInsights && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-[#355E3B] text-white p-6 rounded-2xl border border-[#355E3B] shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="relative">
                    <h3 className="text-xl font-black mb-1 flex items-center gap-2">
                       🏢 {publisherHighlight} <span className="text-xs font-normal opacity-80">마켓 인사이트</span>
                    </h3>
                    <p className="text-sm opacity-90 font-medium">검색된 베스트셀러: <span className="font-black text-white">{publisherInsights.ourBooks.length}</span>권</p>
                  </div>
                  
                  {/* Report Download removed */}
                </div>
              </div>
            )}

            {/* Platform Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {PLATFORMS.map(platform => {
                const books = platformData[platform.id] || [];
                return (
                  <div key={platform.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[750px]">
                    <div className="py-2.5 px-4 text-white font-bold text-sm text-center tracking-wider bg-gray-800" style={{ backgroundColor: platform.color }}>
                      {platform.name}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-hide">
                      {loading ? (
                        <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#355E3B]"></div></div>
                      ) : books.length > 0 ? (
                        books.map((item, idx) => {
                          const isHighlighted = publisherHighlight && item.bw_books.publisher?.includes(publisherHighlight);
                          return (
                            <div
                              key={idx}
                              onClick={() => handleBookClick(item, platform.name)}
                              className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all border border-transparent group leading-tight ${isHighlighted ? "bg-[#355E3B]/10 border-[#355E3B]/20" : "hover:bg-gray-50 hover:border-gray-100"}`}
                            >
                              <span className={`text-[11px] font-bold w-4 mt-0.5 text-center shrink-0 ${isHighlighted ? "text-[#355E3B]" : "text-gray-300 group-hover:text-[#355E3B]"}`}>{item.rank}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] font-bold truncate mb-0.5 ${isHighlighted ? "text-[#355E3B]" : "text-gray-900"}`}>{item.bw_books.title}</p>
                                <p className="text-[11px] text-gray-500 truncate mb-0.5">{item.bw_books.author}</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {item.bw_books.publisher}
                                    {item.bw_books.pub_date && ` | ${item.bw_books.pub_date.split('-').slice(0,3).join('.').substring(2)}`}
                                  </p>
                                  {item.rank_change !== 0 && (
                                    <span className={`text-[9px] font-bold shrink-0 ${item.rank_change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                      {item.rank_change > 0 ? `▲${item.rank_change}` : `▼${Math.abs(item.rank_change)}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : <div className="h-full flex items-center justify-center text-sm text-gray-300">데이터가 없습니다.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TREND TAB */}
        {activeTab === "trend" && (
          <div className="max-w-5xl mx-auto py-4">
            {/* Search Dashboard */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-10 relative">
               <div className="relative">
                  <div className="flex gap-2 mb-6">
                    {["book", "publisher"].map(t => (
                      <button
                        key={t}
                        onClick={() => setSearchType(t)}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${searchType === t ? "bg-[#355E3B] text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
                      >
                        {t === "book" ? "📚 도서명 검색" : "🏢 출판사 검색"}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={(e) => handleSearchInput(e.target.value, true)}
                        onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                        placeholder={searchType === "book" ? "도서 제목을 찾아보세요..." : "출판사 이름을 입력하세요..."}
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#355E3B]/20 transition-all placeholder:text-gray-300"
                      />
                      {showAutocomplete && autocompleteSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                          {autocompleteSuggestions.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                if (searchType === "book") { loadBookTrend(item); }
                                else { setSearchQuery(item.publisher); handleSearch(); }
                                setShowAutocomplete(false);
                              }}
                              className="px-6 py-3.5 hover:bg-gray-50 cursor-pointer flex items-center gap-4 border-b border-gray-50 last:border-none transition-colors"
                            >
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{item.title || item.publisher}</p>
                                {item.author && <p className="text-xs text-gray-400 mt-0.5">{item.author}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={handleSearch}
                      className="px-8 bg-[#355E3B] text-white rounded-xl font-bold hover:bg-[#2A4A2E] transition-all shadow-md active:scale-95"
                    >
                      검색
                    </button>
                  </div>
               </div>
            </div>

            {/* Results / Chart Area */}
            {selectedTrendBook ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-10">
                  <button onClick={() => { setSelectedTrendBook(null); setTrendData([]); }} className="mb-8 text-sm font-bold text-gray-400 hover:text-black transition-colors flex items-center gap-2">
                    <span className="text-lg">←</span> 목록으로 돌아가기
                  </button>
                  <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
                    <div className="flex-1">
                      <span className="bg-[#355E3B]/10 text-[#355E3B] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Best Seller Trend</span>
                      <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">{selectedTrendBook.title}</h2>
                      <div className="space-y-2 text-gray-500 font-medium">
                        <p>저자: <span className="text-gray-900">{selectedTrendBook.author}</span></p>
                        <p>출판사: <span className="text-gray-900">{selectedTrendBook.publisher}</span></p>
                      </div>
                      
                      {/* PDF extraction removed */}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-10 h-[600px] flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      <span className="w-2 h-8 bg-[#355E3B] rounded-full"></span>
                      플랫폼별 순위 히스토리
                    </h3>
                    <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
                      {["7", "30", "90"].map(d => (
                        <button key={d} onClick={() => { setPeriod(d); loadBookTrend(selectedTrendBook); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${period === d ? "bg-white text-black shadow-sm" : "text-gray-400"}`}>
                          {d}일
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F8F9FA" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={15} />
                        <YAxis reversed domain={[1, 50]} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '800' }} />
                        <Legend wrapperStyle={{ paddingTop: '30px' }} iconType="circle" />
                        {PLATFORMS.map(p => (
                          <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={5} dot={{ r: 6, strokeWidth: 3, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((book, idx) => (
                    <div key={idx} onClick={() => loadBookTrend(book)} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:border-[#355E3B] transition-all cursor-pointer flex gap-5 items-center group">
                        <div className="flex-1 min-w-0">
                           <p className="text-base font-bold text-gray-900 truncate group-hover:text-[#355E3B] transition-colors">{book.title}</p>
                           <p className="text-sm text-gray-500 font-medium mt-1">
                             {book.author} · {book.publisher} 
                             {book.pub_date && <span className="ml-2 text-gray-400 text-xs">({book.pub_date})</span>}
                           </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#355E3B] group-hover:text-white transition-all">
                          <span className="text-xs">→</span>
                        </div>
                    </div>
                  ))}
               </div>
            ) : (
              <div className="py-20 text-center">
                 <div className="text-6xl mb-6">📉</div>
                 <p className="text-xl font-black text-gray-400">데이터 수집 주기: 매일 아침 06:00 (KST)</p>
                 <p className="text-sm text-gray-300 mt-2 font-bold tracking-widest uppercase">Select a book or publisher to analyze trend</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Book Details Modal */}
      {selectedBook && !selectedTrendBook && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all text-sm">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-8 overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-10 mb-10">
                   <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-black text-gray-900 mb-2">{selectedBook.bw_books?.title}</h3>
                      <p className="text-gray-500 font-bold mb-6 italic">
                        {selectedBook.bw_books?.author} · {selectedBook.bw_books?.publisher}
                        {selectedBook.bw_books?.pub_date && <span className="ml-2 font-normal text-xs not-italic">({selectedBook.bw_books.pub_date} 출간)</span>}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                         <span className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-400">ISBN: {selectedBook.bw_books?.isbn || 'N/A'}</span>
                         {selectedBook.platform && (
                           <span className="px-3 py-1 bg-[#355E3B]/10 rounded-lg text-[10px] font-black text-[#355E3B]">{selectedBook.platform} {selectedBook.rank}위</span>
                         )}
                      </div>
                   </div>
                </div>

                <div className="border-t border-gray-50 pt-8">
                   <h4 className="text-xs font-black tracking-widest text-[#355E3B] mb-4 uppercase">Description</h4>
                   <p className="text-sm text-gray-600 leading-relaxed font-medium">
                      {loadingDetails ? "상세 정보를 가져오고 있습니다..." : bookDetails?.description || "정보가 없습니다."}
                   </p>
                </div>
             </div>
             
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2">
                <button 
                   onClick={() => { setSelectedBook(null); }}
                   className="flex-1 min-w-[120px] py-3 bg-[#355E3B] text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
                >
                   확인
                </button>
                {isAdmin && (
                  <button 
                    onClick={async () => {
                      setLoadingDetails(true);
                      try {
                          const bookId = selectedBook.bw_books.id;
                          // Use bookDetails from Aladin or current book info
                          const toUpdate = {
                            publisher: bookDetails?.publisher || selectedBook.bw_books.publisher,
                            pub_date: bookDetails?.pubDate || selectedBook.bw_books.pub_date,
                            isbn: bookDetails?.isbn || selectedBook.bw_books.isbn,
                            description: bookDetails?.description || selectedBook.bw_books.description,
                            cover_url: bookDetails?.cover || selectedBook.bw_books.cover_url
                          };
                          
                          const { error } = await supabase.from('bw_books').update(toUpdate).eq('id', bookId);
                          if (error) throw error;
                          alert('도서 정보가 성공적으로 업데이트되었습니다.');
                          fetchAllData(); // Refresh list
                      } catch (err) {
                          console.error('Update error:', err);
                          alert('업데이트 중 오류가 발생했습니다.');
                      } finally {
                          setLoadingDetails(false);
                      }
                    }}
                    className="flex-1 min-w-[120px] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>🔄</span> 정보 업데이트
                  </button>
                )}
                <button 
                   onClick={() => { 
                      const b = selectedBook.bw_books || selectedBook;
                      loadBookTrend({ ...b, _variants: [b], _variantCount: 1 });
                      setSelectedBook(null);
                      setActiveTab("trend");
                   }}
                   className="flex-1 min-w-[120px] px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-500 hover:text-black transition-all"
                >
                   트렌드 보기
                </button>
              </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-4 py-20 border-t border-gray-100 text-center">
         <p className="text-[10px] font-black text-gray-300 tracking-[0.2em] uppercase">Powered by BookWiki Data Intelligence</p>
      </footer>

      <style jsx global>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #ccc; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
