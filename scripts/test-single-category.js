"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

let browser = null;

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

function cleanAuthor(author) {
  if (!author) return '알수없음';
  if (author.includes('원') && author.includes('할인')) return '알수없음';
  return author
    .replace(/\(지은이\)/g, '')
    .replace(/\(옮긴이\)/g, '')
    .split(',')[0]
    .split('/')[0]
    .trim() || '알수없음';
}

function cleanTitle(title) {
  if (!title) return '';
  return title.replace(/\[도서\]/g, '').trim();
}

async function testAladin() {
  console.log('\n=== Testing Aladin Scraper ===\n');

  try {
    const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0';
    const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
    const $ = cheerio.load(res.data);

    const books = [];
    $('.ss_book_box').slice(0, 5).each((i, el) => {
      const title = $(el).find('.bo3').text().trim();
      const info = $(el).find('.ss_book_list li').eq(2).text().trim();
      const parts = info.split('|');
      const author = cleanAuthor(parts[0]?.trim());
      const pub = parts[1]?.trim();
      const img = $(el).find('.front_cover').attr('src');

      if (title) {
        books.push({
          rank: i + 1,
          title: cleanTitle(title),
          author,
          publisher: pub || '알수없음',
          cover_url: img
        });
      }
    });

    console.log(`✅ Found ${books.length} books from Aladin`);
    books.forEach(book => {
      console.log(`  ${book.rank}. ${book.title} - ${book.author}`);
    });
  } catch (e) {
    console.error('❌ Aladin failed:', e.message);
  }
}

async function testKyobo() {
  console.log('\n=== Testing Kyobo Scraper ===\n');

  await initBrowser();
  const page = await browser.newPage();
  let apiResponse = null;

  page.on('response', async (response) => {
    if (response.url().includes('best-seller/online')) {
      try {
        const json = await response.json();
        if (json.data && json.data.bestSeller) {
          apiResponse = json;
        }
      } catch (e) {}
    }
  });

  try {
    await page.setUserAgent(HEADERS['User-Agent']);
    const url = 'https://store.kyobobook.co.kr/bestseller/online/daily?dsplDvsnCode=000';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.close();

    if (apiResponse && apiResponse.data.bestSeller) {
      const books = apiResponse.data.bestSeller.slice(0, 5).map((item, idx) => ({
        rank: item.prstRnkn || (idx + 1),
        title: cleanTitle(item.cmdtName),
        author: cleanAuthor(item.chrcName),
        publisher: item.pbcmName || '알수없음'
      }));
      console.log(`✅ Found ${books.length} books from Kyobo`);
      books.forEach(book => {
        console.log(`  ${book.rank}. ${book.title} - ${book.author}`);
      });
    } else {
      console.log('❌ No API response from Kyobo');
    }
  } catch (e) {
    console.error('❌ Kyobo failed:', e.message);
    await page.close();
  }
}

async function run() {
  await testAladin();
  await testKyobo();

  if (browser) {
    await browser.close();
  }

  console.log('\n=== Test Complete ===\n');
}

run();
