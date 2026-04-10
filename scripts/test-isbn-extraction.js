"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

// Test Yes24
async function testYes24() {
  console.log('\n=== YES24 ===');
  try {
    const url = 'https://www.yes24.com/Product/Category/BestSeller?categoryNumber=001&pageNumber=1&pageSize=24';
    const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
    const $ = cheerio.load(res.data);

    const firstBook = $('#yesBestList li, .itemUnit').first();
    const title = firstBook.find('.gd_name').text().trim();

    // Search for ISBN in various locations
    const wholeHtml = firstBook.html();
    const isbnMatch = wholeHtml.match(/isbn[^\w]*([\d]{13}|[\d]{10})/i);

    console.log('Title:', title);
    console.log('ISBN in HTML:', isbnMatch ? isbnMatch[1] : 'NOT FOUND');

    // Check link structure
    const link = firstBook.find('a').attr('href');
    console.log('Link:', link);

  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test Aladdin
async function testAladdin() {
  console.log('\n=== ALADDIN ===');
  try {
    const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0';
    const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
    const $ = cheerio.load(res.data);

    const firstBook = $('.ss_book_box').first();
    const title = firstBook.find('.bo3').text().trim();

    // Check for ISBN attribute
    const isbnAttr = firstBook.find('[isbn]').attr('isbn');
    const isbnDiv = firstBook.find('.Search3_Result_SafeBasketArea').attr('isbn');

    console.log('Title:', title);
    console.log('ISBN (attribute):', isbnAttr || isbnDiv || 'NOT FOUND');

    // Check links with ISBN
    const links = firstBook.find('a[href*="ISBN"]');
    if (links.length > 0) {
      const href = links.first().attr('href');
      const isbnMatch = href.match(/ISBN=([A-Z0-9]+)/i);
      console.log('ISBN from link:', isbnMatch ? isbnMatch[1] : 'NOT FOUND');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test Kyobo
async function testKyobo() {
  console.log('\n=== KYOBO ===');
  const browser = await puppeteer.launch({ headless: 'new' });
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

    if (apiResponse && apiResponse.data.bestSeller) {
      const firstBook = apiResponse.data.bestSeller[0];
      console.log('Title:', firstBook.cmdtName);
      console.log('API fields:', Object.keys(firstBook).join(', '));
      console.log('ISBN field:', firstBook.isbn || firstBook.isbn13 || firstBook.isbnCode || 'NOT FOUND');
      console.log('Full item:', JSON.stringify(firstBook, null, 2).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await page.close();
    await browser.close();
  }
}

// Test Ridi
async function testRidi() {
  console.log('\n=== RIDI ===');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(HEADERS['User-Agent']);
    const url = 'https://ridibooks.com/category/bestseller/general';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (!nextDataEl) return null;
      const json = JSON.parse(nextDataEl.textContent);

      const booksData = json.props?.pageProps?.dehydratedState?.queries?.[2]?.state?.data || {};
      const bookItems = Object.values(booksData).filter(item => item && item.book);

      if (bookItems.length > 0) {
        const firstBook = bookItems[0].book;
        return {
          title: firstBook.title?.main || firstBook.title,
          fields: Object.keys(firstBook).join(', '),
          isbn: firstBook.isbn || firstBook.isbn13 || 'NOT FOUND',
          sample: JSON.stringify(firstBook).substring(0, 500)
        };
      }
      return null;
    });

    if (data) {
      console.log('Title:', data.title);
      console.log('Book fields:', data.fields);
      console.log('ISBN:', data.isbn);
      console.log('Sample:', data.sample);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await page.close();
    await browser.close();
  }
}

// Test Millie
async function testMillie() {
  console.log('\n=== MILLIE ===');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(HEADERS['User-Agent']);
    const url = 'https://www.millie.co.kr/v3/bestseller';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    const data = await page.evaluate(() => {
      // Try to find ISBN in various places
      const links = document.querySelectorAll('a[href*="/book/"]');
      if (links.length > 0) {
        const firstLink = links[0];
        const href = firstLink.href;
        const title = firstLink.querySelector('[class*="title"], [class*="Title"], h3, p')?.textContent?.trim();

        // Check if there's any ISBN in the page HTML
        const pageHtml = document.documentElement.outerHTML;
        const isbnMatch = pageHtml.match(/isbn[^\w]*([\d]{13}|[\d]{10})/i);

        return {
          title,
          link: href,
          isbnInPage: isbnMatch ? isbnMatch[1] : 'NOT FOUND'
        };
      }
      return null;
    });

    if (data) {
      console.log('Title:', data.title);
      console.log('Link:', data.link);
      console.log('ISBN in page:', data.isbnInPage);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await page.close();
    await browser.close();
  }
}

async function run() {
  await testYes24();
  await testAladdin();
  await testKyobo();
  await testRidi();
  await testMillie();
}

run();
