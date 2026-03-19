"use strict";

const { supabase } = require('./common');

async function checkData() {
  console.log('\n=== 베스트셀러 데이터 확인 ===\n');

  // 총 책 개수
  const { count: bookCount } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });

  console.log(`📚 총 책 개수: ${bookCount}개\n`);

  // 플랫폼별 스냅샷 개수
  const platforms = ['yes24', 'aladdin', 'kyobo', 'ridi', 'millie'];

  console.log('🏪 플랫폼별 스냅샷:');
  for (const platform of platforms) {
    const { count } = await supabase
      .from('bw_bestseller_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('platform', platform);
    console.log(`  ${platform.padEnd(10)}: ${count}개`);
  }

  // 카테고리별 스냅샷 개수
  console.log('\n📖 카테고리별 스냅샷:');
  const categories = [
    '종합', '소설', '에세이/시', '인문', '역사',
    '사회과학', '경제경영', '자기계발', '과학', '어린이/청소년'
  ];

  for (const cat of categories) {
    const { count } = await supabase
      .from('bw_bestseller_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('common_category', cat);
    console.log(`  ${cat.padEnd(15)}: ${count}개`);
  }

  // 샘플 데이터 (종합 베스트셀러 top 5)
  console.log('\n⭐ 종합 베스트셀러 Top 5 (플랫폼 통합):');
  const { data: topBooks } = await supabase
    .from('bw_bestseller_snapshots')
    .select(`
      rank,
      bw_books (title, author)
    `)
    .eq('common_category', '종합')
    .order('rank', { ascending: true })
    .limit(5);

  if (topBooks) {
    topBooks.forEach((item, idx) => {
      const book = item.bw_books;
      console.log(`  ${idx + 1}. ${book.title} - ${book.author}`);
    });
  }

  console.log('\n=== 완료 ===\n');
}

checkData();
