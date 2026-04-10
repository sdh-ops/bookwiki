"use strict";

const puppeteer = require('puppeteer');

async function interceptRidiAPI() {
  console.log('\n=== Intercepting Ridi API Calls ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') || url.includes('chart') || url.includes('book') || url.includes('ridi')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const json = await response.json();
          apiCalls.push({
            url,
            status: response.status(),
            hasData: !!json,
            dataSize: JSON.stringify(json).length
          });

          // 책 데이터가 있으면 출력
          if (JSON.stringify(json).includes('title') && JSON.stringify(json).length > 500) {
            console.log('\n✅ Found book API:', url);
            console.log('Sample:', JSON.stringify(json).substring(0, 300) + '...\n');
          }
        }
      } catch (e) {
        // Not JSON
      }
    }
  });

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    console.log('Loading https://select.ridibooks.com/charts ...');
    await page.goto('https://select.ridibooks.com/charts', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    console.log('\n=== API Calls Summary ===');
    console.log(`Total API calls: ${apiCalls.length}\n`);

    if (apiCalls.length > 0) {
      console.log('All API endpoints:');
      apiCalls.forEach((call, idx) => {
        console.log(`${idx + 1}. ${call.url.substring(0, 120)}`);
      });
    } else {
      console.log('❌ No API calls intercepted!');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

interceptRidiAPI();
