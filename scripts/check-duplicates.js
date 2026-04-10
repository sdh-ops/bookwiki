"use strict";

const { supabase } = require('./common');

async function checkDuplicates() {
  const today = new Date().toISOString().split('T')[0];

  console.log('=== Checking for Duplicates ===\n');

  // 예스24 종합
  const { data: yes24 } = await supabase
    .from('bw_bestseller_snapshots')
    .select('id, rank, platform, bw_books(title)')
    .eq('platform', 'yes24')
    .eq('common_category', '종합')
    .eq('snapshot_date', today)
    .order('rank');

  console.log('예스24 종합:');
  yes24?.forEach(d => console.log(`  Rank ${d.rank}: ${d.bw_books.title}`));

  // 알라딘 에세이/시
  const { data: aladdin } = await supabase
    .from('bw_bestseller_snapshots')
    .select('id, rank, platform, bw_books(title)')
    .eq('platform', 'aladdin')
    .eq('common_category', '에세이/시')
    .eq('snapshot_date', today)
    .order('rank')
    .limit(5);

  console.log('\n알라딘 에세이/시 (처음 5개):');
  aladdin?.forEach(d => console.log(`  Rank ${d.rank}: ${d.bw_books.title}`));

  // 표지 없는 책 확인
  const { data: noCover } = await supabase
    .from('bw_books')
    .select('id, title, author, cover_url')
    .is('cover_url', null)
    .limit(10);

  console.log('\n표지 없는 책 (10개):');
  noCover?.forEach(b => console.log(`  - ${b.title} by ${b.author}`));
}

checkDuplicates();
