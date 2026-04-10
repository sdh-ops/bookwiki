"use strict";

const axios = require('axios');
const { supabase } = require('./common');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/'
};

async function testKyobo() {
    const urls = [
        'https://product.kyobobook.co.kr/bestseller/online?period=001',
        'https://product.kyobobook.co.kr/category/KOR/01/bestseller?period=001'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing URL: ${url}`);
            const res = await axios.get(url, { headers: HEADERS });
            console.log(`  Status: ${res.status}`);
            console.log(`  Content Length: ${res.data.length}`);
            if (res.data.includes('prod_item')) {
                console.log('  Success: Found prod_item in HTML');
            } else {
                console.log('  Failure: prod_item not found in HTML');
            }
        } catch (e) {
            console.error(`  Error: ${e.message}`);
        }
    }
}

testKyobo();
