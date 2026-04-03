const { supabase } = require('./common');
const axios = require('axios');

const ALADIN_API_KEY = 'ttbsdh10220011';

async function fetchCorrectInfo(title, author) {
  try {
    const safeTitle = title.replace(/\[도서\]/g, '').split('(')[0].split('-')[0].trim();
    const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
    const params = {
      ttbkey: ALADIN_API_KEY,
      Query: `${safeTitle} ${author !== '저자 미상' ? author.split(' ')[0] : ''}`,
      QueryType: 'Keyword',
      MaxResults: 1,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };
    const response = await axios.get(url, { params, timeout: 5000 });
    if (response.data && response.data.item && response.data.item.length > 0) {
      return response.data.item[0];
    }
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
