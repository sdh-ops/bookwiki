"use strict";

const { supabase } = require('./common');

async function checkIsbnStatus() {
  console.log('\n=== ISBN Status Check ===\n');

  // 전체 책 수
  const { count: totalBooks } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });

  // ISBN 있는 책
  const { count: withIsbn } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true })
    .not('isbn', 'is', null);

  // ISBN 없는 책
  const { count: withoutIsbn } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true })
    .is('isbn', null);

  console.log(`📚 총 도서: ${totalBooks}개`);
  console.log(`✅ ISBN 있음: ${withIsbn}개`);
  console.log(`❌ ISBN 없음: ${withoutIsbn}개`);

  if (withoutIsbn > 0) {
    console.log(`\n💡 ${withoutIsbn}개 도서에 ISBN을 추가할 수 있습니다.`);
    console.log(`   실행: node scripts/enrich-isbn.js`);
  } else {
    console.log(`\n✨ 모든 도서에 ISBN이 있습니다!`);
  }

  // 샘플 데이터 (ISBN 없는 책 5개)
  if (withoutIsbn > 0) {
    console.log('\n📋 ISBN 없는 책 샘플 (최대 5개):');
    const { data: samples } = await supabase
      .from('bw_books')
      .select('title, author, publisher')
      .is('isbn', null)
      .limit(5);

    samples?.forEach((book, idx) => {
      console.log(`  ${idx + 1}. ${book.title} - ${book.author}`);
    });
  }

  console.log('\n===================\n');
}

checkIsbnStatus();
