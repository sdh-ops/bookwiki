"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

const COMMON_CATEGORIES = [
  { name: '종합', aladin: '0' },
  { name: '소설', aladin: '1' },
  { name: '에세이/시', aladin: '51387' },
  { name: '인문', aladin: '656' },
  { name: '경제경영', aladin: '170' },
  { name: '자기계발', aladin: '336' },
  { name: '사회과학', aladin: '798' },
  { name: '역사', aladin: '74' },
  { name: '예술', aladin: '517' },
  { name: '종교', aladin: '1237' },
  { name: '과학', aladin: '987' },
  { name: '기술/IT', aladin: '351' },
  { name: '만화', aladin: '2551' },
  { name: '여행', aladin: '1196' },
  { name: '건강', aladin: '55890' }
];

async function scrapeAladin(category) {
  console.log(`[Aladin] ${category.name}...`);
  const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladin}`;
  
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
    const $ = cheerio.load(res.data);
    const books = [];
    
    $('.ss_book_box').each((i, el) => {
      if (books.length >= 50) return;
      const titleLink = $(el).find('a.bo3');
      if (titleLink.length === 0) return;
      
      const title = titleLink.text().trim();
      const info = $(el).find('.ss_book_list li').next().text().trim();
      const parts = info.split('|');
      const author = parts[0]?.trim() || '알수없음';
      const pub = parts[1]?.trim() || '알수없음';
      
      books.push({
        rank: books.length + 1,
        title,
        author: author.split('(')[0].trim(),
        publisher: pub
      });
    });
    return books;
  } catch (e) {
    console.error(`  [!] Failed: ${e.message}`);
    return [];
  }
}

async function syncAllAladin(date) {
  console.log(`Starting Aladin sync for ${date}`);
  for (const cat of COMMON_CATEGORIES) {
    const books = await scrapeAladin(cat);
    console.log(`  Found ${books.length} books.`);
    
    for (const book of books) {
      const { data: record } = await supabase.from('bw_books')
        .upsert({ title: book.title, author: book.author, publisher: book.publisher }, { onConflict: 'title,author' })
        .select().single();
      
      if (record) {
        await supabase.from('bw_bestseller_snapshots').upsert({
          book_id: record.id,
          platform: 'aladin',
          period_type: 'daily',
          rank: book.rank,
          common_category: cat.name,
          snapshot_date: date
        }, { onConflict: 'book_id,platform,snapshot_date,common_category,period_type' });
      }
    }
  }
}

async function run() {
  await syncAllAladin('2026-05-10');
  await syncAllAladin('2026-05-11');
  console.log('Aladin sync complete.');
}

run();
