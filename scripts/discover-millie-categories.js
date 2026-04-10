"use strict";

const puppeteer = require('puppeteer');

async function discoverMillieCategories() {
  console.log('\n=== Discovering Millie Category Codes ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const apiCalls = new Map(); // category name -> API URL

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('apis.millie.co.kr/public/rank/bookstore')) {
      const match = url.match(/category=([^&]+)/);
      if (match) {
        apiCalls.set(url, match[1]);
      }
    }
  });

  try {
    console.log('1. Loading bestseller page...');
    await page.goto('https://www.millie.co.kr/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click "서점베스트"
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a'))
        .find(a => a.textContent?.includes('서점베스트'));
      if (link) link.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    console.log('2. Testing known category tabs...');

    const categoryTabs = [
      '종합',
      '소설',
      '경제/경영',
      '자기계발',
      '시/에세이',
      '인문/교양',
      '취미/실용',
      '어린이/청소년'
    ];

    console.log(`Testing ${categoryTabs.length} categories:`, categoryTabs);
    console.log('\n3. Clicking each tab to discover API codes...\n');

    for (const tabName of categoryTabs) {
      const clicked = await page.evaluate((name) => {
        const tab = Array.from(document.querySelectorAll('button, a, div[role="tab"]'))
          .find(el => el.textContent?.trim() === name);

        if (tab) {
          tab.click();
          return true;
        }
        return false;
      }, tabName);

      if (clicked) {
        await new Promise(r => setTimeout(r, 2000));

        // 최신 API 호출 확인
        const latestURL = Array.from(apiCalls.keys()).slice(-1)[0];
        const categoryCode = apiCalls.get(latestURL);

        console.log(`  ${tabName} -> ${categoryCode || '(no API call)'}`);
      }
    }

    console.log('\n4. Summary of discovered categories:\n');

    const categoryMapping = {};
    for (const [url, code] of apiCalls) {
      if (!categoryMapping[code]) {
        categoryMapping[code] = url;
      }
    }

    Object.keys(categoryMapping).forEach(code => {
      console.log(`  ${code}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

discoverMillieCategories();
