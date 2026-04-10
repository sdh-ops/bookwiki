"use strict";

const { supabase } = require('./common');

async function testSync() {
  console.log('\n=== Testing Sync Function ===\n');

  const testBook = {
    rank: 1,
    title: '테스트 도서',
    author: '테스트 저자',
    publisher: '테스트 출판사',
    cover_url: 'https://example.com/cover.jpg',
    isbn: null
  };

  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Try to upsert a book
    console.log('1. Attempting to upsert book...');
    const { data: record, error: upsertError } = await supabase
      .from('bw_books')
      .upsert({
        title: testBook.title,
        author: testBook.author,
        publisher: testBook.publisher,
        cover_url: testBook.cover_url,
        isbn: testBook.isbn
      }, { onConflict: 'title,author' })
      .select()
      .single();

    if (upsertError) {
      console.error('❌ Upsert error:', upsertError);
      return;
    }

    console.log('✅ Upsert successful:', record);

    // 2. Try to insert snapshot
    console.log('\n2. Attempting to insert snapshot...');
    const { data: snapshot, error: snapshotError } = await supabase
      .from('bw_bestseller_snapshots')
      .insert({
        book_id: record.id,
        platform: 'test',
        period_type: 'daily',
        rank: testBook.rank,
        common_category: '종합',
        snapshot_date: today
      })
      .select();

    if (snapshotError) {
      console.error('❌ Snapshot error:', snapshotError);
      return;
    }

    console.log('✅ Snapshot successful:', snapshot);

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }

  console.log('\n=== Test Complete ===\n');
}

testSync();
