"use strict";

const puppeteer = require('puppeteer');

async function testMillieAPIIntercept() {
  console.log('\n=== Intercepting Millie API Calls ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const bookAPICalls = [];
  page.on('response', async (response) => {
    const url = response.url();

    // 책 관련 API 호출만 잡기
    if (url.includes('best') || url.includes('rank') || url.includes('book')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const json = await response.json();

          // JSON 데이터에서 책 정보가 있는지 확인
          const hasBooks = JSON.stringify(json).includes('title') &&
                          (JSON.stringify(json).includes('author') ||
                           JSON.stringify(json).includes('writer'));

          bookAPICalls.push({
            url,
            status: response.status(),
            hasBooks,
            dataSize: JSON.stringify(json).length
          });

          // 책이 있다면 샘플 데이터 저장
          if (hasBooks) {
            console.log('\n✅ Found book API:', url);
            console.log('Sample data:', JSON.stringify(json).substring(0, 200) + '...');
          }
        }
      } catch (e) {
        // Not JSON or error parsing
      }
    }
  });

  try {
    console.log('1. Loading homepage...');
    await page.goto('https://www.millie.co.kr/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    console.log('2. Clicking "서점베스트" if found...');
    const bestsellerClicked = await page.evaluate(() => {
      const bestLink = Array.from(document.querySelectorAll('a'))
        .find(a => a.textContent?.includes('서점베스트') || a.textContent?.includes('베스트'));

      if (bestLink) {
        bestLink.click();
        return true;
      }
      return false;
    });

    if (bestsellerClicked) {
      console.log('  -> Clicked! Waiting for API calls...');
      await new Promise(r => setTimeout(r, 5000));
    } else {
      console.log('  -> Bestseller link not found, trying direct URL...');
      await page.goto('https://www.millie.co.kr/v3/today/more/best/bookstore/total',
        { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n3. Trying to click category tabs...');

    // 카테고리 탭 찾아서 클릭 (소설, 경제경영 등)
    const categories = ['소설', '경제경영', '자기계발'];

    for (const catName of categories) {
      const clicked = await page.evaluate((name) => {
        const tab = Array.from(document.querySelectorAll('button, a, div[role="tab"]'))
          .find(el => el.textContent?.trim() === name);

        if (tab) {
          tab.click();
          return true;
        }
        return false;
      }, catName);

      if (clicked) {
        console.log(`  -> Clicked "${catName}", waiting...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    console.log('\n4. API Calls Summary:');
    console.log(`Total book-related API calls: ${bookAPICalls.length}`);

    if (bookAPICalls.length > 0) {
      console.log('\nAll book API endpoints:');
      bookAPICalls.forEach(call => {
        console.log(`  ${call.hasBooks ? '✅' : '  '} ${call.url}`);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

testMillieAPIIntercept();
