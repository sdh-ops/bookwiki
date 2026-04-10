const { supabase } = require('../scripts/common');
const axios = require('axios');

const ALADIN_API_KEY = 'ttbsue_1201547001';

async function fetchMissingInfo(title, author) {
  try {
    const safeTitle = title.replace(/\[도서\]/g, '').split('(')[0].split('-')[0].trim();
    const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
    const params = {
      ttbkey: ALADIN_API_KEY,
      Query: safeTitle + ' ' + (author !== '저자 미상' ? author.split(' ')[0] : ''),
      QueryType: 'Keyword',
      MaxResults: 2,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };
    const response = await axios.get(url, { params, timeout: 5000 });
    if (response.data && response.data.item && response.data.item.length > 0) {
      const book = response.data.item[0];
      return {
        cover_url: book.cover?.replace('coversum', 'cover200') || book.cover,
        publisher: book.publisher,
        isbn: book.isbn13 || book.isbn
      };
    }
  } catch (e) { }
  return null;
}

async function fixCovers() {
  console.log("Starting cover backfill...");
  const { data: books } = await supabase.from('bw_books')
    .select('id, title, author, publisher, cover_url')
    .or('cover_url.is.null,cover_url.eq.,cover_url.ilike.data:image%,publisher.eq.알수없음,publisher.eq.밀리의서재');

  console.log(`Found ${books ? books.length : 0} books needing updates.`);
  if (!books) return;

  let updated = 0;
  for (const book of books) {
    const info = await fetchMissingInfo(book.title, book.author);
    if (info) {
      const updates = {};
      if (!book.cover_url || !book.cover_url.startsWith('http')) updates.cover_url = info.cover_url;
      if (book.publisher === '알수없음' || book.publisher === '밀리의서재') updates.publisher = info.publisher;

      if (Object.keys(updates).length > 0) {
        await supabase.from('bw_books').update(updates).eq('id', book.id);
        console.log(`Fixed: ${book.title}`, Object.keys(updates));
        updated++;
      }
    }
    // Prevent hitting rate limits aggressively
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`Finished repairing ${updated} books.`);
  
  // Also clean up any garbage data that might be lingering
  await supabase.from('bw_books').delete().like('title', '%로고%');
  await supabase.from('bw_books').delete().like('title', '%24%알라딘%교보%');
  console.log("Deleted any residual Millie non-book artifacts.");

  process.exit(0);
}

fixCovers();
