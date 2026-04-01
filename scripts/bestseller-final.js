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

// 저자명 정리 함수
function cleanAuthor(author) {
  if (!author) return '알수없음';

  // 가격 정보나 불필요한 태그 제거
  if (author.includes('원') && author.includes('할인')) {
    return '알수없음';
  }

  return author
    .replace(/\(지은이\)/g, '')
    .replace(/\(옮긴이\)/g, '')
    .replace(/\(감수\)/g, '')
    .replace(/\(그림\)/g, '')
    .replace(/\(저\)/g, '')
    .replace(/\(역\)/g, '')
    .replace(/\(엮은이\)/g, '')
    .replace(/\(편저\)/g, '')
    .replace(/\(글\)/g, '')
    .replace(/저$/g, '')
    .replace(/역$/g, '')
    .replace(/편저$/g, '')
    .split(',')[0]  // 여러 저자 중 첫 번째만
    .split('/')[0]  // 슬래시로 구분된 경우 첫 번째만
    .split('|')[0]  // 구분자가 섞인 경우
    .trim() || '알수없음';
}

// 날짜 형식 통일 함수 (YYYY-MM-DD)
function formatDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  if (cleaned.length === 6) {
    // 2024년 3월 -> 2024-03-01
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-01`;
  }
  return null;
}

// 어제 날짜 (KST 기준) 가져오기
function getYesterdayKST() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  kstNow.setDate(kstNow.getDate() - 1);
  return kstNow.toISOString().split('T')[0];
}

// 예스24 - Axios 방식 (재시도 로직 포함)
async function scrapeYes24(category, retries = 3) {
  console.log(`[Yes24] ${category.name}...`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.yes24.com/Product/Category/DayBestSeller?CategoryNumber=${category.yes24}&pageNumber=1&pageSize=50`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];
      $('#yesBestList li, .itemUnit').slice(0, 50).each((i, el) => {
        const title = $(el).find('.gd_name').text().trim();
        const author = cleanAuthor($(el).find('.info_auth, .info_pub').first().text().trim());
        const img = $(el).find('img.lazy').attr('data-original') || $(el).find('img').attr('src');
        
        // 출판사 및 출간일 추출 (info_pub 내에 있음 예: 출판사 | 2024년 03월)
        const pubText = $(el).find('.info_pub').text().trim();
        const pub = pubText.split('|')[0]?.trim() || '알수없음';
        const dateMatch = pubText.match(/\d{4}년\s*\d{1,2}월/);
        const pubDate = dateMatch ? formatDate(dateMatch[0]) : null;

        if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img, pub_date: pubDate });
      });

      if (books.length > 0) return books;
      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 알라딘 - Axios 방식 (재시도 로직 포함)
