"use strict";

const puppeteer = require('puppeteer');
const { supabase } = require('./common');

/**
 * [Bestseller Scraper V12 - Puppeteer Edition]
 * Headless browser 기반으로 모든 플랫폼 지원
 */

const COMMON_CATEGORIES = [
  { id: 'total', name: '종합', kyobo: '01', yes24: '001', aladdin: '0', ridi: 'general', millie: '0' },
  { id: 'fiction', name: '소설', kyobo: '01', yes24: '001001046', aladdin: '1', ridi: '100', millie: '1' },
  { id: 'essay', name: '에세이/시', kyobo: '03', yes24: '001001047', aladdin: '55889', ridi: '106', millie: '11' },
  { id: 'humanities', name: '인문', kyobo: '05', yes24: '001001019', aladdin: '656', ridi: '103', millie: '3' },
  { id: 'economy', name: '경제경영', kyobo: '13', yes24: '001001025', aladdin: '170', ridi: '105', millie: '5' },
  { id: 'selfhelp', name: '자기계발', kyobo: '15', yes24: '001001026', aladdin: '336', ridi: '113', millie: '6' }
];

let browser = null;

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

async function scrapeKyobo(category) {
  console.log(`[Kyobo] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    const url = `https://product.kyobobook.co.kr/category/KOR/${category.kyobo}/bestseller?period=001`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 페이지가 로드될 때까지 대기
    await page.waitForSelector('a.prod_info, .prod_item, [class*="prod"]', { timeout: 10000 });

    const books = await page.evaluate(() => {
      const items = [];

      // 다양한 선택자 시도
      const selectors = [
        'a.prod_info',
        '.prod_item',
        '[class*="product"]',
        '[data-id]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, idx) => {
            if (idx >= 20) return;

            const titleEl = el.querySelector('.prod_name, .title, h3, [class*="title"]');
            const authorEl = el.querySelector('.author, [class*="author"]');
            const pubEl = el.querySelector('.publisher, [class*="pub"]');
            const imgEl = el.querySelector('img');

            const title = titleEl?.textContent?.trim();
            if (title) {
              items.push({
                rank: idx + 1,
                title: title,
                author: authorEl?.textContent?.trim() || '알수없음',
                publisher: pubEl?.textContent?.trim() || '알수없음',
                cover_url: imgEl?.src || imgEl?.dataset?.src || null
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
    console.error(`  [!] Kyobo Error: ${e.message}`);
    await page.close();
    return [];
  }
}

async function scrapeRidi(category) {
  console.log(`[Ridi] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    const url = `https://ridibooks.com/category/bestseller/${category.ridi}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // __NEXT_DATA__ JSON 추출
    const books = await page.evaluate(() => {
      try {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (!nextDataEl) return [];

        const data = JSON.parse(nextDataEl.textContent);
        const items = data.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.bestsellers?.items ||
                     data.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.books || [];

        return items.slice(0, 20).map((item, idx) => {
          const book = item.book || item;
          const authors = book.authors?.filter(a => a.role === 'AUTHOR').map(a => a.name).join(', ') || '알수없음';

          return {
            rank: idx + 1,
            title: book.title?.main || book.title || '제목없음',
            author: authors,
            publisher: book.publicationInfo?.name || '리디북스',
            cover_url: `https://img.ridicdn.net/cover/${book.id}/xxlarge`
          };
        });
      } catch (e) {
        console.error('Ridi parse error:', e.message);
        return [];
      }
    });

    await page.close();
    return books;

  } catch (e) {
    console.error(`  [!] Ridi Error: ${e.message}`);
    await page.close();
    return [];
  }
}

async function scrapeMillie(category) {
  console.log(`[Millie] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    const url = category.millie === '0'
      ? 'https://www.millie.co.kr/v3/bestseller'
      : `https://www.millie.co.kr/v3/rank?type=WEEKLY&category=${category.millie}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // SPA 렌더링 대기
    await page.waitForSelector('[class*="book"], [class*="Book"], .list_unit', { timeout: 10000 });

    const books = await page.evaluate(() => {
      const items = [];

      const selectors = [
        '[class*="BookItem"]',
        '[class*="book-info"]',
        '.list_unit',
        '[class*="RankItem"]'
      ];

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
                title: title,
                author: authorEl?.textContent?.trim() || '알수없음',
                publisher: '밀리의서재',
                cover_url: imgEl?.src || imgEl?.dataset?.src || null
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
    console.error(`  [!] Millie Error: ${e.message}`);
    await page.close();
    return [];
  }
}

async function scrapeYes24(category) {
  console.log(`[Yes24] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    const url = `https://www.yes24.com/Product/Category/BestSeller?categoryNumber=${category.yes24}&pageNumber=1&pageSize=24`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const books = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('#yesBestList li, .itemUnit').forEach((el, idx) => {
        if (idx >= 20) return;

        const title = el.querySelector('.gd_name')?.textContent?.trim();
        const author = el.querySelector('.info_auth')?.textContent?.trim();
        const pub = el.querySelector('.info_pub')?.textContent?.trim();
        const img = el.querySelector('img.lazy')?.dataset?.original || el.querySelector('img')?.src;

        if (title) {
          items.push({
            rank: idx + 1,
            title: title,
            author: author || '알수없음',
            publisher: pub || '알수없음',
            cover_url: img
          });
        }
      });
      return items;
    });

    await page.close();
    return books;

  } catch (e) {
    console.error(`  [!] Yes24 Error: ${e.message}`);
    await page.close();
    return [];
  }
}

async function scrapeAladdin(category) {
  console.log(`[Aladdin] ${category.name}...`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladdin}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const books = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.ss_book_box').forEach((el, idx) => {
        if (idx >= 20) return;

        const title = el.querySelector('.bo3')?.textContent?.trim();
        const info = el.querySelector('.ss_book_list li:nth-child(3)')?.textContent?.trim();
        const parts = info?.split('|') || [];
        const author = parts[0]?.trim();
        const pub = parts[1]?.trim();
        const img = el.querySelector('.front_cover')?.src;

        if (title) {
          items.push({
            rank: idx + 1,
            title: title,
            author: author || '알수없음',
            publisher: pub || '알수없음',
            cover_url: img
          });
        }
      });
      return items;
    });

    await page.close();
    return books;

  } catch (e) {
    console.error(`  [!] Aladdin Error: ${e.message}`);
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
  console.log('\n=== [Bestseller Engine V12: Puppeteer Edition] ===\n');

  await initBrowser();

  try {
    for (const cat of COMMON_CATEGORIES) {
      console.log(`\n> CATEGORY: ${cat.name}`);

      const [kyobo, yes24, aladin, ridi, millie] = await Promise.all([
        scrapeKyobo(cat),
        scrapeYes24(cat),
        scrapeAladdin(cat),
        scrapeRidi(cat),
        scrapeMillie(cat)
      ]);

      await sync('kyobo', kyobo, cat.name);
      await sync('yes24', yes24, cat.name);
      await sync('aladdin', aladin, cat.name);
      await sync('ridi', ridi, cat.name);
      await sync('millie', millie, cat.name);

      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('\n=== [Engine V12 Finish] ===');
}

run();
