"use strict";

const { supabase } = require('./common');

async function testInsert() {
  console.log('=== Testing Database Insert ===\n');

  // Test 1: Insert a book
  console.log('Test 1: Inserting a test book...');
  const { data: book, error: bookError } = await supabase
    .from('bw_books')
    .insert({
      title: '테스트 도서',
      author: '테스트 저자',
      publisher: '테스트 출판사',
      cover_url: 'https://example.com/cover.jpg'
    })
    .select()
    .single();

  if (bookError) {
    console.error('❌ Book insert failed:', bookError);
    console.error('Error details:', JSON.stringify(bookError, null, 2));
    return;
  } else {
    console.log('✅ Book inserted:', book);
  }

  // Test 2: Insert a snapshot
  console.log('\nTest 2: Inserting a test snapshot...');
  const { data: snapshot, error: snapshotError } = await supabase
    .from('bw_bestseller_snapshots')
    .insert({
      book_id: book.id,
      platform: 'test',
      period_type: 'daily',
      rank: 1,
      common_category: '테스트',
      snapshot_date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (snapshotError) {
    console.error('❌ Snapshot insert failed:', snapshotError);
    console.error('Error details:', JSON.stringify(snapshotError, null, 2));
    return;
  } else {
    console.log('✅ Snapshot inserted:', snapshot);
  }

  // Test 3: Check if data exists
  console.log('\nTest 3: Verifying data...');
  const { data: books, count } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact' });

  console.log(`✅ Total books in database: ${count}`);

  const { data: snapshots, count: snapshotCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact' });

  console.log(`✅ Total snapshots in database: ${snapshotCount}`);

  // Test 4: Upsert (what the scraper uses)
  console.log('\nTest 4: Testing upsert (same as scraper)...');
  const { data: upsertBook, error: upsertError } = await supabase
    .from('bw_books')
    .upsert({
      title: '테스트 도서 2',
      author: '테스트 저자 2',
      publisher: '테스트 출판사 2',
      cover_url: 'https://example.com/cover2.jpg'
    }, { onConflict: 'title,author' })
    .select()
    .single();

  if (upsertError) {
    console.error('❌ Upsert failed:', upsertError);
    console.error('Error details:', JSON.stringify(upsertError, null, 2));
  } else {
    console.log('✅ Upsert successful:', upsertBook);
  }

  console.log('\n=== Test Complete ===');
}

testInsert();