async function scrapeAladdin(category, retries = 3) {
  console.log(`[Aladdin] ${category.name}...`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladdin}`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];
      $('.ss_book_box').slice(0, 50).each((i, el) => {
        const title = $(el).find('.bo3').text().trim();
        // 알라딘은 보통 세 번째 li에 저자|출판사|날짜 정보가 있음
        let info = $(el).find('.ss_book_list li').filter((idx, li) => $(li).text().includes('|')).first().text().trim();
        const parts = info.split('|');
        const author = cleanAuthor(parts[0]?.trim());
        const pub = parts[1]?.trim();
        const dateStr = parts[2]?.trim(); // 알라딘은 보통 세 번째가 날짜
        const pubDate = formatDate(dateStr);
        const img = $(el).find('.front_cover').attr('src');
        if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img, pub_date: pubDate });
      });

      if (books.length > 0) return books;
      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 교보 - Puppeteer + API Response (재시도 로직 포함)
async function scrapeKyobo(category, retries = 3) {
  console.log(`[Kyobo] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
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
      // 국내도서(domestic) 필터 추가 및 per=50 설정
      const url = `https://store.kyobobook.co.kr/bestseller/online/daily/domestic?dsplDvsnCode=${category.kyobo}&per=50`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      await page.close();

      if (apiResponse && apiResponse.data.bestSeller) {
        return apiResponse.data.bestSeller.slice(0, 50).map((item, idx) => ({
          rank: item.prstRnkn || (idx + 1),
          title: item.cmdtName,
          author: cleanAuthor(item.chrcName),
          publisher: item.pbcmName || '알수없음',
          cover_url: item.imgPath,
          pub_date: formatDate(item.rlseDate)
        }));
      }

      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      await page.close();
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 리디 - Puppeteer + __NEXT_DATA__ (재시도 로직 포함)
async function scrapeRidi(category, retries = 3) {
  console.log(`[Ridi] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();

    try {
      await page.setUserAgent(HEADERS['User-Agent']);
      const url = `https://ridibooks.com/category/bestseller/${category.ridi}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      const books = await page.evaluate(() => {
        try {
          const nextDataEl = document.getElementById('__NEXT_DATA__');
          if (!nextDataEl) return [];
          const data = JSON.parse(nextDataEl.textContent);

          const booksData = data.props?.pageProps?.dehydratedState?.queries?.[2]?.state?.data || {};
          const bookItems = Object.values(booksData).filter(item => item && item.book);

          return bookItems.slice(0, 50).map((item, idx) => {
            const book = item.book;
            const authors = book.authors
              ?.filter(a => ['author', 'AUTHOR', 'original_author'].includes(a.role))
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

      // 저자 정리
      const cleanedBooks = books.map(book => ({
        ...book,
        author: cleanAuthor(book.author)
      }));

      if (cleanedBooks.length > 0) return cleanedBooks;
      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      await page.close();
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 밀리 - Puppeteer + DOM (재시도 및 다양한 셀렉터 전략)
async function scrapeMillie(category, retries = 3) {
  console.log(`[Millie] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();

    try {
      await page.setUserAgent(HEADERS['User-Agent']);
      const url = category.millie === '0'
        ? 'https://www.millie.co.kr/v3/bestseller'
        : `https://www.millie.co.kr/v3/rank?type=WEEKLY&category=${category.millie}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // 더 긴 대기 시간과 다양한 셀렉터 시도
      await new Promise(r => setTimeout(r, 5000));

      // 여러 셀렉터 중 하나라도 나타날 때까지 기다림
      try {
        await Promise.race([
          page.waitForSelector('[class*="book"]', { timeout: 30000 }),
          page.waitForSelector('[class*="Book"]', { timeout: 30000 }),
          page.waitForSelector('a[href*="/book/"]', { timeout: 30000 }),
          page.waitForSelector('img[alt]', { timeout: 30000 })
        ]);
      } catch (e) {
        console.log(`  [!] Selector wait timeout, trying to extract anyway...`);
      }

      const books = await page.evaluate(() => {
        const items = [];

        // 더 많은 셀렉터 전략
        const strategies = [
          // 전략 1: 링크 기반
          () => {
            const links = document.querySelectorAll('a[href*="/book/"]');
            links.forEach((link, idx) => {
              if (idx >= 50) return;
              const title = link.querySelector('[class*="title"], [class*="Title"], h3, p')?.textContent?.trim();
              const author = link.querySelector('[class*="author"], [class*="Author"]')?.textContent?.trim();
              const img = link.querySelector('img');
              if (title) {
                items.push({
                  rank: idx + 1,
                  title,
                  author: author || '알수없음',
                  publisher: '밀리의서재',
                  cover_url: img?.src || img?.dataset?.src
                });
              }
            });
          },
          // 전략 2: BookItem 클래스
          () => {
            const elements = document.querySelectorAll('[class*="BookItem"], [class*="book-item"]');
            elements.forEach((el, idx) => {
              if (idx >= 50) return;
              const title = el.querySelector('[class*="title"], [class*="Title"], h3')?.textContent?.trim();
              const author = el.querySelector('[class*="author"], [class*="Author"]')?.textContent?.trim();
              const img = el.querySelector('img');
              if (title) {
                items.push({
                  rank: idx + 1,
                  title,
                  author: author || '알수없음',
                  publisher: '밀리의서재',
                  cover_url: img?.src || img?.dataset?.src
                });
              }
            });
          },
          // 전략 3: 이미지 기반
          () => {
            const images = document.querySelectorAll('img[alt]');
            images.forEach((img, idx) => {
              if (idx >= 50 || !img.alt) return;
              const parent = img.closest('a, div, li');
              const title = img.alt || parent?.querySelector('[class*="title"]')?.textContent?.trim();
              const author = parent?.querySelector('[class*="author"]')?.textContent?.trim();
              if (title && title.length > 2) {
                items.push({
                  rank: idx + 1,
                  title,
                  author: author || '알수없음',
                  publisher: '밀리의서재',
                  cover_url: img.src || img.dataset?.src
                });
              }
            });
          }
        ];

        // 각 전략을 순서대로 시도
        for (const strategy of strategies) {
          try {
            strategy();
            if (items.length > 0) break;
          } catch (e) {
            console.error('Strategy failed:', e);
          }
        }

        return items;
      });

      await page.close();

      // 저자 정리
      const cleanedBooks = books.map(book => ({
        ...book,
        author: cleanAuthor(book.author)
      }));

      if (cleanedBooks.length > 0) {
        console.log(`  [✓] Found ${cleanedBooks.length} books`);
        return cleanedBooks;
      }

      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      await page.close();
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  return [];
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
          cover_url: book.cover_url,
          pub_date: book.pub_date || null
        }, { onConflict: 'title,author' })
        .select().single();

      if (record) {
        await supabase.from('bw_bestseller_snapshots').insert({
          book_id: record.id,
          platform,
          period_type: 'daily',
          rank: book.rank,
          common_category: categoryName,
          snapshot_date: getYesterdayKST()
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
