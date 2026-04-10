const { supabase } = require('../scripts/common');

async function wipeYesterdayAndClean() {
  console.log("Wiping corrupted snapshots for 2026-03-31...");
  
  // Scraper actually saves to yesterday's date! So the bad data is on 2026-03-31!
  const snapshotDate = '2026-03-31';

  // 1. Delete all snapshots for yesterday
  const snapRes = await supabase.from('bw_bestseller_snapshots').delete().eq('snapshot_date', snapshotDate);
  console.log(`Deleted snapshots for ${snapshotDate}`, snapRes.error ? snapRes.error : "SUCCESS");

  // 2. Safely delete the bad books
  console.log("Cleansing bw_books of corrupted placeholders...");
  let res1 = await supabase.from('bw_books').delete().like('title', '%로고%');
  let res2 = await supabase.from('bw_books').delete().like('title', '%24%교보%');
  let res3 = await supabase.from('bw_books').delete().like('title', '%만나보세요%');
  let res4 = await supabase.from('bw_books').delete().like('title', '%베스트셀러%');
  let res5 = await supabase.from('bw_books').delete().like('author', '%밀리의서재%');
  let res6 = await supabase.from('bw_books').update({cover_url: null}).like('cover_url', '%default%');

  console.log("Cleaned corrupted books.");
}

wipeYesterdayAndClean().then(() => {
    console.log("Wipe completed.");
    process.exit(0);
});
