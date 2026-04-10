"use strict";

const { supabase } = require('./common');

const CATEGORIES = ["종합", "소설", "에세이/시", "인문", "역사", "사회과학", "경제경영", "자기계발", "과학", "어린이/청소년"];
const PLATFORMS = ['kyobo', 'yes24', 'aladdin', 'ridi', 'millie'];

async function checkAllCategories() {
  const today = '2026-03-19';

  console.log('📊 모든 카테고리 순위 체크\n');
  console.log('날짜:', today);
  console.log('─'.repeat(80));

  for (const category of CATEGORIES) {
    console.log(`\n📖 ${category}`);

    for (const platform of PLATFORMS) {
      const { data } = await supabase
        .from('bw_bestseller_snapshots')
        .select('rank')
        .eq('platform', platform)
        .eq('common_category', category)
        .eq('snapshot_date', today);

      const ranks = (data || []).map(d => d.rank).sort((a, b) => a - b);
      const missing = [];

      for (let i = 1; i <= 20; i++) {
        if (!ranks.includes(i)) {
          missing.push(i);
        }
      }

      const status = missing.length === 0 ? '✅' : '⚠️';
      const count = ranks.length;
      const missInfo = missing.length > 0 ? ` (누락: ${missing.join(', ')})` : '';

      console.log(`  ${status} ${platform.padEnd(10)}: ${count}/20${missInfo}`);
    }
  }

  console.log('\n─'.repeat(80));
  console.log('완료!');
}

checkAllCategories();
