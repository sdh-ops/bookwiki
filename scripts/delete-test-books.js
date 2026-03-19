"use strict";

const { supabase } = require('./common');

async function deleteTestBooks() {
  console.log('\n=== Deleting Test Books ===\n');

  // 테스트 도서 조회
  const { data: testBooks } = await supabase
    .from('bw_books')
    .select('id, title, author')
    .or('title.ilike.%테스트%,author.ilike.%테스트%');

  if (!testBooks || testBooks.length === 0) {
    console.log('No test books found.');
    return;
  }

  console.log(`Found ${testBooks.length} test books:`);
  testBooks.forEach((book, idx) => {
    console.log(`  ${idx + 1}. ${book.title} - ${book.author}`);
  });

  // 삭제 (CASCADE로 스냅샷도 같이 삭제됨)
  const { error } = await supabase
    .from('bw_books')
    .delete()
    .in('id', testBooks.map(b => b.id));

  if (error) {
    console.error('Error deleting test books:', error);
    return;
  }

  console.log(`\n✅ Deleted ${testBooks.length} test books (and their snapshots)`);
  console.log('\n===================\n');
}

deleteTestBooks();
