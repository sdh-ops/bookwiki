"use strict";

const puppeteer = require('puppeteer');

async function debugHailMary() {
  console.log('\n=== Debugging 프로젝트 헤일메리 from Kyobo API ===\n');

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
      const hailMary = apiResponse.data.bestSeller.find(book =>
        book.cmdtName && book.cmdtName.includes('헤일메리')
      );

      if (hailMary) {
        console.log('프로젝트 헤일메리 원본 데이터:');
        console.log(JSON.stringify(hailMary, null, 2));
      } else {
        console.log('❌ 헤일메리를 찾을 수 없습니다.');
        console.log('\n모든 책 제목:');
        apiResponse.data.bestSeller.slice(0, 20).forEach((book, idx) => {
          console.log(`${idx + 1}. ${book.cmdtName} - ${book.chrcName}`);
        });
      }
    } else {
      console.log('❌ API 응답을 받지 못했습니다.');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

debugHailMary();
