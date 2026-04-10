"use strict";

const puppeteer = require('puppeteer');

async function debugYes24HailMary() {
  console.log('\n=== Checking YES24 Hail Mary Data ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.yes24.com/Product/Category/BestSeller?categoryNumber=001',
      { waitUntil: 'networkidle2', timeout: 60000 });

    const books = await page.$$eval('.itemUnit', (items) => {
      return items.slice(0, 20).map((item, idx) => {
        const title = item.querySelector('.gd_name')?.textContent.trim() || '';
        const author = item.querySelector('.info_auth a')?.textContent.trim() || '';
        const publisher = item.querySelector('.info_pub a')?.textContent.trim() || '';
        const coverImg = item.querySelector('.coverImg img');
        const cover = coverImg ? (coverImg.getAttribute('data-original') || coverImg.src) : '';

        return {
          rank: idx + 1,
          title,
          author,
          publisher,
          cover_url: cover
        };
      });
    });

    const hailMary = books.find(b => b.title.includes('헤일메리'));
    if (hailMary) {
      console.log('Found in YES24:');
      console.log(JSON.stringify(hailMary, null, 2));
    } else {
      console.log('❌ Not found in YES24 top 20');
      console.log('\nAll books:');
      books.forEach(b => console.log(`${b.rank}. ${b.title} - ${b.author}`));
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

debugYes24HailMary();
