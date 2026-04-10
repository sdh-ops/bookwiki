"use strict";

const puppeteer = require('puppeteer');

async function interceptKyoboAPI() {
  console.log('\n=== Intercepting Kyobo Network Requests ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const apiCalls = [];

  // 네트워크 요청 가로채기
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    const type = request.resourceType();

    // API 호출 또는 JSON 응답 가능성이 있는 요청만 기록
    if (url.includes('api') || url.includes('bestseller') || url.includes('json') ||
        type === 'xhr' || type === 'fetch') {
      apiCalls.push({
        url,
        type,
        method: request.method()
      });
    }

    request.continue();
  });

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    console.log('Navigating to Kyobo...');

    await page.goto('https://product.kyobobook.co.kr/bestseller/online?period=001', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Page loaded. Waiting for additional requests...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`\n✓ Captured ${apiCalls.length} potential API calls:\n`);
    apiCalls.forEach((call, idx) => {
      console.log(`${idx + 1}. [${call.method}] ${call.type}`);
      console.log(`   ${call.url}\n`);
    });

    // JSON 응답이 있는지 확인
    if (apiCalls.length > 0) {
      console.log('\nTrying to fetch the most promising API call...');
      const bestMatch = apiCalls.find(c => c.url.includes('bestseller') || c.url.includes('api'));

      if (bestMatch) {
        console.log(`\nBest match: ${bestMatch.url}`);

        try {
          const axios = require('axios');
          const res = await axios.get(bestMatch.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          if (typeof res.data === 'object') {
            console.log('\n✓ JSON Response received!');
            console.log('Keys:', Object.keys(res.data));
          }
        } catch (e) {
          console.log('✗ Could not fetch:', e.message);
        }
      }
    }

  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  await interceptKyoboAPI();
  console.log('\n=== Interception complete ===');
}

run();
