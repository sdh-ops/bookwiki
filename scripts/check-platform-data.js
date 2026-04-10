"use strict";

const { supabase } = require('./common');

async function checkPlatformData() {
  console.log('\n=== Platform Data Analysis ===\n');

  const today = new Date().toISOString().split('T')[0];

  const platforms = ['kyobo', 'yes24', 'aladdin', 'ridi', 'millie'];

  for (const platform of platforms) {
    console.log(`\n📊 ${platform.toUpperCase()}`);

    // 오늘 데이터 확인
    const { data, error } = await supabase
      .from('bw_bestseller_snapshots')
      .select(`
        rank,
        common_category,
        bw_books!inner (title, author)
      `)
      .eq('platform', platform)
      .eq('snapshot_date', today)
      .eq('period_type', 'daily')
      .eq('common_category', '종합')
      .order('rank', { ascending: true })
      .limit(5);

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`  ⚠️  No data for today (${today})`);
      continue;
    }

    console.log(`  ✅ Found ${data.length} records`);
    data.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Rank ${item.rank}: ${item.bw_books.title} - ${item.bw_books.author}`);
    });

    // 중복 체크
    const ranks = data.map(d => d.rank);
    const duplicateRanks = ranks.filter((rank, index) => ranks.indexOf(rank) !== index);
    if (duplicateRanks.length > 0) {
      console.log(`  🔴 DUPLICATES at ranks: ${[...new Set(duplicateRanks)].join(', ')}`);
    }
  }

  // 카테고리별 데이터 확인
  console.log('\n\n=== Category Coverage ===\n');
  const categories = ["종합", "소설", "에세이/시", "인문", "경제경영", "자기계발"];

  for (const category of categories) {
    console.log(`\n📚 ${category}`);

    for (const platform of platforms) {
      const { count } = await supabase
        .from('bw_bestseller_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('platform', platform)
        .eq('snapshot_date', today)
        .eq('period_type', 'daily')
        .eq('common_category', category);

      console.log(`  ${platform}: ${count || 0} items`);
    }
  }

  console.log('\n\n=== Complete ===\n');
}

checkPlatformData();
