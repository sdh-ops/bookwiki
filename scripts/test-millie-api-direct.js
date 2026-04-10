"use strict";

const axios = require('axios');

async function testMillieAPI() {
  console.log('\n=== Testing Millie API Direct Calls ===\n');

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  const categories = [
    { name: '종합', code: 'total' },
    { name: '소설', code: '1' },
    { name: '에세이/시', code: '11' },
    { name: '인문', code: '3' },
    { name: '역사', code: '4' },
    { name: '사회과학', code: '9' },
    { name: '경제경영', code: '5' },
    { name: '자기계발', code: '6' },
    { name: '과학', code: '8' },
    { name: '어린이/청소년', code: '13' }
  ];

  for (const cat of categories) {
    try {
      const url = `https://apis.millie.co.kr/public/rank/bookstore/?size=20&category=${cat.code}&year=${year}&month=${month}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const books = response.data?.data || [];

      console.log(`${cat.name} (${cat.code}): ${books.length} books`);

      if (books.length > 0) {
        console.log(`  Sample: ${books[0].book_name} by ${books[0].author}`);
      }

    } catch (e) {
      console.log(`${cat.name} (${cat.code}): ERROR - ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== Complete ===\n');
}

testMillieAPI();
