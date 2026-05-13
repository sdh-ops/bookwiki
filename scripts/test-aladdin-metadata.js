"use strict";

const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

async function testAladdinMetadata() {
  console.log('\n=== Testing Aladdin Metadata ===\n');
  const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0';
  
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);
    
    $('.ss_book_box').slice(0, 5).each((i, el) => {
      let titleLink = null;
      let metadataLine = null;

      $(el).find('.ss_book_list li').each((idx, li) => {
        const a = $(li).find('a.bo3');
        if (a.length > 0 && !titleLink) {
          titleLink = a;
          metadataLine = $(li).next();
        }
      });

      if (titleLink) {
        const title = titleLink.text().trim();
        const info = metadataLine ? metadataLine.text().trim() : 'NO METADATA';
        console.log(`${i+1}. Title: ${title}`);
        console.log(`   Info: ${info}`);
        console.log(`   Includes '|': ${info.includes('|')}`);
      }
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
}

testAladdinMetadata();
