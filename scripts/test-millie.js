"use strict";

const puppeteer = require('puppeteer');

async function testMillie() {
  console.log('\n=== Testing Millie Scraper ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Test 1: 종합 베스트셀러
  console.log('Test 1: 종합 베스트셀러');
  const page1 = await browser.newPage();
  try {
    await page1.goto('https://www.millie.co.kr/v3/bestseller', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const result1 = await page1.evaluate(() => {
      const bookLinks = document.querySelectorAll('a[href*="/book/"]');
      const books = [];

      bookLinks.forEach((link, idx) => {
        if (books.length >= 5) return;

        const img = link.querySelector('img');
        const title = img?.alt || link.textContent?.trim() || 'Unknown';

        if (title && title.length > 2 && !title.includes('로고')) {
          books.push({
            rank: books.length + 1,
            title: title.substring(0, 50)
          });
        }
      });

      return { count: books.length, books };
    });

    console.log('Result:', JSON.stringify(result1, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  await page1.close();

  // Test 2: 카테고리별 (소설)
  console.log('\n\nTest 2: 카테고리별 (소설 - category=1)');
  const page2 = await browser.newPage();
  try {
    await page2.goto('https://www.millie.co.kr/v3/rank?type=WEEKLY&category=1', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const result2 = await page2.evaluate(() => {
      const bookLinks = document.querySelectorAll('a[href*="/book/"]');
      const books = [];

      bookLinks.forEach((link, idx) => {
        if (books.length >= 5) return;

        const img = link.querySelector('img');
        const title = img?.alt || link.textContent?.trim() || 'Unknown';

        if (title && title.length > 2 && !title.includes('로고')) {
          books.push({
            rank: books.length + 1,
            title: title.substring(0, 50)
          });
        }
      });

      return { count: books.length, books };
    });

    console.log('Result:', JSON.stringify(result2, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  await page2.close();

  // Test 3: 홈페이지 (사용자가 보여준 페이지) - with scrolling
  console.log('\n\nTest 3: 홈페이지 (https://www.millie.co.kr/) - with dynamic loading');
  const page3 = await browser.newPage();
  try {
    await page3.goto('https://www.millie.co.kr/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to trigger lazy loading
    await page3.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(r => setTimeout(r, 2000));

    await page3.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 3000));

    const result3 = await page3.evaluate(() => {
      const bookLinks = document.querySelectorAll('a[href*="/book/"]');
      const books = [];
      const seenTitles = new Set();

      bookLinks.forEach((link) => {
        if (books.length >= 20) return;

        // 제목 찾기 (다양한 방법)
        let title = null;

        // 1. h3, h4 태그
        const h3 = link.querySelector('h3');
        const h4 = link.querySelector('h4');
        if (h3?.textContent?.trim()) title = h3.textContent.trim();
        else if (h4?.textContent?.trim()) title = h4.textContent.trim();

        // 2. div 내부 텍스트
        if (!title) {
          const divs = link.querySelectorAll('div');
          for (const div of divs) {
            const text = div.textContent?.trim();
            if (text && text.length > 2 && text.length < 100 && !text.includes('http')) {
              // 첫 번째 의미있는 텍스트를 제목으로 간주
              const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
              if (lines.length > 0) {
                title = lines[0];
                break;
              }
            }
          }
        }

        // 3. img alt
        if (!title) {
          const img = link.querySelector('img[alt]');
          if (img?.alt && img.alt.length > 2) {
            title = img.alt;
          }
        }

        // 4. aria-label
        if (!title && link.getAttribute('aria-label')) {
          title = link.getAttribute('aria-label');
        }

        // 제목 검증
        if (!title || title.length < 2 || title.length > 200) return;
        if (title.includes('로고') || title.includes('밀리의서재')) return;
        if (seenTitles.has(title)) return;

        seenTitles.add(title);

        // 저자 찾기
        let author = '알수없음';
        const textElements = link.querySelectorAll('p, span, div');
        for (const el of textElements) {
          const text = el.textContent?.trim();
          if (text && text !== title && text.length > 1 && text.length < 50) {
            if (!text.includes('http') && !text.includes('www') && !text.includes('로고')) {
              author = text;
              break;
            }
          }
        }

        // 이미지
        const img = link.querySelector('img');
        const coverUrl = img?.src || img?.dataset?.src || null;

        books.push({
          rank: books.length + 1,
          title: title.substring(0, 60),
          author: author.substring(0, 30),
          cover_url: coverUrl ? 'found' : null
        });
      });

      return {
        totalBookLinks: bookLinks.length,
        extractedBooks: books.length,
        books
      };
    });

    console.log('Result:', JSON.stringify(result3, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  await page3.close();

  // Test 4: 베스트셀러 탭 클릭 시도
  console.log('\n\nTest 4: 베스트셀러 섹션 찾기 및 클릭');
  const page4 = await browser.newPage();
  try {
    await page4.goto('https://www.millie.co.kr/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const result4 = await page4.evaluate(() => {
      // 베스트셀러 관련 텍스트가 있는 요소 찾기
      const allElements = document.querySelectorAll('a, button, div[role="tab"], nav a');
      const bestsellerElements = [];

      allElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && (
          text.includes('베스트') ||
          text.includes('인기') ||
          text.includes('Best') ||
          text === '종합' ||
          text === '소설'
        )) {
          bestsellerElements.push({
            tag: el.tagName,
            text: text.substring(0, 30),
            href: el.getAttribute('href')
          });
        }
      });

      return {
        foundElements: bestsellerElements.length,
        elements: bestsellerElements.slice(0, 10)
      };
    });

    console.log('Result:', JSON.stringify(result4, null, 2));

    // 베스트셀러 탭이 있으면 클릭 시도
    const clicked = await page4.evaluate(() => {
      const bestTab = Array.from(document.querySelectorAll('a, button, div[role="tab"]'))
        .find(el => el.textContent?.includes('베스트') || el.textContent?.includes('인기'));

      if (bestTab) {
        bestTab.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('  -> Clicked bestseller tab, waiting...');
      await new Promise(r => setTimeout(r, 3000));

      const booksAfterClick = await page4.evaluate(() => {
        const bookLinks = document.querySelectorAll('a[href*="/book/"]');
        return {
          bookLinksFound: bookLinks.length,
          sampleTitles: Array.from(bookLinks).slice(0, 3).map(link => {
            const img = link.querySelector('img');
            return img?.alt || link.textContent?.trim().substring(0, 30) || 'No title';
          })
        };
      });

      console.log('After click:', JSON.stringify(booksAfterClick, null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  await page4.close();

  await browser.close();
}

testMillie();
