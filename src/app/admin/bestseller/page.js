"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const PLATFORMS = [
  { id: "kyobo", name: "교보문고", color: "#2C3E50" },
  { id: "yes24", name: "예스24", color: "#34495E" },
  { id: "aladdin", name: "알라딘", color: "#455A64" },
  { id: "ridi", name: "리디북스", color: "#546E7A" },
  { id: "millie", name: "밀리의서재", color: "#607D8B" },
];

const CATEGORIES = ["종합", "소설", "에세이/시", "인문", "경제경영", "자기계발"];

export default function AdminBestsellerDashboard() {
  const [loading, setLoading] = useState(true);
  const [platformData, setPlatformData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("종합");
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookDetails, setBookDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
          isbn,
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

    // Group by platform
    const grouped = {};
    PLATFORMS.forEach(p => {
      grouped[p.id] = (data || [])
        .filter(item => item.platform === p.id)
        .slice(0, 20); // Top 20 per platform
    });

    setPlatformData(grouped);
    setLoading(false);
  }

  async function handleBookClick(book, platform) {
    setSelectedBook({ ...book, platform });
    setLoadingDetails(true);
    setBookDetails(null);

    try {
      // First, try to fetch missing cover from Aladin if needed
      let coverUrl = book.bw_books.cover_url;

      if (!coverUrl && book.bw_books.isbn) {
        const coverResponse = await fetch(`/api/aladin/lookup?isbn=${book.bw_books.isbn}&type=cover`);
        if (coverResponse.ok) {
          const coverData = await coverResponse.json();
          if (coverData.cover) {
            coverUrl = coverData.cover;
            // Update cover in database
            await supabase
              .from('bw_books')
              .update({ cover_url: coverUrl })
              .eq('id', book.bw_books.id);
          }
        }
      }

      // Fetch book details from Aladin API
      if (book.bw_books.isbn) {
        const response = await fetch(`/api/aladin/lookup?isbn=${book.bw_books.isbn}`);
        if (response.ok) {
          const data = await response.json();
          setBookDetails({ ...data, cover_url: coverUrl || data.cover });
        }
      } else {
        // If no ISBN, show basic info
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

  if (loading) {
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">베스트셀러 현황</h1>
        <p className="text-sm text-gray-600">5개 서점 베스트셀러 · {new Date().toLocaleDateString('ko-KR')}</p>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
        {PLATFORMS.map(platform => {
          const books = platformData[platform.id] || [];

          return (
            <div key={platform.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Platform Header */}
              <div
                className="px-4 py-3 text-white font-bold text-base"
                style={{ backgroundColor: platform.color }}
              >
                {platform.name}
              </div>

              {/* Book List */}
              <div className="divide-y divide-gray-100">
                {books.length > 0 ? (
                  books.map((book, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleBookClick(book, platform.name)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition"
                    >
                      {/* Rank Badge */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">
                        {book.rank}
                      </div>

                      {/* Cover Image */}
                      <div className="flex-shrink-0 w-10 h-14 bg-gray-100 rounded overflow-hidden">
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

                      {/* Book Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate mb-0.5">
                          {book.bw_books.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {book.bw_books.author}
                        </p>
                      </div>

                      {/* Rank Change Indicator */}
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">도서 상세정보</h2>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {loadingDetails ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-gray-700 mx-auto mb-4"></div>
                  <p className="text-gray-600">상세 정보 불러오는 중...</p>
                </div>
              ) : bookDetails ? (
                <div>
                  <div className="flex gap-6 mb-6">
                    {/* Cover Image */}
                    <div className="flex-shrink-0">
                      <div className="w-40 h-56 bg-gray-100 rounded-lg overflow-hidden shadow-md">
                        {bookDetails.cover_url ? (
                          <img
                            src={bookDetails.cover_url}
                            alt={bookDetails.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                            📚
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Book Info */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{bookDetails.title}</h3>

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
                        {bookDetails.categoryName && (
                          <div className="flex">
                            <span className="text-gray-500 w-20">분류</span>
                            <span className="text-gray-900">{bookDetails.categoryName}</span>
                          </div>
                        )}
                        {bookDetails.priceStandard && (
                          <div className="flex">
                            <span className="text-gray-500 w-20">정가</span>
                            <span className="text-gray-900 font-semibold">{bookDetails.priceStandard.toLocaleString()}원</span>
                          </div>
                        )}
                      </div>

                      {/* Current Rank Info */}
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-gray-700">{selectedBook.platform}</span>
                          <span className="text-gray-500">·</span>
                          <span className="font-bold text-gray-900">{selectedBook.rank}위</span>
                          {selectedBook.rank_change !== null && selectedBook.rank_change !== 0 && (
                            <>
                              <span className="text-gray-500">·</span>
                              {selectedBook.rank_change < 0 ? (
                                <span className="text-red-500 font-bold">
                                  ↑ {Math.abs(selectedBook.rank_change)}
                                </span>
                              ) : (
                                <span className="text-blue-500 font-bold">
                                  ↓ {selectedBook.rank_change}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {bookDetails.description && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-2">책 소개</h4>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {bookDetails.description}
                      </p>
                    </div>
                  )}

                  {/* Link to Aladin */}
                  {bookDetails.link && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <a
                        href={bookDetails.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
                      >
                        알라딘에서 보기 →
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  상세 정보를 불러올 수 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
