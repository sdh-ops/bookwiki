"use strict";

const { sync, aladdin, initBrowser } = require('./bestseller-v2');
const { supabase } = require('./common');

async function testSync() {
  console.log('🧪 알라딘 동기화 수정사항 테스트\n');

  try {
    await initBrowser();

    const category = { id: 'total', name: '종합', aladdin: 0 };

    console.log('1️⃣ 알라딘 종합 스크래핑...');
    const books = await aladdin(category);
    console.log(`✅ ${books.length}개 수집\n`);

    // 먼저 오늘 알라딘 종합 데이터 삭제
    const today = new Date().toISOString().split('T')[0];
    console.log('2️⃣ 기존 알라딘 종합 데이터 삭제...');
    const { error: deleteError } = await supabase
      .from('bw_bestseller_snapshots')
      .delete()
      .eq('platform', 'aladdin')
      .eq('common_category', '종합')
      .eq('snapshot_date', today);

    if (deleteError) {
      console.error('삭제 실패:', deleteError);
    } else {
      console.log('✅ 삭제 완료\n');
    }

    console.log('3️⃣ 동기화 시작...');
    await sync('aladdin', books, '종합');

    console.log('\n4️⃣ DB 확인...');
    const { data } = await supabase
      .from('bw_bestseller_snapshots')
      .select('rank, bw_books(title, author)')
      .eq('platform', 'aladdin')
      .eq('common_category', '종합')
      .eq('snapshot_date', today)
      .order('rank', { ascending: true });

    console.log(`\n📊 저장된 순위: ${data.length}개`);
    const ranks = (data || []).map(d => d.rank).sort((a, b) => a - b);
    const missing = [];

    for (let i = 1; i <= 20; i++) {
      if (!ranks.includes(i)) {
        missing.push(i);
      }
    }

    if (missing.length === 0) {
      console.log('✅ 1-20위 모두 저장 완료! 🎉');
      console.log('\n저장된 책 목록:');
      data.forEach(item => {
        console.log(`  ${item.rank}위: ${item.bw_books.title} (${item.bw_books.author})`);
      });
    } else {
      console.log(`❌ 누락 순위: ${missing.join(', ')}위`);
      console.log('\n저장된 순위:', ranks.join(', '));
    }

    process.exit(0);
  } catch (err) {
    console.error('테스트 실패:', err);
    process.exit(1);
  }
}

testSync();
