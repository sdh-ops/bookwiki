"use strict";

const { supabase } = require('./common');

async function checkUniqueConstraint() {
  console.log('\n=== Checking Unique Constraint ===\n');

  // Get a few sample snapshots
  const { data } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*')
    .limit(10);

  console.log('Sample snapshots:\n');
  data.forEach((s, idx) => {
    console.log(`${idx + 1}. Platform: ${s.platform}, Book ID: ${s.book_id.substring(0, 8)}..., Rank: ${s.rank}, Category: ${s.common_category}, Date: ${s.snapshot_date}`);
  });

  // Find duplicates by book_id + category + date (no platform)
  console.log('\n\nChecking for records with same book_id + category + date:\n');

  const firstBook = data[0];
  const { data: sameBookCatDate } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*')
    .eq('book_id', firstBook.book_id)
    .eq('common_category', firstBook.common_category)
    .eq('snapshot_date', firstBook.snapshot_date);

  if (sameBookCatDate && sameBookCatDate.length > 1) {
    console.log(`Found ${sameBookCatDate.length} snapshots with same book_id + category + date:`);
    sameBookCatDate.forEach(s => {
      console.log(`  - Platform: ${s.platform}, Rank: ${s.rank}`);
    });
  } else {
    console.log('No duplicates found with same book_id + category + date');
  }

  console.log('\n=== Complete ===\n');
}

checkUniqueConstraint();
