"use strict";

const { supabase } = require('./common');

async function investigate() {
  console.log('\n=== Issue Investigation ===\n');

  // 1. Check for duplicates (different approach)
  console.log('1. CHECKING DUPLICATES:');
  const { data: allSnapshots } = await supabase
    .from('bw_bestseller_snapshots')
    .select('book_id, platform, snapshot_date, common_category, rank')
    .order('snapshot_date', { ascending: false })
    .limit(200);

  // Group by unique key and check counts
  const groups = {};
  allSnapshots?.forEach(snap => {
    const key = `${snap.book_id}_${snap.platform}_${snap.snapshot_date}_${snap.common_category}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(snap.rank);
  });

  const duplicates = Object.entries(groups).filter(([key, ranks]) => ranks.length > 1);

  console.log(`  Total snapshots checked: ${allSnapshots?.length || 0}`);
  console.log(`  Unique combinations: ${Object.keys(groups).length}`);
  console.log(`  Duplicate combinations: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log('\n  Sample duplicates:');
    duplicates.slice(0, 3).forEach(([key, ranks]) => {
      console.log(`    ${key}: ranks ${ranks.join(', ')}`);
    });
  }

  // 2. Check books without covers
  console.log('\n2. CHECKING COVER URLS:');
  const { data: booksNoCover } = await supabase
    .from('bw_books')
    .select('id, title, cover_url')
    .or('cover_url.is.null,cover_url.eq.')
    .limit(10);

  console.log(`  Books without cover_url: ${booksNoCover?.length || 0}`);
  if (booksNoCover && booksNoCover.length > 0) {
    booksNoCover.slice(0, 3).forEach(book => {
      console.log(`    - ${book.title}: ${book.cover_url || '(null)'}`);
    });
  }

  // Check if covers are valid URLs
  const { data: recentBooks } = await supabase
    .from('bw_books')
    .select('id, title, cover_url')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\n  Recent 10 books cover status:`);
  recentBooks?.forEach(book => {
    const status = !book.cover_url ? 'NO_URL' :
                   book.cover_url.startsWith('http') ? 'OK' : 'INVALID';
    console.log(`    ${status}: ${book.title.substring(0, 30)}... | ${book.cover_url?.substring(0, 50) || '(null)'}`);
  });

  // 3. Check bestseller snapshots with their book data
  console.log('\n3. CHECKING SNAPSHOT-BOOK JOIN:');
  const { data: snapshotSample } = await supabase
    .from('bw_bestseller_snapshots')
    .select(`
      id,
      rank,
      platform,
      common_category,
      snapshot_date,
      bw_books!inner (
        id,
        title,
        cover_url
      )
    `)
    .order('snapshot_date', { ascending: false })
    .limit(5);

  console.log(`  Sample snapshots with book data:`);
  snapshotSample?.forEach(snap => {
    console.log(`    Rank ${snap.rank} (${snap.platform}): ${snap.bw_books.title}`);
    console.log(`      Cover: ${snap.bw_books.cover_url ? 'YES' : 'NO'} | ${snap.bw_books.cover_url?.substring(0, 60) || '(null)'}`);
  });

  // 4. Count total records
  console.log('\n4. OVERALL COUNTS:');
  const { count: totalBooks } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });

  const { count: totalSnapshots } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true });

  console.log(`  Total books: ${totalBooks}`);
  console.log(`  Total snapshots: ${totalSnapshots}`);

  console.log('\n=== Investigation Complete ===\n');
}

investigate();
