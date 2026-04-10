"use strict";

const puppeteer = require('puppeteer');

async function debugRidi() {
  console.log('\n=== Debugging Ridi Scraper ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://select.ridibooks.com/charts', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const debug = await page.evaluate(() => {
      const info = {
        hasNextData: !!document.getElementById('__NEXT_DATA__'),
        bookLinksCount: document.querySelectorAll('a[href*="/books/"]').length,
        allLinksCount: document.querySelectorAll('a').length,
        allScripts: document.querySelectorAll('script').length,
        title: document.title,
        bodyText: document.body.textContent.substring(0, 200)
      };

      // Check for __NEXT_DATA__
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        try {
          const data = JSON.parse(nextDataEl.textContent);
          info.nextDataKeys = Object.keys(data);
          info.propsKeys = data.props ? Object.keys(data.props) : [];

          // Try to find books
          const queries = data.props?.pageProps?.dehydratedState?.queries || [];
          info.queriesCount = queries.length;

          if (queries.length > 0) {
            info.firstQueryKeys = Object.keys(queries[0]);
            const firstQuery = queries[0];
            if (firstQuery.state?.data) {
              const dataValues = Object.values(firstQuery.state.data);
              info.dataValuesCount = dataValues.length;
              info.firstDataValue = dataValues[0] ? Object.keys(dataValues[0]) : [];
            }
          }
        } catch (e) {
          info.nextDataError = e.message;
        }
      }

      // Check DOM elements
      const bookLinks = document.querySelectorAll('a[href*="/books/"]');
      if (bookLinks.length > 0) {
        const firstLink = bookLinks[0];
        const img = firstLink.querySelector('img');
        info.firstBookLink = {
          href: firstLink.href,
          hasImg: !!img,
          imgAlt: img?.alt,
          imgSrc: img?.src?.substring(0, 50)
        };
      }

      return info;
    });

    console.log('Debug Info:', JSON.stringify(debug, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

debugRidi();
