"use strict";

const puppeteer = require('puppeteer');

/**
 * Quick test for Puppeteer scraper - Tests one category from each platform
 */

async function testKyobo() {
  console.log('\n=== Testing KYOBO ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://product.kyobobook.co.kr/category/KOR/01/bestseller?period=001', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('a.prod_info, .prod_item, [class*="prod"]', { timeout: 10000 });

    const books = await page.evaluate(() => {
      const items = [];
      const selectors = ['a.prod_info', '.prod_item', '[class*="product"]'];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, idx) => {
            if (idx >= 5) return;
            const titleEl = el.querySelector('.prod_name, .title, h3, [class*="title"]');
            const title = titleEl?.textContent?.trim();
            if (title) items.push({ rank: idx + 1, title });
          });
          if (items.length > 0) break;
        }
      }
      return items;
    });

    console.log(`✓ Found ${books.length} books`);
    books.forEach(b => console.log(`  ${b.rank}. ${b.title}`));

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function testRidi() {
  console.log('\n=== Testing RIDI ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://ridibooks.com/category/bestseller/100', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const books = await page.evaluate(() => {
      try {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (!nextDataEl) return [];
        const data = JSON.parse(nextDataEl.textContent);
        const items = data.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.bestsellers?.items || [];

        return items.slice(0, 5).map((item, idx) => {
          const book = item.book || item;
          return {
            rank: idx + 1,
            title: book.title?.main || book.title,
            author: book.authors?.filter(a => a.role === 'AUTHOR').map(a => a.name).join(', ')
          };
        });
      } catch (e) {
        return [];
      }
    });

    console.log(`✓ Found ${books.length} books`);
    books.forEach(b => console.log(`  ${b.rank}. ${b.title} - ${b.author}`));

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function testMillie() {
  console.log('\n=== Testing MILLIE ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.millie.co.kr/v3/bestseller', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('[class*="book"], [class*="Book"], .list_unit', { timeout: 10000 });

    const books = await page.evaluate(() => {
      const items = [];
      const selectors = ['[class*="BookItem"]', '[class*="book-info"]', '.list_unit'];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, idx) => {
            if (idx >= 5) return;
            const titleEl = el.querySelector('.title, .name, h3, [class*="title"]');
            const title = titleEl?.textContent?.trim();
            if (title) items.push({ rank: idx + 1, title });
          });
          if (items.length > 0) break;
        }
      }
      return items;
    });

    console.log(`✓ Found ${books.length} books`);
    books.forEach(b => console.log(`  ${b.rank}. ${b.title}`));

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  console.log('Starting Puppeteer tests...\n');
  await testKyobo();
  await testRidi();
  await testMillie();
  console.log('\n=== All tests complete ===');
}

run();
