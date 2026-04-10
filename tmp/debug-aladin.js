const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function testAladin() {
  console.log('--- Aladin Test ---');
  try {
    const res = await axios.get('https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0', { headers: HEADERS });
    const $ = cheerio.load(res.data);
    let count = 0;
    $('.ss_book_box').each((i, el) => {
      const title = $(el).find('a.bo3').text().trim();
      if (title) count++;
      if (i < 3) {
        const info = $(el).find('.ss_book_list li').eq(1).text().trim(); // Might be wrong, let's see
        console.log(`[${i+1}] Title: ${title}`);
        console.log(`    Info Area: ${$(el).find('.ss_book_list').text().slice(0, 100)}...`);
      }
    });
    console.log('Aladin Total Count:', count);
  } catch (e) {
    console.error('Aladin Test Failed:', e.message);
  }
}

testAladin();
