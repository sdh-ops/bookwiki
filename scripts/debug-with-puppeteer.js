"use strict";

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugKyobo() {
  console.log('\n=== Debugging KYOBO ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    const url = 'https://product.kyobobook.co.kr/category/KOR/01/bestseller?period=001';
    console.log('URL:', url);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 스크린샷 저장
    await page.screenshot({ path: 'c:\\Users\\15Z990\\Desktop\\더난\\북위키\\scripts\\kyobo_debug.png', fullPage: false });

    // HTML 구조 분석
    const info = await page.evaluate(() => {
      const selectors = [
        'a.prod_info',
        '.prod_item',
        '.prod_name',
        '[class*="prod"]',
        '[class*="book"]',
        '[class*="item"]'
      ];

      const results = {};
      selectors.forEach(sel => {
        results[sel] = document.querySelectorAll(sel).length;
      });

      // 실제로 존재하는 클래스 이름들 샘플링
      const allElements = document.querySelectorAll('[class]');
      const classNames = new Set();
      for (let i = 0; i < Math.min(100, allElements.length); i++) {
        allElements[i].classList.forEach(c => classNames.add(c));
      }

      return {
        selectorCounts: results,
        sampleClasses: Array.from(classNames).slice(0, 30)
      };
    });

    console.log('Selector counts:', info.selectorCounts);
    console.log('Sample class names:', info.sampleClasses);

    // HTML 일부 저장
    const html = await page.content();
    fs.writeFileSync('c:\\Users\\15Z990\\Desktop\\더난\\북위키\\scripts\\kyobo_debug.html', html);
    console.log('✓ HTML saved');

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function debugRidi() {
  console.log('\n=== Debugging RIDI ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    const url = 'https://ridibooks.com/category/bestseller/100';
    console.log('URL:', url);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.screenshot({ path: 'c:\\Users\\15Z990\\Desktop\\더난\\북위키\\scripts\\ridi_debug.png', fullPage: false });

    const info = await page.evaluate(() => {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (!nextDataEl) {
        return { hasNextData: false };
      }

      try {
        const data = JSON.parse(nextDataEl.textContent);
        const pageProps = data.props?.pageProps || {};

        // 모든 queries 확인
        const queries = pageProps.dehydratedState?.queries || [];
        const queryInfo = queries.map((q, i) => ({
          index: i,
          hasState: !!q.state,
          hasData: !!q.state?.data,
          dataKeys: q.state?.data ? Object.keys(q.state.data) : []
        }));

        return {
          hasNextData: true,
          pagePropsKeys: Object.keys(pageProps),
          queryCount: queries.length,
          queryInfo: queryInfo
        };
      } catch (e) {
        return { hasNextData: true, parseError: e.message };
      }
    });

    console.log('Analysis:', JSON.stringify(info, null, 2));

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  await debugKyobo();
  await debugRidi();
  console.log('\n=== Debug complete ===');
}

run();
