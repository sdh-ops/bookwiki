"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

/**
 * [Bestseller Scraper FINAL - 5 Platforms Integrated]
 * 교보/예스24/알라딘/리디/밀리 - 모든 플랫폼 지원
 */

const COMMON_CATEGORIES = [
  { id: 'total', name: '종합', kyobo: '000', yes24: '001', aladdin: '0', ridi: 'general', millie: '0' },
  { id: 'fiction', name: '소설', kyobo: '100', yes24: '001001046', aladdin: '1', ridi: '100', millie: '1' },
  { id: 'essay', name: '에세이/시', kyobo: '300', yes24: '001001047', aladdin: '55889', ridi: '106', millie: '11' },
  { id: 'humanities', name: '인문', kyobo: '500', yes24: '001001019', aladdin: '656', ridi: '103', millie: '3' },
  { id: 'economy', name: '경제경영', kyobo: '1300', yes24: '001001025', aladdin: '170', ridi: '105', millie: '5' },
  { id: 'selfhelp', name: '자기계발', kyobo: '1500', yes24: '001001026', aladdin: '336', ridi: '113', millie: '6' }
];

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

// 예스24 - Axios 방식
async function scrapeYes24(category) {
  console.log(`[Yes24] ${category.name}...`);
  try {
    const url = `https://www.yes24.com/Product/Category/BestSeller?categoryNumber=${category.yes24}&pageNumber=1&pageSize=24`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const books = [];
    $('#yesBestList li, .itemUnit').slice(0, 20).each((i, el) => {
      const title = $(el).find('.gd_name').text().trim();
      const author = $(el).find('.info_auth').text().trim();
      const pub = $(el).find('.info_pub').text().trim();
      const img = $(el).find('img.lazy').attr('data-original') || $(el).find('img').attr('src');
      if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img });
    });

    return books;
  } catch (e) {
    console.error(`  [!] Error: ${e.message}`);
    return [];
  }
}

// 알라딘 - Axios 방식
async function scrapeAladdin(category) {
  console.log(`[Aladdin] ${category.name}...`);
  try {
    const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladdin}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const books = [];
    $('.ss_book_box').slice(0, 20).each((i, el) => {
      const title = $(el).find('.bo3').text().trim();
      const info = $(el).find('.ss_book_list li').eq(2).text().trim();
      const parts = info.split('|');
      const author = parts[0]?.trim();
      const pub = parts[1]?.trim();
      const img = $(el).find('.front_cover').attr('src');
      if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img });
    });

    return books;
  } catch (e) {
    console.error(`  [!] Error: ${e.message}`);
    return [];
  }
}

// 교보 - Puppeteer + API Response
async function scrapeKyobo(category) {
  console.log(`[Kyobo] ${category.name}...`);
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
    const url = `https://store.kyobobook.co.kr/bestseller/online/daily?dsplDvsnCode=${category.kyobo}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.close();

    if (apiResponse && apiResponse.data.bestSeller) {
      return apiResponse.data.bestSeller.slice(0, 20).map((item, idx) => ({
        rank: item.prstRnkn || (idx + 1),
        title: item.cmdtName,
        author: item.chrcName || '알수없음',
        publisher: item.pbcmName || '알수없음',
        cover_url: item.imgPath
      }));
    }

    return [];
  } catch (e) {
    console.error(`  [!] Error: ${e.message}`);
    await page.close();
    return [];
  }
}

// 리디 - Puppeteer + __NEXT_DATA__
async function scrapeRidi(category) {
  console.log(`[Ridi] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent(HEADERS['User-Agent']);
    const url = `https://ridibooks.com/category/bestseller/${category.ridi}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const books = await page.evaluate(() => {
      try {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (!nextDataEl) return [];
        const data = JSON.parse(nextDataEl.textContent);

        const booksData = data.props?.pageProps?.dehydratedState?.queries?.[2]?.state?.data || {};
        const bookItems = Object.values(booksData).filter(item => item && item.book);

        return bookItems.slice(0, 20).map((item, idx) => {
          const book = item.book;
          const authors = book.authors
            ?.filter(a => a.role === 'author' || a.role === 'AUTHOR')
            .map(a => a.name)
            .join(', ') || '알수없음';

          return {
            rank: idx + 1,
            title: book.title?.main || book.title,
            author: authors,
            publisher: book.publisher?.name || book.publicationInfo?.name || '리디북스',
            cover_url: `https://img.ridicdn.net/cover/${book.bookId || book.id}/xxlarge`
          };
        });
      } catch (e) {
        return [];
      }
    });

    await page.close();
    return books;

  } catch (e) {
    console.error(`  [!] Error: ${e.message}`);
    await page.close();
    return [];
  }
}

