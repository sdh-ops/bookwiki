const axios = require('axios');
const cheerio = require('cheerio');

async function testKyobo() {
    try {
        console.log("Testing Kyobo...");
        const { data } = await axios.get('https://product.kyobobook.co.kr/api/gw/pub/pdt/best-seller/online?page=1&per=5&period=001&bsslBksClstCode=A');
        // Let's print the structure
        console.log("Kyobo data keys:", Object.keys(data.data));
        // If data.data.bestSeller is undefined, check what is returned:
        if(data.data.bestSeller) {
           console.log(data.data.bestSeller[0]);
        }
    } catch(e) { console.error("Kyobo failed", e.message); }
}

async function testAladin() {
    try {
        console.log("Testing Aladin...");
        const { data } = await axios.get('https://www.aladin.co.kr/shop/common/wbest.aspx?BranchType=1');
        const $ = cheerio.load(data);
        const items = [];
        $('div.ss_book_box').slice(0, 2).each((_, el) => {
            const title = $(el).find('a.bo3').text().trim();
            const coverUrl = $(el).find('img.front_cover').attr('src') || $(el).find('img.i_cover').attr('src');
            items.push({ title, coverUrl });
        });
        console.log(items);
    } catch(e) { console.error("Aladin failed", e.message); }
}

async function testRidi() {
    try {
        console.log("Testing Ridi...");
        const { data } = await axios.get('https://ridibooks.com/bestsellers/general');
        const $ = cheerio.load(data);
        const items = [];
        $('.book_macro_110').slice(0, 2).each((_, el) => {
            const title = $(el).find('.title_text').text().trim();
            const coverUrl = $(el).find('.thumbnail').attr('data-src') || $(el).find('.thumbnail').attr('src');
            items.push({ title, coverUrl });
        });
        console.log(items);
    } catch(e) { console.error("Ridi failed", e.message); }
}

async function testYes24() {
    try {
        console.log("Testing Yes24...");
        const { data } = await axios.get('https://www.yes24.com/Product/Category/DayBestSeller?CategoryNumber=001');
        const $ = cheerio.load(data);
        const items = [];
        $('#yesBestList li, .itemUnit').slice(0, 2).each((_, el) => {
            const title = $(el).find('.gd_name').text().trim();
            const coverUrl = $(el).find('img.lazy').attr('data-original') || $(el).find('img').attr('src');
            items.push({ title, coverUrl });
        });
        console.log(items);
    } catch(e) { console.error("Yes24 failed", e.message); }
}

async function run() {
    await testKyobo();
    await testAladin();
    await testRidi();
    await testYes24();
}
run();
