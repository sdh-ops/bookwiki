"use strict";

const { supabase } = require('./common');

async function checkMillieCategories(date) {
  console.log(`\n=== Millie Category Distribution for ${date} ===\n`);

  const { data, error } = await supabase
    .from('bw_bestseller_snapshots')
    .select('common_category')
    .eq('platform', 'millie')
    .eq('snapshot_date', date);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  const counts = {};
  data.forEach(item => {
    counts[item.common_category] = (counts[item.common_category] || 0) + 1;
  });

  console.log(JSON.stringify(counts, null, 2));
}

checkMillieCategories('2026-05-10');
