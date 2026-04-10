"use strict";

const { kyobo, initBrowser } = require('./bestseller-v2');
const { supabase } = require('./common');

async function testEbookFilter() {
  console.log('📘 전자책 필터 제거 테스트 - 교보문고 종합\n');

  try {
    await initBrowser();

    const category = { id: 'total', name: '종합', kyobo: '000' };

    console.log('1️⃣ 교보문고 스크래핑...');
    const books = await kyobo(category);

    console.log(`\n✅ 수집 완료: ${books.length}개`);
    console.log('\n📊 수집된 책 목록:');
    console.log('─'.repeat(80));

    books.forEach((book, idx) => {
      const ebookTag = book.isbn?.startsWith('E') ? ' [전자책]' : '';
      console.log(`${idx + 1}. ${book.title}${ebookTag}`);
      console.log(`   저자: ${book.author} | 출판사: ${book.publisher}`);
      console.log(`   ISBN: ${book.isbn || '없음'}`);
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log('\n2️⃣ DB 동기화 테스트...');

    const today = new Date().toISOString().split('T')[0];
    let successCount = 0;

    for (const book of books) {
      try {
        let record = null;

        if (book.isbn) {
          const { data: existing } = await supabase
            .from('bw_books')
            .select('*')
            .eq('isbn', book.isbn)
            .maybeSingle();

          if (existing) {
            console.log(`  📖 기존: "${book.title}" (ISBN: ${book.isbn})`);
            if (book.author !== '알수없음' && existing.author === '알수없음') {
              console.log(`     → 저자 업데이트: "${existing.author}" → "${book.author}"`);
            }
            record = existing;
          } else {
            const { data: inserted } = await supabase
              .from('bw_books')
              .insert({
                title: book.title,
                author: book.author,
                publisher: book.publisher,
                cover_url: book.cover_url,
                isbn: book.isbn
              })
              .select()
              .single();
            console.log(`  ✨ 신규: "${book.title}" (ISBN: ${book.isbn})`);
            record = inserted;
          }
        } else {
          const { data: upserted } = await supabase
            .from('bw_books')
            .upsert({
              title: book.title,
              author: book.author,
              publisher: book.publisher,
              cover_url: book.cover_url,
              isbn: null
            }, { onConflict: 'title,author' })
            .select()
            .single();
          console.log(`  📚 ISBN 없음: "${book.title}"`);
          record = upserted;
        }

        if (record) {
          const { error } = await supabase
            .from('bw_bestseller_snapshots')
            .upsert({
              book_id: record.id,
              platform: 'kyobo',
              period_type: 'daily',
              rank: book.rank,
              common_category: '종합',
              snapshot_date: today
            }, {
              onConflict: 'book_id,platform,period_type,snapshot_date,common_category'
            });

          if (!error) successCount++;
        }
      } catch (err) {
        console.error(`  ❌ 에러: "${book.title}" - ${err.message}`);
      }
    }

    console.log(`\n✅ 동기화 완료: ${successCount}/${books.length}개`);

    // 누락 순위 확인
    console.log('\n3️⃣ 순위 확인...');
    const { data } = await supabase
      .from('bw_bestseller_snapshots')
      .select('rank')
      .eq('platform', 'kyobo')
      .eq('common_category', '종합')
      .eq('snapshot_date', today);

    const ranks = (data || []).map(d => d.rank).sort((a, b) => a - b);
    const missing = [];

    for (let i = 1; i <= 20; i++) {
      if (!ranks.includes(i)) {
        missing.push(i);
      }
    }

    console.log(`📊 수집된 순위: ${ranks.join(', ')}`);

    if (missing.length === 0) {
      console.log('✅ 1-20위 모두 수집 완료!');
    } else {
      console.log(`⚠️  누락 순위: ${missing.join(', ')}위`);
    }

  } catch (err) {
    console.error('테스트 실패:', err);
  }
}

testEbookFilter();
