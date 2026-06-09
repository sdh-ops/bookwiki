"use strict";

const axios = require('axios');
const { supabase } = require('./common');

function cleanAuthor(author) {
  if (!author || author === '알수없음') return '저자 미상';
  let cleaned = author
    .replace(/\s+/g, ' ')
    .replace(/\[(지은이|저|작가|글|그림|역|옮긴이|편저|엮음|원작)\]/g, '')
    .replace(/\((지은이|저|작가|글|그림|역|옮긴이|편저|엮음|원작)\)/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s(저|지음|그림|외|옮김|역).*$/g, '')
    .trim();
  cleaned = cleaned.split(/[,/|]/)[0].trim();
  return cleaned || '저자 미상';
}

function isValidBook(title, author) {
  if (!title || title.length < 2) return false;
  const blacklist = ['로고', '이벤트', '공지', '배너', '안내', '이미지', '출판사', '서점'];
  const lowerTitle = title.toLowerCase();
  if (blacklist.some(word => lowerTitle.includes(word.toLowerCase()))) return false;
  return true;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

const COMMON_CATEGORIES = [
  { name: '종합', millie: 'total' },
  { name: '소설', millie: 'story' },
  { name: '에세이/시', millie: 'poem' },
  { name: '인문/교양', millie: 'humanities' },
  { name: '경제/경영', millie: 'economy' },
  { name: '자기계발', millie: 'self-development' },
  { name: '취미/실용', millie: 'hobby' },
  { name: '어린이/청소년', millie: 'child' },
  { name: '매거진', millie: 'magazine' }
];

async function scrapeMillie(category) {
  console.log(`[Millie] ${category.name}...`);

  try {
    const url = `https://apis.millie.co.kr/public/rank/millie/?adult=0&size=100&category=${category.millie}&range=day&book_type_code=01`;
    const response = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    const data = response.data?.data || [];
    return data.map((item, idx) => ({
      rank: idx + 1,
      title: item.book_name || '',
      author: cleanAuthor(item.author || ''),
      publisher: item.publisher_name || '밀리의서재',
      cover_url: item.cover_image_url || null,
      pub_date: item.publish_date || null
    })).filter(b => isValidBook(b.title, b.author));
  } catch (e) {
    console.error(`  [!] Failed: ${e.message}`);
    return [];
  }
}

async function runSyncForDate(targetDate) {
  const dateObj = new Date(targetDate);
  const snapshotDate = targetDate;
  console.log(`Starting Millie sync for ${snapshotDate}`);

  for (const cat of COMMON_CATEGORIES) {
    const books = await scrapeMillie(cat);
    console.log(`  Found ${books.length} books.`);
    
    let successCount = 0;
    for (const book of books) {
      try {
        const { data: record, error: upsertError } = await supabase.from('bw_books')
          .upsert({
            title: book.title,
            author: book.author,
            publisher: book.publisher,
            cover_url: book.cover_url
          }, { onConflict: 'title,author' })
          .select().single();
        
        if (upsertError) continue;
        
        if (record) {
          const { error: snapshotError } = await supabase.from('bw_bestseller_snapshots').upsert({
            book_id: record.id,
            platform: 'millie',
            period_type: 'daily',
            rank: book.rank,
            common_category: cat.name,
            snapshot_date: snapshotDate
          }, { onConflict: 'book_id,platform,snapshot_date,common_category,period_type' });
          
          if (!snapshotError) successCount++;
        }
      } catch (err) {}
    }
    console.log(`  ✅ Synced ${successCount}/${books.length} books.`);
  }
}

async function run() {
  await runSyncForDate('2026-05-10');
  console.log('All done.');
}

run();
