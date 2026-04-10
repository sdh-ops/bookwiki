"use strict";

const puppeteer = require('puppeteer');

async function captureKyoboAPI() {
  console.log('\n=== Capturing Kyobo API Response ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  let apiResponse = null;

  // 응답 가로채기
  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('best-seller/online')) {
      console.log(`\n✓ Captured API response: ${url}`);

      try {
        const json = await response.json();
        apiResponse = json;
        console.log('Response keys:', Object.keys(json));

        console.log('\nData type:', typeof json.data);
        console.log('Data is array?', Array.isArray(json.data));

        if (json.data) {
          console.log('Data keys:', Object.keys(json.data));

          // data가 객체인 경우 내부 구조 확인
          if (typeof json.data === 'object' && !Array.isArray(json.data)) {
            const dataKeys = Object.keys(json.data);
            dataKeys.forEach(key => {
              const val = json.data[key];
              console.log(`  ${key}:`, Array.isArray(val) ? `Array(${val.length})` : typeof val);
            });

            // 배열을 찾아서 출력
            for (const key of dataKeys) {
              if (Array.isArray(json.data[key]) && json.data[key].length > 0) {
                console.log(`\n✓ Found array in data.${key} with ${json.data[key].length} items`);
                const first = json.data[key][0];
                console.log('First item keys:', Object.keys(first));
                console.log('Sample:', JSON.stringify(first, null, 2).substring(0, 500));
                break;
              }
            }
          } else if (Array.isArray(json.data)) {
            console.log(`✓ Found ${json.data.length} items in data array`);
            if (json.data.length > 0) {
              const first = json.data[0];
              console.log('\nFirst item keys:', Object.keys(first));
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON:', e.message);
      }
    }
  });

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://store.kyobobook.co.kr/bestseller/online/daily', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    if (apiResponse && apiResponse.data && apiResponse.data.bestSeller) {
      console.log('\n=== Extracting books ===');
      const books = apiResponse.data.bestSeller.slice(0, 20).map((item, idx) => ({
        rank: item.prstRnkn || (idx + 1),
        title: item.cmdtName,
        author: item.chrcName,
        publisher: item.pbcmName,
        cover_url: item.imgPath
      }));

      console.log(`\n✓ Extracted ${books.length} books:\n`);
      books.forEach(b => console.log(`${b.rank}. ${b.title} - ${b.author}`));

      return books;
    }

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }

  return [];
}

async function run() {
  const books = await captureKyoboAPI();
  console.log(`\n=== Complete: ${books.length} books ===`);
}

run();
