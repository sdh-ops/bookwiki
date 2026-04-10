const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

async function testAladin() {
  const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0`;
  try {
    const res = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(res.data);
    const books = [];
    $('.ss_book_box').each((i, el) => {
      const titleArea = $(el).find('.ss_book_list li').first();
      const titleText = titleArea.find('.bo3').text().trim() || titleArea.text().trim();
      if (titleText) books.push(titleText);
    });
    console.log('Aladin Books:', books.slice(0, 5));
  } catch (e) {
    console.error('Aladin Error:', e.message);
  }
}

testAladin();
