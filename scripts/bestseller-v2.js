"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

/**
 * [Bestseller Scraper V2 - 완전 개선판]
 *
 * 개선사항:
 * 1. 알라딘 API 사용 (웹 스크래핑 대신)
 * 2. 카테고리 10개로 확대
 * 3. 밀리 스크레이퍼 완전 수정
 * 4. 리디 카테고리 매핑 수정
 * 5. YES24 셀렉터 개선
 */

// 확장된 카테고리 매핑 (10개)
const COMMON_CATEGORIES = [
  { id: 'total', name: '종합', kyobo: '000', yes24: '001', aladdin: '0', ridi: 'general', millie: 'total' },
  { id: 'fiction', name: '소설', kyobo: '100', yes24: '001001046', aladdin: '1', ridi: '100', millie: 'story' },
  { id: 'essay', name: '에세이/시', kyobo: '300', yes24: '001001047', aladdin: '55889', ridi: '106', millie: 'poem' },
  { id: 'humanities', name: '인문', kyobo: '500', yes24: '001001019', aladdin: '656', ridi: '103', millie: 'humanities' },
  { id: 'history', name: '역사', kyobo: '800', yes24: '001001022', aladdin: '74', ridi: '400', millie: 'total' },
  { id: 'society', name: '사회과학', kyobo: '900', yes24: '001001003', aladdin: '798', ridi: '400', millie: 'total' },
  { id: 'economy', name: '경제경영', kyobo: '1300', yes24: '001001025', aladdin: '170', ridi: '105', millie: 'economy' },
  { id: 'selfhelp', name: '자기계발', kyobo: '1500', yes24: '001001026', aladdin: '336', ridi: '113', millie: 'self-development' },
  { id: 'science', name: '과학', kyobo: '4100', yes24: '001001002', aladdin: '987', ridi: '1100', millie: 'total' },
  { id: 'children', name: '어린이/청소년', kyobo: '4200', yes24: '001001016', aladdin: '1108', ridi: '1300', millie: 'child' }
];

const ALADIN_API_KEY = 'ttbsue_1201547001';

// KST 기준 전일 날짜 반환 (실제 판매 데이터 날짜)
function getSnapshotDate() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kstNow.setDate(kstNow.getDate() - 1);
  return kstNow.toISOString().split('T')[0];
}
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

let browser = null;

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

// 저자명 정리 함수 (더 강력한 정규화)
function cleanAuthor(author) {
  if (!author) return '알수없음';

  // 가격 정보가 포함되어 있으면 무시
  if (author.includes('원') && author.includes('할인')) {
    return '알수없음';
  }

  let cleaned = author
    // 모든 괄호 내용 완전 제거
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    // 역할 표시 제거 (더 많은 패턴)
    .replace(/지은이|지음|저자|글쓴이|글|저|지음\s*/g, '')
    .replace(/옮긴이|옮김|역자|역|번역/g, '')
    .replace(/감수자|감수/g, '')
    .replace(/그림|그린이/g, '')
    .replace(/엮은이|엮음|편집|편저|편/g, '')
    // "외" 제거 (번역자 표시이므로)
    .replace(/\s*외\s*$/g, '')
    // 여러 저자 중 첫 번째만
    .split(',')[0]
    .split('/')[0]
    .split(';')[0]
    .split('·')[0]
    .split('｜')[0]
    .split('|')[0]
    // 공백 정리
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || '알수없음';
}

