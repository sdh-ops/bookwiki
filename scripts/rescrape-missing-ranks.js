"use strict";

const { supabase } = require('./common');
const { kyobo, aladdin } = require('./bestseller-v2');

async function checkMissingRanks(platform, category) {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('bw_bestseller_snapshots')
    .select('rank')
    .eq('platform', platform)
    .eq('common_category', category)
    .eq('snapshot_date', today);

  const ranks = data.map(d => d.rank);
  const missing = [];

  for (let i = 1; i <= 20; i++) {
    if (!ranks.includes(i)) {
      missing.push(i);
    }
  }

  return missing;
}

async function rescrapeMissing() {
  console.log('🔍 누락된 순위 재수집 시작...\n');

  const categories = [
    { name: '종합', kyoboId: null, aladinId: null }
  ];

  // 교보문고 13위 재수집
  console.log('📘 교보문고 재수집 중...');
  const kyoboMissing = await checkMissingRanks('kyobo', '종합');
  if (kyoboMissing.length > 0) {
    console.log(`  누락: ${kyoboMissing.join(', ')}위`);

    // 교보 전체 재수집 (종합만)
    await kyobo('종합');

    const kyoboAfter = await checkMissingRanks('kyobo', '종합');
    if (kyoboAfter.length === 0) {
      console.log('  ✅ 교보문고 모두 수집 완료\n');
    } else {
      console.log(`  ⚠️  여전히 누락: ${kyoboAfter.join(', ')}위\n`);
    }
  } else {
    console.log('  ✅ 이미 모두 수집됨\n');
  }

  // 알라딘 1, 14, 16위 재수집
  console.log('📕 알라딘 재수집 중...');
  const aladinMissing = await checkMissingRanks('aladdin', '종합');
  if (aladinMissing.length > 0) {
    console.log(`  누락: ${aladinMissing.join(', ')}위`);

    // 알라딘 전체 재수집 (종합만)
    await aladdin('종합');

    const aladinAfter = await checkMissingRanks('aladdin', '종합');
    if (aladinAfter.length === 0) {
      console.log('  ✅ 알라딘 모두 수집 완료\n');
    } else {
      console.log(`  ⚠️  여전히 누락: ${aladinAfter.join(', ')}위\n`);
    }
  } else {
    console.log('  ✅ 이미 모두 수집됨\n');
  }

  console.log('\n✅ 재수집 완료!');
}

rescrapeMissing();
