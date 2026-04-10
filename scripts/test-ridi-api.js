"use strict";

const axios = require('axios');

function cleanTitle(title) {
  if (!title) return '알수없음';
  return title.replace(/\s+/g, ' ').trim();
}

function cleanAuthor(author) {
  if (!author) return '알수없음';
  return author.replace(/\s+/g, ' ').trim();
}

async function testRidiAPI() {
  console.log('\n=== Testing Ridi API Scraper ===\n');

  try {
    const url = 'https://bestseller-api.ridibooks.com/select/popular/books?page=1&size=20';

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const books = response.data?.books || [];

    console.log(`Total books found: ${books.length}\n`);

    // 첫 번째 책의 전체 구조 확인
    if (books.length > 0) {
      console.log('First book structure:');
      console.log(JSON.stringify(books[0], null, 2));
      console.log('\n---\n');
    }

    if (books.length > 0) {
      const cleanedBooks = books.slice(0, 5).map((book, idx) => ({
        rank: idx + 1,
        title: cleanTitle(book.title?.main || book.title || ''),
        author: cleanAuthor(book.author?.name || ''),
        publisher: '리디북스'
      }));

      console.log('Sample books:\n');
      cleanedBooks.forEach(book => {
        console.log(`${book.rank}. ${book.title} by ${book.author}`);
      });

      console.log('\n✅ Success!');
    } else {
      console.log('❌ No books found');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
}

testRidiAPI();