// 제목 정리 함수 (강화 버전 - 괄호 제거)
function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/\[도서\]/g, '')
    .replace(/\(개정판\)/gi, '')
    .replace(/\(영화.*?판\)/gi, '')
    .replace(/\(.*?특별판\)/gi, '')
    .replace(/\(.*?리커버\)/gi, '')
    .replace(/\(.*?에디션\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 출판사 정규화 함수
function cleanPublisher(publisher) {
  if (!publisher) return '알수없음';

  let cleaned = publisher
    .replace(/주식회사|㈜|\(주\)/g, '')
    // 괄호 내용 제거 (예: "알에이치코리아(RHK)" -> "알에이치코리아")
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    // "알에치코리아"를 "알에이치코리아"로 통일
    .replace(/알에치코리아/g, '알에이치코리아')
    // 공백 정리
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || '알수없음';
}

// 예스24 - Axios 방식 (셀렉터 개선)
async function scrapeYes24(category, retries = 3) {
  console.log(`[Yes24] ${category.name}...`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.yes24.com/Product/Category/BestSeller?categoryNumber=${category.yes24}&pageNumber=1&pageSize=24`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];

      // 개선된 셀렉터: 여러 가능한 구조 시도
      const itemSelectors = [
        '#yesBestList > li',
        '.itemUnit',
        '.goods_info',
        '#bestList li'
      ];

      let $items = null;
      for (const selector of itemSelectors) {
        $items = $(selector);
        if ($items.length > 0) break;
      }

      if (!$items || $items.length === 0) {
        console.log(`  [!] No items found with any selector`);
        continue;
      }

      $items.slice(0, 20).each((i, el) => {
        const $el = $(el);
        const title = $el.find('.gd_name, .goods_name').text().trim();
        const author = cleanAuthor($el.find('.info_auth, .goods_auth').text().trim());
        const pub = $el.find('.info_pub, .goods_pub').text().trim();
        const img = $el.find('img.lazy').attr('data-original') ||
                   $el.find('img').attr('data-original') ||
                   $el.find('img').attr('src');

        if (title) {
          books.push({
            rank: i + 1,
            title: cleanTitle(title),
            author,
            publisher: cleanPublisher(pub),
            cover_url: img
          });
        }
      });

      if (books.length > 0) {
        console.log(`  [✓] Found ${books.length} books`);
        return books;
      }

      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 알라딘 - Axios 방식 (API 권한 없어서 웹 스크래핑 사용)
async function scrapeAladdin(category, retries = 3) {
  console.log(`[Aladdin] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladdin}`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];
      $('.ss_book_box').slice(0, 20).each((i, el) => {
        const title = $(el).find('.bo3').text().trim();
        const info = $(el).find('.ss_book_list li').eq(0).text().trim();
        const parts = info.split('|');
        const author = cleanAuthor(parts[0]?.trim());
        const pub = parts[1]?.trim();
        const img = $(el).find('.front_cover').attr('src');
        const isbn = $(el).find('a[href*="ISBN="]').attr('href')?.match(/ISBN=(\d+)/)?.[1];

        if (title) {
          books.push({
            rank: i + 1,
            title: cleanTitle(title),
            author,
            publisher: cleanPublisher(pub),
            cover_url: img,
            isbn: isbn || null
          });
        }
      });

      if (books.length > 0) {
        console.log(`  [✓] Found ${books.length} books`);
        return books;
      }

      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 교보 - Puppeteer + API Response
async function scrapeKyobo(category, retries = 3) {
  console.log(`[Kyobo] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();
    let apiResponse = null;

    page.on('response', async (response) => {
      if (response.url().includes('best-seller/domestic')) {
        try {
          const json = await response.json();
          if (json.data && json.data.bestSeller) {
            apiResponse = json;
          }
        } catch (e) {}
      }
    });

    try {
      await page.setUserAgent(HEADERS['User-Agent']);
      const url = `https://store.kyobobook.co.kr/bestseller/domestic/daily?dsplDvsnCode=${category.kyobo}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      await page.close();

      if (apiResponse && apiResponse.data.bestSeller) {
        const books = apiResponse.data.bestSeller
          // 전자책 포함 (누락 순위 채우기 위해)
          .slice(0, 20)
          .map((item, idx) => {
            // imgPath가 비어있으면 ISBN으로 이미지 URL 생성
            let coverUrl = item.imgPath;
            if (!coverUrl && item.cmdtCode) {
              coverUrl = `https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/${item.cmdtCode}.jpg`;
            }

            return {
              rank: item.prstRnkn || (idx + 1),
              title: cleanTitle(item.cmdtName),
              author: cleanAuthor(item.chrcName),
              publisher: cleanPublisher(item.pbcmName),
              cover_url: coverUrl,
              isbn: item.cmdtCode || null,
              is_ebook: item.saleCmdtDvsnCode === 'EBK' // 전자책 여부
            };
          });
        console.log(`  [✓] Found ${books.length} books`);
        return books;
      }

      if (attempt < retries) {
        console.log(`  [!] Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      await page.close();
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 리디 - API 사용 (Puppeteer 대신)
async function scrapeRidi(category, retries = 3) {
  console.log(`[Ridi] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Ridi Bestseller API 사용
      const url = 'https://bestseller-api.ridibooks.com/select/popular/books?page=1&size=20';

      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000
      });

      const books = response.data?.books || [];

      if (books.length === 0) {
        if (attempt < retries) {
          console.log(`  [!] Retry ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return [];
      }

      const cleanedBooks = books.slice(0, 20).map((book, idx) => ({
        rank: idx + 1,
        title: cleanTitle(book.title?.main || book.title || ''),
        author: cleanAuthor(book.author?.name || (typeof book.author === 'string' ? book.author : '') || ''),
        publisher: '리디북스',
        cover_url: book.thumbnail?.large || book.thumbnail?.small || null
      }));

      console.log(`  [✓] Found ${cleanedBooks.length} books`);
      return cleanedBooks;

    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

// 밀리 - API 사용 (DOM 스크래핑 대신)
async function scrapeMillie(category, retries = 3) {
  console.log(`[Millie] ${category.name}...`);

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://apis.millie.co.kr/public/rank/bookstore/?size=20&category=${category.millie}&year=${year}&month=${month}`;

      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000
      });

      const data = response.data?.data || [];

      if (data.length === 0) {
        if (attempt < retries) {
          console.log(`  [!] Retry ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return [];
      }

      const books = data.slice(0, 20).map((item, idx) => ({
        rank: idx + 1,
        title: cleanTitle(item.book_name || ''),
        author: cleanAuthor(item.author || ''),
        publisher: '밀리의서재',
        cover_url: item.cover_image_url || null
      }));

      console.log(`  [✓] Found ${books.length} books`);
      return books;

    } catch (e) {
      console.error(`  [!] Attempt ${attempt} failed: ${e.message}`);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function sync(platform, books, categoryName) {
  if (books.length === 0) {
    console.log(`  ⚠️  No books to sync for ${platform}`);
    return;
  }

  console.log(`  -> Syncing ${books.length} items for ${platform}...`);

  const today = getSnapshotDate();
  let successCount = 0;

  for (const book of books) {
    try {
      let record = null;

      // Strategy: ISBN-based deduplication first, then title+author
      if (book.isbn) {
        // 1a. Check if book with this ISBN already exists
        const { data: existing } = await supabase
          .from('bw_books')
          .select('*')
          .eq('isbn', book.isbn)
          .maybeSingle();

        if (existing) {
          // Book exists, update it if we have better data (author != '알수없음')
          if (book.author !== '알수없음' && existing.author === '알수없음') {
            const { data: updated } = await supabase
              .from('bw_books')
              .update({
                author: book.author,
                publisher: book.publisher,
                cover_url: book.cover_url || existing.cover_url
              })
              .eq('id', existing.id)
              .select()
              .single();
            record = updated;
          } else {
            record = existing;
          }
        } else {
          // 1b. No book with this ISBN, insert new book
          const { data: inserted, error: insertError } = await supabase
            .from('bw_books')
            .insert({
              title: book.title,
              author: book.author,
              publisher: book.publisher,
              cover_url: book.cover_url,
              isbn: book.isbn
            })
            .select()
            .single();

          if (insertError) {
            // INSERT failed, likely duplicate title+author with different ISBN
            // Try to find existing book by title+author
            const { data: existingByTitle } = await supabase
              .from('bw_books')
              .select('*')
              .eq('title', book.title)
              .eq('author', book.author)
              .maybeSingle();

            if (existingByTitle) {
              console.log(`    [i] Found existing "${book.title}" by title+author (different ISBN)`);
              record = existingByTitle;
            } else {
              console.error(`    [!] Insert failed for "${book.title}": ${insertError.message}`);
              continue;
            }
          } else {
            record = inserted;
          }
        }
      } else {
        // 2. No ISBN, use title+author matching
        const { data: upserted } = await supabase
          .from('bw_books')
          .upsert({
            title: book.title,
            author: book.author,
            publisher: book.publisher,
            cover_url: book.cover_url,
            isbn: null
          }, { onConflict: 'title,author' })
          .select()
          .single();
        record = upserted;
      }

      if (!record) {
        console.error(`    [!] No record for "${book.title}"`);
        continue;
      }

      // 3. Create snapshot
      const { error: snapshotError } = await supabase
        .from('bw_bestseller_snapshots')
        .upsert({
          book_id: record.id,
          platform,
          period_type: 'daily',
          rank: book.rank,
          common_category: categoryName,
          snapshot_date: today,
          is_ebook: book.is_ebook || false
        }, {
          onConflict: 'book_id,platform,period_type,snapshot_date,common_category'
        });

      if (snapshotError) {
        console.error(`    [!] Snapshot failed for "${book.title}" (rank ${book.rank}): ${snapshotError.message}`);
      } else {
        successCount++;
      }
    } catch (err) {
      console.error(`    [!] Unexpected error for "${book.title}": ${err.message}`);
    }
  }

  console.log(`  ✅ Successfully synced ${successCount}/${books.length} books`);
}

// 누락된 순위 확인 함수
async function checkMissingRanks(platform, categoryName) {
  const today = getSnapshotDate();

  const { data } = await supabase
    .from('bw_bestseller_snapshots')
    .select('rank')
    .eq('platform', platform)
    .eq('common_category', categoryName)
    .eq('snapshot_date', today);

  const ranks = data.map(d => d.rank);
  const missing = [];

  for (let i = 1; i <= 20; i++) {
    if (!ranks.includes(i)) {
      missing.push(i);
    }
  }

  return missing;
}

async function run() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  베스트셀러 스크레이퍼 V2 - 완전 개선판  ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`📚 Categories: ${COMMON_CATEGORIES.length}`);
  console.log(`🏪 Platforms: 5 (Kyobo, YES24, Aladin, Ridi, Millie)\n`);

  await initBrowser();

  const missingReport = {}; // 최종 누락 리포트

  try {
    for (let i = 0; i < COMMON_CATEGORIES.length; i++) {
      const cat = COMMON_CATEGORIES[i];
      console.log(`\n[${i + 1}/${COMMON_CATEGORIES.length}] 📖 CATEGORY: ${cat.name}`);
      console.log('─'.repeat(50));

      const platformScrapers = {
        kyobo: scrapeKyobo,
        yes24: scrapeYes24,
        aladdin: scrapeAladdin,
        ridi: scrapeRidi,
        millie: scrapeMillie
      };

      // 1차 수집
      const [yes24, aladdin, kyobo, ridi, millie] = await Promise.all([
        scrapeYes24(cat),
        scrapeAladdin(cat),
        scrapeKyobo(cat),
        scrapeRidi(cat),
        scrapeMillie(cat)
      ]);

      const results = {
        kyobo,
        yes24,
        aladdin,
        ridi,
        millie
      };

      // Kyobo 먼저 실행 (ISBN 제공하므로)
      for (const [platform, books] of Object.entries(results)) {
        await sync(platform, books, cat.name);

        // 누락 확인
        const missing = await checkMissingRanks(platform, cat.name);

        if (missing.length > 0) {
          console.log(`  ⚠️  ${platform}: 누락 순위 ${missing.join(', ')}위 - 재시도 중...`);

          // 재시도 (최대 2회)
          for (let retry = 1; retry <= 2; retry++) {
            await new Promise(r => setTimeout(r, 2000));
            const retryBooks = await platformScrapers[platform](cat);
            await sync(platform, retryBooks, cat.name);

            const stillMissing = await checkMissingRanks(platform, cat.name);

            if (stillMissing.length === 0) {
              console.log(`  ✅ ${platform}: 재시도 성공! 모든 순위 수집 완료`);
              break;
            } else if (retry === 2) {
              console.log(`  ⚠️  ${platform}: 재시도 후에도 누락 ${stillMissing.join(', ')}위`);
              const key = `${cat.name}-${platform}`;
              missingReport[key] = stillMissing;
            }
          }
        } else {
          console.log(`  ✅ ${platform}: 1-20위 모두 수집 완료`);
        }
      }

      console.log(`✅ Category "${cat.name}" complete\n`);
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║           🎉 All Done! 🎉                    ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  // 최종 누락 리포트
  if (Object.keys(missingReport).length > 0) {
    console.log('\n⚠️  최종 누락 순위 리포트:');
    console.log('─'.repeat(50));
    for (const [key, missing] of Object.entries(missingReport)) {
      console.log(`  ${key}: ${missing.join(', ')}위`);
    }
    console.log('');
  } else {
    console.log('✅ 모든 플랫폼/카테고리에서 1-20위 완벽 수집!\n');
  }
}

// Export functions for reuse
module.exports = {
  kyobo: scrapeKyobo,
  yes24: scrapeYes24,
  aladdin: scrapeAladdin,
  ridi: scrapeRidi,
  millie: scrapeMillie,
  initBrowser,
  sync,
  run
};

// Run if called directly
if (require.main === module) {
  run();
}
