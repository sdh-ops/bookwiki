"use strict";

const { supabase } = require('./common');

async function checkStatus() {
  const today = '2026-03-19';

  // 플랫폼별 스냅샷 확인
  const { data } = await supabase
    .from('bw_bestseller_snapshots')
    .select('platform, common_category')
    .eq('snapshot_date', today)
    .eq('common_category', '종합');

  const platforms = {};
  data.forEach(s => {
    platforms[s.platform] = (platforms[s.platform] || 0) + 1;
  });

  console.log('종합 카테고리 플랫폼별 스냅샷:');
  Object.entries(platforms).forEach(([p, c]) => {
    console.log(`  ${p}: ${c}개`);
  });

  // 프로젝트 헤일메리 확인
  console.log('\n프로젝트 헤일메리 버전들:');
  const { data: books } = await supabase
    .from('bw_books')
    .select('id, title, author, publisher, isbn')
    .ilike('title', '%헤일메리%');

  books.forEach((b, idx) => {
    console.log(`${idx + 1}. ${b.title}`);
    console.log(`   저자: ${b.author}`);
    console.log(`   출판사: ${b.publisher}`);
    console.log(`   ISBN: ${b.isbn || 'NULL'}`);
    console.log(`   ID: ${b.id}\n`);
  });

  // 알에이치코리아 출판사 확인
  console.log('알에이치코리아 출판사 변형들:');
  const { data: pubs } = await supabase
    .from('bw_books')
    .select('publisher')
    .or('publisher.ilike.%알에%코리아%,publisher.ilike.%RHK%');

  const pubSet = new Set(pubs.map(p => p.publisher));
  pubSet.forEach(p => console.log(`  - ${p}`));
}

checkStatus();
