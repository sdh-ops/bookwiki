"use strict";

const puppeteer = require('puppeteer');

async function testKyoboAPI() {
  console.log('\n=== Testing Kyobo API Response ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://store.kyobobook.co.kr/bestseller/online/daily?dsplDvsnCode=000',
      { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    if (apiResponse && apiResponse.data.bestSeller) {
      const firstBook = apiResponse.data.bestSeller[0];
      console.log('첫 번째 책 전체 구조:');
      console.log(JSON.stringify(firstBook, null, 2));

      console.log('\n\n이미지 관련 필드:');
      Object.keys(firstBook).forEach(key => {
        if (key.toLowerCase().includes('img') ||
            key.toLowerCase().includes('image') ||
            key.toLowerCase().includes('cover') ||
            key.toLowerCase().includes('path')) {
          console.log(`  ${key}: ${firstBook[key]}`);
        }
      });
    } else {
      console.log('❌ API 응답을 받지 못했습니다.');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

testKyoboAPI();
