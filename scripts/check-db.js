"use strict";

const { supabase } = require('./common');

async function checkDatabase() {
  console.log('=== Checking Database ===\n');

  // Check bw_books table
  const { data: books, error: booksError } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: false })
    .limit(5);

  if (booksError) {
    console.error('❌ Error fetching books:', booksError.message);
  } else {
    console.log(`✅ bw_books: ${books.length} rows (showing first 5)`);
    books.forEach(b => console.log(`  - ${b.title} by ${b.author}`));
  }

  // Check bw_bestseller_snapshots table
  const { data: snapshots, error: snapshotsError, count } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*, bw_books(title, author)', { count: 'exact', head: false })
    .limit(10);

  if (snapshotsError) {
    console.error('\n❌ Error fetching snapshots:', snapshotsError.message);
  } else {
    console.log(`\n✅ bw_bestseller_snapshots: Total ${count} rows (showing first 10)`);
    snapshots.forEach(s => {
      console.log(`  - [${s.platform}] Rank ${s.rank}: ${s.bw_books?.title || 'N/A'} (${s.snapshot_date})`);
    });
  }

  // Check by platform
  console.log('\n=== Count by Platform ===');
  const platforms = ['kyobo', 'yes24', 'aladdin', 'ridi', 'millie'];
  for (const platform of platforms) {
    const { count } = await supabase
      .from('bw_bestseller_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('platform', platform);
    console.log(`  ${platform}: ${count || 0} records`);
  }

  // Check by category
  console.log('\n=== Count by Category ===');
  const { data: categoryData } = await supabase
    .from('bw_bestseller_snapshots')
    .select('common_category')
    .not('common_category', 'is', null);

  const categoryCounts = {};
  categoryData?.forEach(item => {
    categoryCounts[item.common_category] = (categoryCounts[item.common_category] || 0) + 1;
  });

  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} records`);
  });
}

checkDatabase().then(() => console.log('\n=== Check Complete ==='));
