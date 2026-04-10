"use strict";

const { supabase } = require('./common');

async function cleanAndRescrape() {
  console.log('Step 1: Deleting all bestseller data...');

  await supabase
    .from('bw_bestseller_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  await supabase
    .from('bw_books')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('✓ Data cleared\n');

  // Check counts
  const { count: bookCount } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });

  const { count: snapCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true });

  console.log(`Books: ${bookCount}, Snapshots: ${snapCount}`);
  console.log('\n✅ Ready to run bestseller-v2.js');
}

cleanAndRescrape();
