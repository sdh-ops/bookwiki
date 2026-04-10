const { supabase } = require('../scripts/common');

async function wipeAndClean() {
  console.log("Wiping today's corrupted snapshots...");
  
  const today = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstToday = new Date(today.getTime() + kstOffset);
  const snapshotDate = kstToday.toISOString().split('T')[0];

  // 1. Delete all snapshots for today
  await supabase.from('bw_bestseller_snapshots').delete().eq('snapshot_date', snapshotDate);
  console.log(`Deleted snapshots for ${snapshotDate}`);

  // 2. We can now safely delete the bad books because they have no snapshot pointing to them
  console.log("Cleansing bw_books of corrupted Millie placeholders...");
  let res1 = await supabase.from('bw_books').delete().like('title', '%로고%');
  let res2 = await supabase.from('bw_books').delete().like('title', '%24%교보%');
  let res3 = await supabase.from('bw_books').delete().like('title', '%베스트셀러%만나보세요%');
  console.log("Res1:", res1.error ? res1.error : "SUCCESS");
  console.log("Res2:", res2.error ? res2.error : "SUCCESS");
  console.log("Res3:", res3.error ? res3.error : "SUCCESS");
}

wipeAndClean().then(() => {
    console.log("Wipe completed.");
    process.exit(0);
});
