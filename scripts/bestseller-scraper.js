"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

/**
 * [Bestseller Trend Dashboard - Multi-Platform Scraper V11]
 * Refined URLs for Ridi and Millie. Enhanced Kyobo JSON extraction.
 */

const COMMON_CATEGORIES = [
  { id: 'total', name: '종합', kyobo: '01', yes24: '001', aladdin: '0', ridi: 'bestsellers/general', millie: 'v3/bestseller' },
  { id: 'fiction', name: '소설', kyobo: '01', yes24: '001001046', aladdin: '1', ridi: 'categories/001000/?order=best', millie: 'v3/rank?type=WEEKLY&category=1' },
  { id: 'essay', name: '에세이/시', kyobo: '03', yes24: '001001047', aladdin: '55889', ridi: 'categories/001007/?order=best', millie: 'v3/rank?type=WEEKLY&category=11' },
  { id: 'humanities', name: '인문', kyobo: '05', yes24: '001001019', aladdin: '656', ridi: 'categories/001003/?order=best', millie: 'v3/rank?type=WEEKLY&category=3' },
  { id: 'economy', name: '경제경영', kyobo: '13', yes24: '001001025', aladdin: '170', ridi: 'categories/001005/?order=best', millie: 'v3/rank?type=WEEKLY&category=5' },
  { id: 'selfhelp', name: '자기계발', kyobo: '15', yes24: '001001026', aladdin: '336', ridi: 'categories/001006/?order=best', millie: 'v3/rank?type=WEEKLY&category=6' }
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
  'Referer': 'https://www.google.com/'
};

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    return res.data;
  } catch (e) {
    console.error(`  [!] Fetch Error: ${url} (${e.message})`);
    return null;
  }
}

async function scrapeKyobo(category) {
  console.log(`[Kyobo] ${category.name}...`);
  const url = `https://store.kyobobook.co.kr/bestseller/online/weekly/domestic/${category.kyobo}?page=1`;
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const books = [];
  const $ = cheerio.load(html);
  
  // Try __NEXT_DATA__ first as it's more complete for Kyobo
  if (html.includes('__NEXT_DATA__')) {
    try {
      const jsonStr = html.split('__NEXT_DATA__">')[1].split('</script>')[0];
      const data = JSON.parse(jsonStr);
      const items = data.props.pageProps.initialData?.items || data.props.pageProps.items;
      if (items && Array.isArray(items)) {
        items.slice(0, 20).forEach((item, i) => {
          books.push({
            rank: i + 1,
            title: item.prodNm || item.cmmNm,
            author: item.athrNm,
            publisher: item.pbshNm,
            cover_url: item.imgUrl
          });
        });
      }
    } catch (e) {}
  }

  // Fallback to Cheerio
  if (books.length === 0) {
    $('.prod_item').slice(0, 20).each((i, el) => {
      const title = $(el).find('.prod_name').text().trim();
      const author = $(el).find('.author').text().trim();
      const pub = $(el).find('.pub').text().trim();
      const img = $(el).find('.img_box img').first().attr('src');
      if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img });
    });
  }
  return books;
}

async function scrapeRidi(category) {
  console.log(`[Ridi] ${category.name}...`);
  const url = category.ridi.startsWith('http') ? category.ridi : `https://ridibooks.com/${category.ridi}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const books = [];
  // Ridi category pages use article or BookItem
  $('article, [class*="BookItem"]').slice(0, 20).each((i, el) => {
    const title = $(el).find('h3, .title, [class*="title"]').first().text().trim();
    const author = $(el).find('.author, [class*="author"]').first().text().trim();
    const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
    if (title) books.push({ rank: i + 1, title, author, publisher: '리디북스', cover_url: img });
  });
  return books;
}

async function scrapeMillie(category) {
  console.log(`[Millie] ${category.name}...`);
  const url = `https://www.millie.co.kr/${category.millie}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const books = [];
  $('.book-info, [class*="book_info"], .list_unit').slice(0, 20).each((i, el) => {
    const title = $(el).find('.title, .name').first().text().trim();
    const author = $(el).find('.author').first().text().trim();
    const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
    if (title) books.push({ rank: i + 1, title, author, publisher: '밀리의서재', cover_url: img });
  });
  return books;
}

async function scrapeYes24(category) {
  console.log(`[Yes24] ${category.name}...`);
  const url = `https://www.yes24.com/Product/Category/BestSeller?categoryNumber=${category.yes24}&pageNumber=1&pageSize=24`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const books = [];
  $('#yesBestList li, .itemUnit').slice(0, 20).each((i, el) => {
    const title = $(el).find('.gd_name').text().trim();
    const author = $(el).find('.info_auth').text().trim();
    const pub = $(el).find('.info_pub').text().trim();
    const img = $(el).find('img.lazy').attr('data-original') || $(el).find('img').attr('src');
    if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img });
  });
  return books;
}

async function scrapeAladdin(category) {
  console.log(`[Aladdin] ${category.name}...`);
  const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladdin}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const books = [];
  $('.ss_book_box').slice(0, 20).each((i, el) => {
    const title = $(el).find('.bo3').text().trim();
    const info = $(el).find('.ss_book_list li').eq(2).text().trim();
    const parts = info.split('|');
    const author = parts[0]?.trim();
    const pub = parts[1]?.trim();
    const img = $(el).find('.front_cover').attr('src');
    if (title) books.push({ rank: i + 1, title, author, publisher: pub, cover_url: img });
  });
  return books;
}

async function sync(platform, books, categoryName) {
  if (books.length === 0) return;
  console.log(`  -> Syncing ${books.length} items for ${platform}...`);
  for (const book of books) {
    try {
      const cleanTitle = book.title.replace(/\[도서\]/g, '').trim();
      const { data: record } = await supabase.from('bw_books')
        .upsert({
          title: cleanTitle,
          author: book.author || '알수없음',
          publisher: book.publisher || '알수없음',
          cover_url: book.cover_url
        }, { onConflict: 'title,author' })
        .select().single();

      if (record) {
        await supabase.from('bw_bestseller_snapshots').insert({
          book_id: record.id,
          platform,
          period_type: 'daily',
          rank: book.rank,
          common_category: categoryName,
          snapshot_date: new Date().toISOString().split('T')[0]
        });
      }
    } catch (err) {}
  }
}

async function run() {
  console.log('\n--- [Bestseller Engine V11: FINAL STAGE] ---');
  for (const cat of COMMON_CATEGORIES) {
    console.log(`\n> CATEGORY: ${cat.name}`);
    const [kyobo, yes24, aladin, ridi, millie] = await Promise.all([
      scrapeKyobo(cat),
      scrapeYes24(cat),
      scrapeAladdin(cat),
      scrapeRidi(cat),
      scrapeMillie(cat)
    ]);

    await sync('kyobo', kyobo, cat.name);
    await sync('yes24', yes24, cat.name);
    await sync('aladdin', aladin, cat.name);
    await sync('ridi', ridi, cat.name);
    await sync('millie', millie, cat.name);
    
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\n--- [Engine V11 Finish] ---');
}

run();
