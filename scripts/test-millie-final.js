"use strict";

const axios = require('axios');

// Millie scraper function (same as in bestseller-v2.js)
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

function cleanTitle(title) {
  if (!title) return '알수없음';
  return title.replace(/\s+/g, ' ').trim();
}

function cleanAuthor(author) {
  if (!author) return '알수없음';
  let cleaned = author
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/지은이|옮긴이|엮은이|그림|편저|원작|글|편/g, '')
    .split(',')[0]
    .split('/')[0]
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '알수없음';
}

async function scrapeMillie(category, retries = 3) {
  console.log(`[Millie] ${category.name}...`);

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://apis.millie.co.kr/public/rank/bookstore/?size=20&category=${category.millie}&year=${year}&month=${month}`;

      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000
      });

      const data = response.data?.data || [];

      if (data.length === 0) {
        if (attempt < retries) {
          console.log(`  [!] Retry ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return [];
      }

      const books = data.slice(0, 20).map((item, idx) => ({
        rank: idx + 1,
        title: cleanTitle(item.book_name || ''),
        author: cleanAuthor(item.author || ''),
        publisher: '밀리의서재',
        cover_url: item.cover_image_url || null
      }));

      console.log(`  [✓] Found ${books.length} books`);
      return books;

    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function test() {
  console.log('\n=== Testing Millie API Scraper ===\n');

  const categories = [
    { name: '종합', millie: 'total' },
    { name: '소설', millie: 'story' },
    { name: '에세이/시', millie: 'poem' },
    { name: '경제경영', millie: 'economy' },
    { name: '자기계발', millie: 'self-development' }
  ];

  for (const cat of categories) {
    const books = await scrapeMillie(cat);
    if (books.length > 0) {
      console.log(`  Sample: ${books[0].title} by ${books[0].author}\n`);
    } else {
      console.log(`  ❌ Failed\n`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('=== Complete ===\n');
}

test();
