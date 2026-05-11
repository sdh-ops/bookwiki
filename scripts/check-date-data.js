"use strict";

const { supabase } = require('./common');

async function checkDate(date) {
  console.log(`\n=== Checking Data for ${date} ===\n`);

  const platforms = ['kyobo', 'yes24', 'aladdin', 'ridi', 'millie'];

  for (const platform of platforms) {
    const { count, error } = await supabase
      .from('bw_bestseller_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('platform', platform)
      .eq('snapshot_date', date)
      .eq('period_type', 'daily');

    if (error) {
      console.log(`  ${platform}: ❌ Error: ${error.message}`);
    } else {
      console.log(`  ${platform}: ${count || 0} items`);
    }
  }
}

async function run() {
  await checkDate('2026-05-10');
  await checkDate('2026-05-11');
}

run();
