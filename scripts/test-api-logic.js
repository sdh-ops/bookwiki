"use strict";

const { supabase } = require('./common');

async function testApiLogic() {
  const category = '종합';
  const date = '2026-05-10';
  
  const { data, error } = await supabase
    .from("bw_bestseller_snapshots")
    .select(`
      rank,
      platform,
      snapshot_date,
      bw_books!inner (
        id,
        title,
        author,
        publisher
      )
    `)
    .eq("period_type", "daily")
    .eq("common_category", category)
    .eq("snapshot_date", date)
    .order("rank", { ascending: true });

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    const millieCount = data.filter(item => item.platform === 'millie').length;
    console.log(`Total items: ${data.length}`);
    console.log(`Millie items: ${millieCount}`);
    if (millieCount > 0) {
      console.log('Sample Millie item:', data.find(item => item.platform === 'millie'));
    }
  }
}

testApiLogic();
