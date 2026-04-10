"use strict";

const puppeteer = require('puppeteer');

async function testRidiFix() {
  console.log('\n=== Testing RIDI (Fixed) ===');
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

        // 수정: bestsellers.items 대신 books 사용
        const items = data.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.books || [];

        return items.slice(0, 10).map((book, idx) => ({
          rank: idx + 1,
          title: book.title?.main || book.title,
          author: book.authors?.filter(a => a.role === 'AUTHOR').map(a => a.name).join(', ') || '알수없음',
          publisher: book.publicationInfo?.name || '리디북스',
          cover_url: `https://img.ridicdn.net/cover/${book.id}/xxlarge`
        }));
      } catch (e) {
        console.error('Parse error:', e.message);
        return [];
      }
    });

    console.log(`✓ Found ${books.length} books`);
    books.forEach(b => console.log(`  ${b.rank}. ${b.title} - ${b.author}`));

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function testKyoboLongerWait() {
  console.log('\n=== Testing KYOBO (Longer Wait + Different Selectors) ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://product.kyobobook.co.kr/category/KOR/01/bestseller?period=001', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 더 오래 기다리기
    console.log('  Waiting for content to load...');
    await page.waitForTimeout(5000);

    // 여러 선택자 시도
    const books = await page.evaluate(() => {
      const items = [];

      // div, li, article 등 다양한 컨테이너 시도
      const containerSelectors = [
        '[class*="product_"]',
        '[class*="Product"]',
        '[data-product]',
        '[data-book]',
        'li[class*="item"]',
        'div[class*="card"]',
        'article'
      ];

      for (const containerSel of containerSelectors) {
        const containers = document.querySelectorAll(containerSel);

        if (containers.length >= 10) {
          console.log(`Found ${containers.length} items with selector: ${containerSel}`);

          containers.forEach((el, idx) => {
            if (idx >= 20) return;

            // 제목 찾기 시도
            const titleSelectors = [
              '.title', '[class*="title"]', 'h3', 'h4', 'strong',
              'a[href*="product"]'
            ];

            for (const titleSel of titleSelectors) {
              const titleEl = el.querySelector(titleSel);
              const title = titleEl?.textContent?.trim();

              if (title && title.length > 3) {
                items.push({
                  rank: items.length + 1,
                  title,
                  found_with: `${containerSel} > ${titleSel}`
                });
                break;
              }
            }
          });

          if (items.length >= 10) break;
        }
      }

      return items;
    });

    console.log(`✓ Found ${books.length} books`);
    books.slice(0, 5).forEach(b => console.log(`  ${b.rank}. ${b.title} (${b.found_with})`));

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  await testRidiFix();
  await testKyoboLongerWait();
  console.log('\n=== Tests complete ===');
}

run();
