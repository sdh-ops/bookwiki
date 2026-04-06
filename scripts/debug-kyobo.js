"use strict";

const puppeteer = require('puppeteer');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

async function debug() {
  console.log('--- Initializing Debug Browser ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const page = await browser.newPage();
  
  // Stealth
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
       'Accept-Language': 'ko-KR,ko;q=0.9',
       'Referer': 'https://www.google.com/'
    });

    const url = 'https://store.kyobobook.co.kr/bestseller/online/daily/domestic/01';
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('Waiting for li.mt-9...');
    const selectorFound = await page.waitForSelector('li.mt-9', { timeout: 15000 }).catch(() => null);
    
    if (!selectorFound) {
      console.log('Selector NOT found. Saving screenshot...');
      await page.screenshot({ path: 'debug-failed.png' });
      // view the html
      const html = await page.content();
      console.log('HTML snippet:', html.substring(0, 1000));
    } else {
      console.log('Selector found! Counting items...');
      const items = await page.evaluate(() => {
        const els = document.querySelectorAll('li.mt-9');
        if (els.length === 0) return [];
        const el = els[0];
        
        // Find ALL divs and their text and class
        const divs = Array.from(el.querySelectorAll('div')).map(d => ({
          text: d.innerText.substring(0, 50),
          className: d.className
        }));

        return {
          total: els.length,
          divs: divs,
          allText: el.innerText
        };
      });
      console.log('Deep debug of first li.mt-9:', JSON.stringify(items, null, 2));
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

debug();
