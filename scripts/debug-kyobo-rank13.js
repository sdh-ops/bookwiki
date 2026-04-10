"use strict";

const puppeteer = require('puppeteer');

async function debugKyoboRank13() {
  console.log('\n=== Checking Kyobo Rank 13 ===\n');

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
      const rank13 = apiResponse.data.bestSeller.find(book => book.prstRnkn === 13);

      if (rank13) {
        console.log('Rank 13 book:');
        console.log('  Title:', rank13.cmdtName);
        console.log('  Author:', rank13.chrcName);
        console.log('  ISBN:', rank13.cmdtCode);
        console.log('  imgPath:', rank13.imgPath || '(empty)');
        console.log('\nFull data:');
        console.log(JSON.stringify(rank13, null, 2));
      } else {
        console.log('❌ No book at rank 13');
      }

      console.log('\n\nAll books 1-20:');
      apiResponse.data.bestSeller.slice(0, 20).forEach((book, idx) => {
        console.log(`${book.prstRnkn}. ${book.cmdtName} - ${book.chrcName}`);
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

debugKyoboRank13();
