const { supabase } = require('./common');
const axios = require('axios');

const ALADIN_API_KEY = 'ttbsue_1201547001';

async function fetchCorrectInfo(title, author) {
  try {
    const safeTitle = title.replace(/\[도서\]/g, '').split('(')[0].split('-')[0].trim();
    const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
    const baseParams = {
      ttbkey: ALADIN_API_KEY,
      QueryType: 'Keyword',
      MaxResults: 3,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };

    function titleMatches(foundTitle) {
      const normalize = s => s.replace(/\s/g, '').replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, '').toLowerCase();
      const a = normalize(safeTitle).substring(0, Math.min(4, normalize(safeTitle).length));
      return normalize(foundTitle).includes(a);
    }

    async function searchAladin(query) {
      const response = await axios.get(url, { params: { ...baseParams, Query: query }, timeout: 5000 });
      return response.data?.item || [];
    }

    let items = [];

    // 1차: 제목 + 저자 첫 단어
    if (author && author !== '저자 미상' && author !== '알수없음') {
      items = await searchAladin(`${safeTitle} ${author.split(' ')[0]}`);
    }

    // 2차: 제목만 (1차 실패 또는 제목 불일치 시)
    if (items.length === 0 || !titleMatches(items[0].title)) {
      items = await searchAladin(safeTitle);
    }

    const book = items.find(i => titleMatches(i.title)) || items[0];
    return book || null;
  } catch (e) {
    console.error(`  [!] Aladin lookup failed for ${title}:`, e.message);
  }
  return null;
}

async function cleanup() {
  console.log('--- Starting Publisher Cleanup (Target: 밀리의서재) ---');

  // 1. Find books with '밀리의서재' as publisher
  const { data: books, error } = await supabase
    .from('bw_books')
    .select('id, title, author, publisher')
    .eq('publisher', '밀리의서재');

  if (error) {
    console.error('Error fetching books:', error);
    return;
  }

  console.log(`Found ${books.length} books to verify.`);

  for (const book of books) {
    console.log(`Checking: ${book.title} (${book.author})...`);
    const correctInfo = await fetchCorrectInfo(book.title, book.author);

    if (correctInfo && correctInfo.publisher && correctInfo.publisher !== '밀리의서재') {
      console.log(`  -> Correcting to: ${correctInfo.publisher}`);
      
      const { error: updateError } = await supabase
        .from('bw_books')
        .update({
          publisher: correctInfo.publisher,
          isbn: correctInfo.isbn13 || correctInfo.isbn,
          pub_date: correctInfo.pubDate,
          description: correctInfo.description
        })
        .eq('id', book.id);

      if (updateError) {
        console.error(`    [!] Update failed for ${book.id}:`, updateError);
      } else {
        console.log(`    ✅ Updated successfully.`);
      }
    } else {
      console.log(`  -> No better info found or already correct.`);
    }
    
    // Rate lifting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('--- Cleanup Finished ---');
}

cleanup().catch(console.error);
