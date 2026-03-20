"use strict";

const { supabase } = require('./common');

async function testTrendQuery() {
  console.log('🧪 트렌드 쿼리 시뮬레이션\n');

  // 1. 먼저 "프로젝트 헤일메리" 검색 (UI의 handleSearch와 동일)
  console.log('1️⃣ 책 검색...');
  const { data: searchData } = await supabase
    .from("bw_books")
    .select("*")
    .ilike("title", `%프로젝트%헤일메리%`)
    .limit(50);

  console.log(`   찾은 책: ${searchData?.length}개`);
  searchData?.forEach(book => {
    console.log(`   - ID: ${book.id}, 제목: ${book.title}, 저자: ${book.author}`);
  });

  // 2. 정규화된 제목으로 그룹화 (UI와 동일)
  function normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^\w가-힣]/g, '');
  }

  const groups = {};
  (searchData || []).forEach(book => {
    const normalizedKey = normalizeTitle(book.title);
    if (!groups[normalizedKey]) {
      groups[normalizedKey] = [];
    }
    groups[normalizedKey].push(book);
  });

  console.log(`\n2️⃣ 정규화 후 그룹: ${Object.keys(groups).length}개`);
  Object.entries(groups).forEach(([key, books]) => {
    console.log(`   - ${key}: ${books.length}개 변종`);
    books.forEach(b => console.log(`     → ${b.author}`));
  });

  // 3. 대표 책 선택
  const representatives = Object.values(groups).map(bookGroup => {
    const withIsbn = bookGroup.find(b => b.isbn);
    const representative = withIsbn || bookGroup[0];
    return {
      ...representative,
      _variants: bookGroup,
      _variantCount: bookGroup.length
    };
  });

  console.log(`\n3️⃣ 대표 책: ${representatives.length}개`);
  representatives.forEach(rep => {
    console.log(`   - ${rep.title} (${rep.author}) - ${rep._variantCount}개 변종`);
  });

  // 4. 첫 번째 대표 책의 트렌드 로드 (UI의 loadBookTrend와 동일)
  if (representatives.length > 0) {
    const book = representatives[0];
    console.log(`\n4️⃣ 트렌드 로드 대상: ${book.title} (${book.author})`);

    const period = "7"; // 기본값
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    console.log(`   기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);

    // 모든 변종의 book_id 수집
    const bookIds = (book._variants || [book]).map(b => b.id);
    console.log(`   검색할 book_id: ${bookIds.length}개`);
    bookIds.forEach(id => console.log(`     - ${id}`));

    const { data, error } = await supabase
      .from("bw_bestseller_snapshots")
      .select("*")
      .in("book_id", bookIds)
      .gte("snapshot_date", startDate.toISOString().split('T')[0])
      .lte("snapshot_date", endDate.toISOString().split('T')[0])
      .order("snapshot_date", { ascending: true });

    if (error) {
      console.error('\n   ❌ 쿼리 에러:', error);
    } else {
      console.log(`\n   ✅ 스냅샷 데이터: ${data?.length}개`);

      if (data && data.length > 0) {
        // 날짜별로 그룹화
        const groupedByDate = {};
        data.forEach(item => {
          const date = item.snapshot_date;
          if (!groupedByDate[date]) {
            groupedByDate[date] = { date };
          }
          const currentRank = groupedByDate[date][item.platform];
          if (!currentRank || item.rank < currentRank) {
            groupedByDate[date][item.platform] = item.rank;
          }
        });

        const chartData = Object.values(groupedByDate);
        console.log(`\n5️⃣ 차트 데이터: ${chartData.length}개 날짜`);
        chartData.forEach(cd => {
          console.log(`   ${cd.date}:`);
          Object.entries(cd).forEach(([key, value]) => {
            if (key !== 'date') {
              console.log(`     ${key}: ${value}위`);
            }
          });
        });

        if (chartData.length === 0) {
          console.log('\n   ❌ 차트 데이터가 비어있음! "선택한 기간에 베스트셀러 데이터가 없습니다" 메시지 표시됨');
        } else {
          console.log('\n   ✅ 차트 데이터 정상 - 차트가 표시되어야 함');
        }
      } else {
        console.log('   ❌ 스냅샷 데이터 없음');
      }
    }
  }

  process.exit(0);
}

testTrendQuery();
