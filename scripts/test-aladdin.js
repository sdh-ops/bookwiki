"use strict";

const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

async function testAladdin() {
  console.log('\n=== Testing Aladdin Scraper ===\n');
  const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0';
  
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);
    
    console.log(`Page length: ${res.data.length}`);
    
    const boxes = $('.ss_book_box');
    console.log(`Found ${boxes.length} .ss_book_box elements`);
    
    if (boxes.length === 0) {
      console.log('Trying alternative selectors...');
      console.log('ID ss_book_list elements:', $('#ss_book_list').length);
      console.log('Tables:', $('table').length);
    }
    
    boxes.slice(0, 5).each((i, el) => {
      const title = $(el).find('.bo3').text().trim();
      console.log(`${i+1}. Title: ${title}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
}

testAladdin();
