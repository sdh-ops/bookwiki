"use strict";

const { supabase } = require('./common');

async function checkCoverUrls() {
  console.log('\n=== 표지 이미지 URL 확인 ===\n');

  // 표지가 없는 책들
  const { data: noCover, count: noCoverCount } = await supabase
    .from('bw_books')
    .select('title, author, cover_url', { count: 'exact' })
    .or('cover_url.is.null,cover_url.eq.')
    .limit(10);

  console.log(`📚 표지 없는 책: ${noCoverCount}개\n`);
  if (noCover && noCover.length > 0) {
    console.log('샘플 (표지 없음):');
    noCover.forEach((book, idx) => {
      console.log(`  ${idx + 1}. ${book.title} - ${book.author}`);
      console.log(`     cover_url: ${book.cover_url || 'NULL'}\n`);
    });
  }

  // 표지가 있는 책들
  const { data: withCover, count: withCoverCount } = await supabase
    .from('bw_books')
    .select('title, author, cover_url', { count: 'exact' })
    .not('cover_url', 'is', null)
    .neq('cover_url', '')
    .limit(5);

  console.log(`\n📚 표지 있는 책: ${withCoverCount}개\n`);
  if (withCover && withCover.length > 0) {
    console.log('샘플 (표지 있음):');
    withCover.forEach((book, idx) => {
      console.log(`  ${idx + 1}. ${book.title} - ${book.author}`);
      console.log(`     cover_url: ${book.cover_url.substring(0, 80)}...\n`);
    });
  }

  // 플랫폼별로 스냅샷 확인 (표지 없는 것들이 어느 플랫폼에서 왔는지)
  console.log('\n플랫폼별 표지 없는 책 확인:\n');

  const platforms = ['yes24', 'aladdin', 'kyobo', 'ridi', 'millie'];
  for (const platform of platforms) {
    const { data } = await supabase
      .from('bw_bestseller_snapshots')
      .select(`
        bw_books!inner (
          title,
          cover_url
        )
      `)
      .eq('platform', platform)
      .limit(20);

    if (data) {
      const noCoverInPlatform = data.filter(item => !item.bw_books?.cover_url || item.bw_books.cover_url === '');
      console.log(`  ${platform.padEnd(10)}: ${noCoverInPlatform.length}/20 표지 없음`);
    }
  }

  console.log('\n=== 완료 ===\n');
}

checkCoverUrls();
