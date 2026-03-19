"use strict";

const { supabase } = require('./common');

async function checkRecentAuthors() {
  const { data } = await supabase
    .from('bw_books')
    .select('title, author, created_at')
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('최근 추가된 도서 (저자 필드 확인):\n');
  data.forEach((b, i) => {
    console.log(`${i + 1}. [${b.author}] - ${b.title}`);
  });
}

checkRecentAuthors();
