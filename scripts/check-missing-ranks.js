"use strict";

const { supabase } = require('./common');

async function checkMissingRanks() {
  const today = '2026-03-19';

  const { data } = await supabase
    .from('bw_bestseller_snapshots')
    .select('platform, rank, common_category')
    .eq('snapshot_date', today)
    .eq('common_category', '종합')
    .order('platform', { ascending: true })
    .order('rank', { ascending: true });

  const platforms = ['kyobo', 'yes24', 'aladdin', 'ridi', 'millie'];

  platforms.forEach(platform => {
    const platformData = data.filter(d => d.platform === platform);
    const ranks = platformData.map(d => d.rank).sort((a, b) => a - b);

    console.log(`\n${platform.toUpperCase()}:`);
    console.log(`  총 ${ranks.length}개 순위 수집됨`);

    // 1-20 중 빠진 순위 찾기
    const missing = [];
    for (let i = 1; i <= 20; i++) {
      if (!ranks.includes(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      console.log(`  ⚠️  누락된 순위: ${missing.join(', ')}`);
    } else {
      console.log(`  ✓ 1-20위 모두 수집됨`);
    }

    console.log(`  실제 순위: ${ranks.join(', ')}`);
  });
}

checkMissingRanks();
