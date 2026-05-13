"use strict";

const axios = require('axios');
const { supabase } = require('./common');

// Copying necessary functions from bestseller-final.js for the test
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

async function scrapeMillie(category, retries = 3) {
  console.log(`[Millie Test] ${category.name}...`);
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://apis.millie.co.kr/public/rank/bookstore/?size=50&category=${category.millie}&year=${year}&month=${month}`;
      const response = await axios.get(url, { headers: HEADERS, timeout: 20000 });
      const data = response.data?.data || [];
      if (data.length === 0) {
        if (attempt < retries) {
          console.log(`  [!] Retry ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return [];
      }
      const books = data.map((item, idx) => ({
        rank: idx + 1,
        title: item.book_name || '',
        author: cleanAuthor(item.author || ''),
        publisher: item.publisher_name || '밀리의서재',
        cover_url: item.cover_image_url || null,
        pub_date: item.publish_date || null
      })).filter(b => isValidBook(b.title, b.author));
      return books;
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function testSync() {
  const cat = { name: '종합', millie: 'total' };
  const books = await scrapeMillie(cat);
  console.log(`Found ${books.length} books.`);
  
  if (books.length > 0) {
    console.log('Sample data:', books[0]);
    // Try to sync one book to verify DB connection
    const book = books[0];
    const snapshotDate = new Date().toISOString().split('T')[0];
    
    try {
      const { data: record, error: upsertError } = await supabase.from('bw_books')
        .upsert({
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          cover_url: book.cover_url
        }, { onConflict: 'title,author' })
        .select().single();
      
      if (upsertError) throw upsertError;
      
      if (record) {
        const { error: snapshotError } = await supabase.from('bw_bestseller_snapshots').upsert({
          book_id: record.id,
          platform: 'millie',
          period_type: 'daily',
          rank: book.rank,
          common_category: cat.name,
          snapshot_date: snapshotDate
        }, { onConflict: 'book_id,platform,snapshot_date,common_category,period_type' });
        
        if (snapshotError) throw snapshotError;
        console.log(`✅ Successfully synced "${book.title}" to DB for ${snapshotDate}`);
      }
    } catch (err) {
      console.error('❌ Sync failed:', err.message);
    }
  }
}

testSync();
