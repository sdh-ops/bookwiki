
const { initBrowser } = require('./bestseller-final');

async function test() {
  const browser = await initBrowser();
  const page = await browser.newPage();
  const url = `https://store.kyobobook.co.kr/bestseller/online/daily/domestic?dsplDvsnCode=0&per=50`;
  
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000)); // give it some time
  
  const html = await page.content();
  console.log(`HTML Length: ${html.length}`);
  
  const selectors = ['ol > li', '.prod_item', '.grid > li', 'a.prod_link'];
  selectors.forEach(s => {
    const count = html.split(s.substring(0, 5)).length - 1; // rough check
    console.log(`Selector "${s}" check (rough): found approx references? check DOM count...`);
  });

  const domCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, 'ol > li');
  console.log(`Actual 'ol > li' count in DOM: ${domCount}`);

  const gridCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, '.grid > li');
  console.log(`Actual '.grid > li' count in DOM: ${gridCount}`);

  const prodCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, '.prod_item');
  console.log(`Actual '.prod_item' count in DOM: ${prodCount}`);

  process.exit(0);
}

test();
