const { supabase } = require('../scripts/common');

async function testWipeStatus() {
  const { data, error } = await supabase.from('bw_bestseller_snapshots').select('COUNT').eq('snapshot_date', '2026-03-31');
  console.log("Error:", error);
  console.log("Count of snapshots for 2026-03-31:", data ? data.length : "N/A");
  
  const badBooks = await supabase.from('bw_books').select('id, title, author').like('title', '%로고%');
  console.log("Bad books left:", badBooks.data || []);
}
testWipeStatus();
