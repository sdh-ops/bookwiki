"use strict";

const puppeteer = require('puppeteer');

async function testRidiCorrect() {
  console.log('\n=== Testing RIDI (Correct Data Path) ===');
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

        // Query 2에 실제 책 데이터가 있음 (숫자 키로 저장)
        const booksData = data.props?.pageProps?.dehydratedState?.queries?.[2]?.state?.data || {};

        // 숫자 키들을 배열로 변환
        const bookItems = Object.values(booksData).filter(item => item && item.book);

        return bookItems.slice(0, 20).map((item, idx) => {
          const book = item.book;
          const authors = book.authors
            ?.filter(a => a.role === 'author' || a.role === 'AUTHOR')
            .map(a => a.name)
            .join(', ') || '알수없음';

          return {
            rank: idx + 1,
            title: book.title?.main || book.title,
            author: authors,
            publisher: book.publisher?.name || book.publicationInfo?.name || '리디북스',
            cover_url: `https://img.ridicdn.net/cover/${book.bookId || book.id}/xxlarge`
          };
        });
      } catch (e) {
        console.error('Parse error:', e.message);
        return [];
      }
    });

    console.log(`✓ Found ${books.length} books`);
    books.forEach(b => console.log(`  ${b.rank}. ${b.title} - ${b.author}`));

    return books;

  } catch (e) {
    console.error('✗ Error:', e.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function run() {
  const books = await testRidiCorrect();
  console.log('\n=== Test complete ===');
  console.log(`Final count: ${books.length} books`);
}

run();
