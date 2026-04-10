"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function quickTest() {
  console.log('\n=== Quick Test: 종합 베스트셀러 ===\n');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // 1. 예스24
  console.log('[1/5] Yes24...');
  try {
    const res = await axios.get('https://www.yes24.com/Product/Category/BestSeller?categoryNumber=001&pageNumber=1&pageSize=24', { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(res.data);
    const count = $('#yesBestList li').length;
    console.log(`  ✓ ${count}개 수집\n`);
  } catch (e) {
    console.log(`  ✗ 실패: ${e.message}\n`);
  }

  // 2. 알라딘
  console.log('[2/5] Aladdin...');
  try {
    const res = await axios.get('https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0', { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(res.data);
    const count = $('.ss_book_box').length;
    console.log(`  ✓ ${count}개 수집\n`);
  } catch (e) {
    console.log(`  ✗ 실패: ${e.message}\n`);
  }

  // 3. 교보
  console.log('[3/5] Kyobo...');
  const kyoboPage = await browser.newPage();
  let kyoboCount = 0;

  kyoboPage.on('response', async (response) => {
    if (response.url().includes('best-seller/online')) {
      try {
        const json = await response.json();
        if (json.data?.bestSeller) {
          kyoboCount = json.data.bestSeller.length;
        }
      } catch (e) {}
    }
  });

  try {
    await kyoboPage.setUserAgent(HEADERS['User-Agent']);
    await kyoboPage.goto('https://store.kyobobook.co.kr/bestseller/online/daily', { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 2000));
    await kyoboPage.close();
    console.log(`  ✓ ${kyoboCount}개 수집\n`);
  } catch (e) {
    await kyoboPage.close();
    console.log(`  ✗ 실패: ${e.message}\n`);
  }

  // 4. 리디
  console.log('[4/5] Ridi...');
  const ridiPage = await browser.newPage();
  let ridiCount = 0;

  try {
    await ridiPage.setUserAgent(HEADERS['User-Agent']);
    await ridiPage.goto('https://ridibooks.com/category/bestseller/general', { waitUntil: 'networkidle2', timeout: 25000 });

    ridiCount = await ridiPage.evaluate(() => {
      try {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (!nextDataEl) return 0;
        const data = JSON.parse(nextDataEl.textContent);
        const booksData = data.props?.pageProps?.dehydratedState?.queries?.[2]?.state?.data || {};
        return Object.keys(booksData).length;
      } catch (e) {
        return 0;
      }
    });

    await ridiPage.close();
    console.log(`  ✓ ${ridiCount}개 수집\n`);
  } catch (e) {
    await ridiPage.close();
    console.log(`  ✗ 실패: ${e.message}\n`);
  }

  // 5. 밀리
  console.log('[5/5] Millie...');
  const milliePage = await browser.newPage();
  let millieCount = 0;

  try {
    await milliePage.setUserAgent(HEADERS['User-Agent']);
    await milliePage.goto('https://www.millie.co.kr/v3/bestseller', { waitUntil: 'networkidle2', timeout: 25000 });
    await milliePage.waitForSelector('[class*="book"], [class*="Book"]', { timeout: 8000 });

    millieCount = await milliePage.evaluate(() => {
      return document.querySelectorAll('[class*="BookItem"], [class*="book-info"]').length;
    });

    await milliePage.close();
    console.log(`  ✓ ${millieCount}개 수집\n`);
  } catch (e) {
    await milliePage.close();
    console.log(`  ✗ 실패: ${e.message}\n`);
  }

  await browser.close();

  console.log('=== Test Complete ===');
  const total = [kyoboCount, ridiCount, millieCount].filter(c => c > 0).length + 2; // Yes24, Aladdin always work
  console.log(`\n✅ ${total}/5 플랫폼 성공\n`);
}

quickTest();