// 밀리 - Puppeteer + DOM
async function scrapeMillie(category) {
  console.log(`[Millie] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent(HEADERS['User-Agent']);
    const url = category.millie === '0'
      ? 'https://www.millie.co.kr/v3/bestseller'
      : `https://www.millie.co.kr/v3/rank?type=WEEKLY&category=${category.millie}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('[class*="book"], [class*="Book"], .list_unit', { timeout: 10000 });

    const books = await page.evaluate(() => {
      const items = [];
      const selectors = ['[class*="BookItem"]', '[class*="book-info"]', '.list_unit'];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, idx) => {
            if (idx >= 20) return;
            const titleEl = el.querySelector('.title, .name, h3, [class*="title"]');
            const authorEl = el.querySelector('.author, [class*="author"]');
            const imgEl = el.querySelector('img');

            const title = titleEl?.textContent?.trim();
            if (title) {
              items.push({
                rank: idx + 1,
                title,
                author: authorEl?.textContent?.trim() || '알수없음',
                publisher: '밀리의서재',
                cover_url: imgEl?.src || imgEl?.dataset?.src
              });
            }
          });

          if (items.length > 0) break;
        }
      }

      return items;
    });

    await page.close();
    return books;

  } catch (e) {
    console.error(`  [!] Error: ${e.message}`);
    await page.close();
    return [];
  }
}

async function sync(platform, books, categoryName) {
  if (books.length === 0) return;
  console.log(`  -> Syncing ${books.length} items for ${platform}...`);

  for (const book of books) {
    try {
      const cleanTitle = book.title.replace(/\[도서\]/g, '').trim();
      const { data: record } = await supabase.from('bw_books')
        .upsert({
          title: cleanTitle,
          author: book.author || '알수없음',
          publisher: book.publisher || '알수없음',
          cover_url: book.cover_url
        }, { onConflict: 'title,author' })
        .select().single();

      if (record) {
        await supabase.from('bw_bestseller_snapshots').insert({
          book_id: record.id,
          platform,
          period_type: 'daily',
          rank: book.rank,
          common_category: categoryName,
          snapshot_date: new Date().toISOString().split('T')[0]
        });
      }
    } catch (err) {
      // 중복 데이터 무시
    }
  }
}

async function run() {
  console.log('\n=== [5-Platform Bestseller Scraper FINAL] ===\n');

  await initBrowser();

  try {
    for (const cat of COMMON_CATEGORIES) {
      console.log(`\n> CATEGORY: ${cat.name}`);

      const [yes24, aladin, kyobo, ridi, millie] = await Promise.all([
        scrapeYes24(cat),
        scrapeAladdin(cat),
        scrapeKyobo(cat),
        scrapeRidi(cat),
        scrapeMillie(cat)
      ]);

      await sync('yes24', yes24, cat.name);
      await sync('aladdin', aladin, cat.name);
      await sync('kyobo', kyobo, cat.name);
      await sync('ridi', ridi, cat.name);
      await sync('millie', millie, cat.name);

      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('\n=== [All platforms scraped successfully!] ===');
}

run();
