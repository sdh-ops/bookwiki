"use strict";

const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json'
};

async function testKyobo() {
    console.log('Testing Kyobo API...');
    const url = 'https://product.kyobobook.co.kr/api/gw/pub/pdt/best-seller/online?page=1&per=20&period=002&dsplDvsnCode=01';
    try {
        const res = await axios.get(url, { headers: HEADERS });
        console.log('  Success!');
        console.log('  Items found:', res.data.data.bestSellerList.length);
        console.log('  First item:', res.data.data.bestSellerList[0].cmmNm);
    } catch (e) {
        console.error('  Failed:', e.message);
    }
}

async function testRidi() {
    console.log('\nTesting Ridi API...');
    const url = 'https://ridibooks.com/api/v2/bestsellers?category_ids=100&limit=20';
    try {
        const res = await axios.get(url, { headers: HEADERS });
        console.log('  Success!');
        const items = res.data.items || res.data;
        console.log('  Items found:', Array.isArray(items) ? items.length : 'unknown');
        if (Array.isArray(items) && items[0]) {
            console.log('  First item:', items[0].title);
        }
    } catch (e) {
        console.error('  Failed:', e.message);
    }
}

async function run() {
    await testKyobo();
    await testRidi();
}

run();
