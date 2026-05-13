"use strict";

const { supabase } = require('./common');

async function verifyMillieData() {
  console.log('=== Verifying Millie Data for 2026-05-10 (종합) ===');
  
  const { data, error } = await supabase
    .from('bw_bestseller_snapshots')
    .select('rank, common_category, snapshot_date')
    .eq('platform', 'millie')
    .eq('snapshot_date', '2026-05-10')
    .eq('common_category', '종합')
    .order('rank');

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ Found ${data.length} items.`);
    if (data.length > 0) {
      console.log('First item rank:', data[0].rank);
    }
  }
}

verifyMillieData();
