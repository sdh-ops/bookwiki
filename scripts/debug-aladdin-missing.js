"use strict";

const { aladdin } = require('./bestseller-v2');
const { supabase } = require('./common');

async function debugAladdin() {
  console.log('🔍 알라딘 누락 순위 디버깅\n');

  const category = { id: 'total', name: '종합', aladdin: '0' };

  console.log('1️⃣ 알라딘 스크래핑...');
  const books = await aladdin(category);

  console.log(`\n✅ 수집 완료: ${books.length}개\n`);

  console.log('📊 수집된 책 목록:');
  console.log('─'.repeat(80));
  books.forEach((book) => {
    console.log(`${book.rank}위: ${book.title}`);
    console.log(`   저자: ${book.author} | ISBN: ${book.isbn || '없음'}`);
  });

  console.log('\n─'.repeat(80));
  console.log('\n2️⃣ 누락 순위 확인...');

  const ranks = books.map(b => b.rank).sort((a, b) => a - b);
  const missing = [];

  for (let i = 1; i <= 20; i++) {
    if (!ranks.includes(i)) {
      missing.push(i);
    }
  }

  if (missing.length > 0) {
    console.log(`⚠️  스크래핑 단계에서 이미 누락: ${missing.join(', ')}위`);
    console.log('→ 알라딘 웹사이트에서 해당 순위 데이터를 제공하지 않거나 파싱 실패');
  } else {
    console.log('✅ 스크래핑은 1-20위 모두 수집함');
  }

  console.log('\n3️⃣ 중복 순위 확인...');
  const rankCounts = {};
  books.forEach(b => {
    rankCounts[b.rank] = (rankCounts[b.rank] || 0) + 1;
  });

  const duplicates = Object.entries(rankCounts).filter(([rank, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('⚠️  중복된 순위 발견:');
    duplicates.forEach(([rank, count]) => {
      console.log(`   ${rank}위: ${count}개`);
      const dupeBooks = books.filter(b => b.rank === parseInt(rank));
      dupeBooks.forEach(b => console.log(`      - ${b.title} (${b.author})`));
    });
  } else {
    console.log('✅ 중복 순위 없음');
  }

  console.log('\n4️⃣ DB 확인...');
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('bw_bestseller_snapshots')
    .select('rank, bw_books(title, author)')
    .eq('platform', 'aladdin')
    .eq('common_category', '종합')
    .eq('snapshot_date', today)
    .order('rank', { ascending: true });

  console.log(`\nDB에 저장된 순위: ${data.length}개`);
  const dbRanks = data.map(d => d.rank).sort((a, b) => a - b);
  const dbMissing = [];

  for (let i = 1; i <= 20; i++) {
    if (!dbRanks.includes(i)) {
      dbMissing.push(i);
    }
  }

  if (dbMissing.length > 0) {
    console.log(`⚠️  DB에서 누락: ${dbMissing.join(', ')}위`);
  } else {
    console.log('✅ DB에 1-20위 모두 저장됨');
  }
}

debugAladdin();
