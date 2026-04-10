const puppeteer = require('puppeteer');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function checkRidiPlaywright() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent(HEADERS['User-Agent']);
  await page.goto('https://ridibooks.com/bestsellers/general', { waitUntil: 'networkidle2' });
  
  const books = await page.evaluate(() => {
    // Let's just grab the text of the entire body or look for common book wrapper classes
    const items = document.querySelectorAll('li, div.book_macro, div[class*="book"]');
    for(let i=0; i<items.length; i++) {
        if (items[i].innerText.includes('프로젝트 헤일메리')) {
            return {
                html: items[i].innerHTML,
                className: items[i].className
            }
        }
    }
    return "Not found";
  });
  console.log(books);
  await browser.close();
}
checkRidiPlaywright();
