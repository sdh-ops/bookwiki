"use strict";

const axios = require('axios');
const fs = require('fs');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Referer': 'https://www.google.com/'
};

async function debugPlatform(name, url) {
    console.log(`Debugging ${name}: ${url}`);
    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
        const html = res.data;
        console.log(`  Length: ${html.length}`);
        fs.writeFileSync(`/tmp/${name}.html`, html);
        
        if (html.includes('__NEXT_DATA__')) console.log(`  Found __NEXT_DATA__ in ${name}`);
        if (html.includes('prod_name')) console.log(`  Found "prod_name" in ${name}`);
        if (html.includes('BookItem')) console.log(`  Found "BookItem" in ${name}`);
        if (html.includes('book-info')) console.log(`  Found "book-info" in ${name}`);
        
    } catch (e) {
        console.error(`  Failed ${name}: ${e.message}`);
        if (e.response) {
            console.error(`    Status: ${e.response.status}`);
            fs.writeFileSync(`/tmp/${name}_error.html`, e.response.data);
        }
    }
}

async function run() {
    await debugPlatform('kyobo', 'https://store.kyobobook.co.kr/bestseller/online/weekly/domestic/01');
    await debugPlatform('ridi', 'https://ridibooks.com/bestsellers/general');
    await debugPlatform('millie', 'https://www.millie.co.kr/v3/bestseller');
}

run();
