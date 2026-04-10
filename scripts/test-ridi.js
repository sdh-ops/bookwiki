"use strict";

const puppeteer = require('puppeteer');

async function testRidi() {
  console.log('\n=== Testing Ridi Scraper ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Test: Charts (종합)
  console.log('Test: Charts (종합)');
  const page = await browser.newPage();
  try {
    await page.goto('https://select.ridibooks.com/charts', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    const result = await page.evaluate(() => {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (!nextDataEl) return { found: false };

      try {
        const data = JSON.parse(nextDataEl.textContent);
        const queries = data.props?.pageProps?.dehydratedState?.queries || [];
        let bookItems = [];
        for (const query of queries) {
          if (query.state?.data) {
            const items = Object.values(query.state.data).filter(item => item && item.book);
            if (items.length > 0) {
              bookItems = items.slice(0, 5);
              break;
            }
          }
        }
        return { found: true, count: bookItems.length, titles: bookItems.map(i => i.book.title) };
      } catch (e) {
        return { found: false, error: e.message };
      }
    });

    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  await page.close();
  await browser.close();
}

testRidi();
