"use strict";

const puppeteer = require('puppeteer');

async function testMillieNextData() {
  console.log('\n=== Testing Millie for __NEXT_DATA__ ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Intercept API calls
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') || url.includes('best') || url.includes('rank')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const json = await response.json();
          apiCalls.push({
            url: url.substring(0, 100),
            status: response.status(),
            hasData: !!json
          });
        }
      } catch (e) {
        // Not JSON or parsing failed
      }
    }
  });

  try {
    await page.goto('https://www.millie.co.kr/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    const result = await page.evaluate(() => {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (!nextDataEl) {
        return { hasNextData: false };
      }

      try {
        const data = JSON.parse(nextDataEl.textContent);
        const pageProps = data.props?.pageProps || {};

        // pageProps에서 책 데이터 찾기
        const books = [];
        const searchForBooks = (obj, depth = 0) => {
          if (depth > 5 || !obj || typeof obj !== 'object') return;

          // 책 객체로 보이는 것 찾기 (title, author 등이 있는 객체)
          if (obj.title && typeof obj.title === 'string' && obj.title.length > 2) {
            books.push({
              title: obj.title,
              author: obj.author || obj.authorName || '알수없음',
              id: obj.id || obj.bookId
            });
          }

          // 재귀적으로 탐색
          for (const key in obj) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => searchForBooks(item, depth + 1));
            } else if (typeof obj[key] === 'object') {
              searchForBooks(obj[key], depth + 1);
            }
          }
        };

        searchForBooks(pageProps);

        return {
          hasNextData: true,
          booksFound: books.length,
          sampleBooks: books.slice(0, 5)
        };
      } catch (e) {
        return { hasNextData: true, parseError: e.message };
      }
    });

    console.log('Page Structure:', JSON.stringify(result, null, 2));
    console.log('\nAPI Calls Intercepted:', apiCalls.length);
    if (apiCalls.length > 0) {
      console.log('Sample API calls:');
      apiCalls.slice(0, 5).forEach(call => {
        console.log('  -', call.url);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

testMillieNextData();
