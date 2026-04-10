"use strict";

const puppeteer = require('puppeteer');

async function testKyoboURL(url, name) {
  console.log(`\n=== Testing ${name} ===`);
  console.log(`URL: ${url}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 페이지 로드 후 약간 대기
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 페이지 내용 분석
    const info = await page.evaluate(() => {
      // __NEXT_DATA__ 확인
      const nextData = document.getElementById('__NEXT_DATA__');
      let hasBooks = false;
      let booksCount = 0;

      if (nextData) {
        try {
          const data = JSON.parse(nextData.textContent);
          const pageProps = data.props?.pageProps;

          // 다양한 경로 확인
          if (pageProps?.initialData?.items) {
            booksCount = pageProps.initialData.items.length;
            hasBooks = true;
          } else if (pageProps?.items) {
            booksCount = pageProps.items.length;
            hasBooks = true;
          } else if (pageProps?.data?.items) {
            booksCount = pageProps.data.items.length;
            hasBooks = true;
          }

          return {
            hasNextData: true,
            hasBooks,
            booksCount,
            pagePropsKeys: Object.keys(pageProps || {})
          };
        } catch (e) {
          return { hasNextData: true, parseError: e.message };
        }
      }

      // DOM 셀렉터로 확인
      const selectors = {
        '.prod_item': document.querySelectorAll('.prod_item').length,
        '[class*="product"]': document.querySelectorAll('[class*="product"]').length,
        '[class*="book"]': document.querySelectorAll('[class*="book"]').length,
        'a[href*="/product/"]': document.querySelectorAll('a[href*="/product/"]').length
      };

      return { hasNextData: false, selectors };
    });

    console.log('Result:', JSON.stringify(info, null, 2));

    // 데이터가 있으면 책 정보 추출 시도
    if (info.hasBooks || (info.selectors && Object.values(info.selectors).some(c => c > 10))) {
      const books = await page.evaluate(() => {
        const items = [];

        // __NEXT_DATA__에서 추출 시도
        const nextData = document.getElementById('__NEXT_DATA__');
        if (nextData) {
          try {
            const data = JSON.parse(nextData.textContent);
            const pp = data.props?.pageProps;
            const bookList = pp?.initialData?.items || pp?.items || pp?.data?.items || [];

            return bookList.slice(0, 5).map((book, idx) => ({
              rank: idx + 1,
              title: book.prodNm || book.cmmNm || book.title,
              author: book.athrNm || book.author
            }));
          } catch (e) {}
        }

        // DOM에서 추출 시도
        const links = document.querySelectorAll('a[href*="/product/"]');
        links.forEach((link, idx) => {
          if (idx >= 5) return;
          const title = link.textContent?.trim() || link.getAttribute('title');
          if (title && title.length > 3) {
            items.push({ rank: idx + 1, title });
          }
        });

        return items;
      });

      if (books.length > 0) {
        console.log(`\n✓ Found ${books.length} books:`);
        books.forEach(b => console.log(`  ${b.rank}. ${b.title}${b.author ? ' - ' + b.author : ''}`));
      }
    }

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  const urls = [
    ['https://product.kyobobook.co.kr/bestseller/online?period=001', 'Kyobo Product URL 1'],
    ['https://product.kyobobook.co.kr/category/KOR/01/bestseller?period=001', 'Kyobo Category URL'],
    ['https://store.kyobobook.co.kr/bestseller/online/weekly/domestic/01', 'Kyobo Store URL']
  ];

  for (const [url, name] of urls) {
    await testKyoboURL(url, name);
  }

  console.log('\n=== All Kyobo tests complete ===');
}

run();
