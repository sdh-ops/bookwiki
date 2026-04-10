"use strict";

const puppeteer = require('puppeteer');

async function testMillieNewUrl() {
  console.log('\n=== Testing Millie New URL Pattern ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 새로운 URL 패턴 테스트
    const url = 'https://www.millie.co.kr/v3/today/more/best/bookstore/total';
    console.log('Testing URL:', url);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await new Promise(r => setTimeout(r, 2000));

    const result = await page.evaluate(() => {
      const bookLinks = document.querySelectorAll('a[href*="/book/"]');
      const books = [];
      const seenTitles = new Set();

      bookLinks.forEach((link) => {
        if (books.length >= 20) return;

        // 제목 찾기
        let title = null;
        const h3 = link.querySelector('h3');
        const h4 = link.querySelector('h4');
        const img = link.querySelector('img');

        if (h3?.textContent?.trim()) {
          title = h3.textContent.trim();
        } else if (h4?.textContent?.trim()) {
          title = h4.textContent.trim();
        } else if (img?.alt && img.alt.length > 2) {
          title = img.alt;
        } else {
          // div 내부 텍스트 찾기
          const divs = link.querySelectorAll('div');
          for (const div of divs) {
            const text = div.textContent?.trim();
            if (text && text.length > 2 && text.length < 100) {
              const firstLine = text.split('\n')[0].trim();
              if (firstLine.length > 2) {
                title = firstLine;
                break;
              }
            }
          }
        }

        if (!title || title.length < 2 || seenTitles.has(title)) return;
        if (title.includes('로고') || title.includes('밀리의서재')) return;

        seenTitles.add(title);

        // 저자 찾기
        let author = '알수없음';
        const textElements = link.querySelectorAll('p, span');
        for (const el of textElements) {
          const text = el.textContent?.trim();
          if (text && text !== title && text.length > 1 && text.length < 50) {
            author = text;
            break;
          }
        }

        books.push({
          rank: books.length + 1,
          title: title.substring(0, 60),
          author: author.substring(0, 30)
        });
      });

      return {
        totalBookLinks: bookLinks.length,
        extractedBooks: books.length,
        books: books.slice(0, 5)
      };
    });

    console.log('\nResult:', JSON.stringify(result, null, 2));

    if (result.extractedBooks > 0) {
      console.log('\n✅ SUCCESS! Found books on this page.');
      console.log('\nNew URL pattern should be:');
      console.log('  종합: https://www.millie.co.kr/v3/today/more/best/bookstore/total');
    } else {
      console.log('\n❌ No books found on this page either.');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await page.close();
  await browser.close();
}

testMillieNewUrl();
