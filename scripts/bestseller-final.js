"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

const ALADIN_API_KEY = 'ttbsdh10220011';

/**
 * [Bestseller Scraper FINAL - 5 Platforms Integrated]
 * 교보/예스24/알라딘/리디/밀리 - 모든 플랫폼 지원
 */

const COMMON_CATEGORIES = [
  { id: 'total', name: '종합', kyobo: '000', yes24: '001', aladdin: '0', ridi: 'general', millie: 'total' },
  { id: 'fiction', name: '소설', kyobo: '100', yes24: '001001046', aladdin: '1', ridi: '100', millie: 'story' },
  { id: 'essay', name: '에세이/시', kyobo: '300', yes24: '001001047', aladdin: '55889', ridi: '110', millie: 'poem' },
  { id: 'humanities', name: '인문', kyobo: '500', yes24: '001001019', aladdin: '656', ridi: '400', millie: 'humanities' },
  { id: 'economy', name: '경제경영', kyobo: '1300', yes24: '001001025', aladdin: '170', ridi: '200', millie: 'economy' },
  { id: 'selfhelp', name: '자기계발', kyobo: '1500', yes24: '001001026', aladdin: '336', ridi: '300', millie: 'self-development' }
];

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

// 도서 유효성 검사 함수
function isValidBook(title, author) {
  if (!title || title.length < 2) return false;
  
  // 블랙리스트 키워드 (완벽한 필터링을 위해 대폭 확장)
  const blacklist = [
    '로고', '이벤트', '공지', '배너', '안내', '이미지', '출판사', '서점', 
    '교보문고', '예스24', '알라딘', '리디', '밀리', '쿠폰', '적립', '가이드',
    '예약판매', '잡지', '월간', '증정', '비매품', '세트할인', '기프트', '사은품', '굿즈',
    '캐시백', '포인트', '할인권', '문구', '오피스', '학용품', '다이어리', '플래너',
    '아크릴', '스티커', '카드', '부록', '엽서', '포스터', '마스킹테이프', '필통', '머그컵',
    '북마크', '북슬리브', '도서 1만 5천원', '이상 구매 시', '초판 스티커', '스크래치 카드',
    '키링', '인스', '노트', '북토크', '강연', '사인회', '배송료', '배송비', '포함 상품',
    '랜덤', '박스', '패키지', '포토카드', '폴라로이드', '인생네컷', '엽서세트', 'L홀더',
    '파우치', '손수건', '클리너', '에코백', '토트백', '텀블러', '배지', '뱃지', '와펜',
    '마그넷', '자석', '메모지', '포스트잇', '볼펜', '연필', '지우개', '샤프', '스케줄러',
    '편지지', '봉투', '문구세트', '편지세트', '박스테이프', '마스킹', '데코레이션',
    '만원 이상', '주년 기념', '특별 한정', '박스 세트', '포인트 차감', '사은품 증정'
  ];

  const lowerTitle = title.toLowerCase();
  
  // 제목에 블랙리스트가 포함되어 있는지 확인
  if (blacklist.some(word => lowerTitle.includes(word.toLowerCase()))) return false;
  
  // 저자가 '알수없음'이거나 '저자 미상'인 경우, 제목에 [도서] 등의 태그가 없다면 의심
  if (!author || author === '저자 미상' || author === '알수없음') {
    // 상품명에 흔한 도서 형태가 아니면 일단 제외
    if (title.length < 5) return false;
    // 사은품이나 굿즈는 보통 저자가 없거나 특정 문구가 들어감
    if (lowerTitle.includes('원 이상')) return false;
  }

  return true;
}

// 저자명 정리 함수
function cleanAuthor(author) {
  if (!author || author === '알수없음') return '저자 미상';

  // 가격 정보나 불필요한 태그/괄호 제거
  let cleaned = author
    .replace(/\s+/g, ' ')
    .replace(/\[(지은이|저|작가|글|그림|역|옮긴이|편저|엮음|원작)\]/g, '')
    .replace(/\((지은이|저|작가|글|그림|역|옮긴이|편저|엮음|원작)\)/g, '')
    .replace(/\([^)]*\)/g, '') // 일반적인 괄호 내용 제거
    .trim();

  // 여러 구분자 처리 (첫 번째 저자만 추출)
  cleaned = cleaned.split(/[,/|]/)[0].trim();

  return cleaned || '저자 미상';
}

// 날짜 형식 통일 함수 (YYYY-MM-DD)
function formatDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  if (cleaned.length === 6) {
    // 2024년 3월 -> 2024-03-01
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-01`;
  }
  return null;
}

// 어제 날짜 (KST 기준) 가져오기
function getYesterdayKST() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  kstNow.setDate(kstNow.getDate() - 1);
  return kstNow.toISOString().split('T')[0];
}

// 누락된 표지/출판사 정보를 알라딘 API를 통해 보완 (Fallback)
async function fetchMissingInfo(title, author) {
  try {
    const safeTitle = title.replace(/\[도서\]/g, '').split('(')[0].split('-')[0].trim();
    const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
    const params = {
      ttbkey: ALADIN_API_KEY,
      Query: safeTitle + ' ' + (author !== '저자 미상' ? author.split(' ')[0] : ''),
      QueryType: 'Keyword',
      MaxResults: 2,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };
    const response = await axios.get(url, { params, timeout: 5000 });
    if (response.data && response.data.item && response.data.item.length > 0) {
      // Find the closest match (often the first one provided by relevant searching)
      const book = response.data.item[0];
      return {
        publisher: book.publisher,
        isbn: book.isbn13 || book.isbn
      };
    }
  } catch (e) {
    // Fail silently, returning null
  }
  return null;
}

// 예스24 - Axios 방식 (재시도 로직 포함)
async function scrapeYes24(category, retries = 3) {
  console.log(`[Yes24] ${category.name}...`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.yes24.com/Product/Category/DayBestSeller?CategoryNumber=${category.yes24}&pageNumber=1&pageSize=50`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];
      const seenTitles = new Set();

      $('#yesBestList li, .itemUnit').each((i, el) => {
        if (books.length >= 50) return;

        const titleText = $(el).find('.gd_name').text().trim();
        const authorRaw = $(el).find('.info_auth, .info_pub').first().text().trim();
        const author = cleanAuthor(authorRaw);

        if (!titleText || !isValidBook(titleText, author)) return;
        
        // 중복 제거 (특히 eBook과 일반 도서가 같이 나오는 경우 대비)
        const normalizedTitle = titleText.replace(/\s+/g, '').toLowerCase();
        if (seenTitles.has(normalizedTitle)) return;
        seenTitles.add(normalizedTitle);

        const img = $(el).find('img.lazy').attr('data-original') || $(el).find('img').attr('src');
        
        // ISBN 추출 (상세 페이지 링크에서 추출 시도)
        const href = $(el).find('.gd_name').attr('href') || '';
        const isbnMatch = href.match(/Product\/Goods\/(\d+)/);
        const isbn = isbnMatch ? isbnMatch[1] : null;

        // 출판사 및 출간일 추출 (info_pub 내에 있음 예: 출판사 | 2024년 03월)
        const pubText = $(el).find('.info_pub').text().trim();
        const pub = pubText.split('|')[0]?.trim() || '알수없음';
        const dateMatch = pubText.match(/\d{4}년\s*\d{1,2}월/);
        const pubDate = dateMatch ? formatDate(dateMatch[0]) : null;

        books.push({ 
          rank: books.length + 1, 
          title: titleText, 
          author, 
          publisher: pub, 
          pub_date: pubDate,
          isbn
        });
      });

      if (books.length > 0) return books;
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

// 알라딘 - Axios 방식 (재시도 로직 포함)
async function scrapeAladdin(category, retries = 3) {
  console.log(`[Aladdin] ${category.name}...`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladdin}`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];
      const seenTitles = new Set();

      $('.ss_book_box').each((i, el) => {
        if (books.length >= 50) return;

        const titleArea = $(el).find('.ss_book_list li').first();
        const titleLink = titleArea.find('a.bo3');
        if (titleLink.length === 0) return; // Not a book title link

        const titleText = titleLink.text().trim();
        if (!titleText) return;

        // Skip non-books (merchandise)
        if (!isValidBook(titleText, 'Aladin')) return;
        
        const infoArea = titleArea.next();
        const info = infoArea.text().trim();
        const priceArea = infoArea.next().text().trim();

        if (priceArea.includes('포인트 차감') || !info.includes('|')) return;
        if (titleText.includes(') 이상') || titleText.includes(') 사은품')) return;

        const normalizedTitle = titleText.replace(/\s+/g, '').toLowerCase();
        if (seenTitles.has(normalizedTitle)) return;
        seenTitles.add(normalizedTitle);

        const parts = info.split('|');
        const author = cleanAuthor(parts[0]?.trim());
        const pub = parts[1]?.trim();
        const dateStr = parts[2]?.trim(); 
        const pubDate = formatDate(dateStr);
        
        // ISBN 추출 (itemId가 보통 URL에 있음)
        const href = titleLink.attr('href') || '';
        const isbnMatch = href.match(/ItemId=(\d+)/);
        const isbn = isbnMatch ? isbnMatch[1] : null;

        books.push({ 
          rank: books.length + 1, 
          title: titleText, 
          author, 
          publisher: pub, 
          pub_date: pubDate,
          isbn
        });
      });

      if (books.length > 0) return books;
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

// 교보 - Puppeteer + API Response (재시도 로직 포함)
async function scrapeKyobo(category, retries = 3) {
  console.log(`[Kyobo] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();
    let apiResponse = null;

    page.on('response', async (response) => {
      if (response.url().includes('best-seller/online')) {
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
      // 국내도서(domestic) 필터 추가 및 per=50 설정
      const url = `https://store.kyobobook.co.kr/bestseller/online/daily/domestic?dsplDvsnCode=${category.kyobo}&per=50`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      await page.close();

      if (apiResponse && apiResponse.data.bestSeller) {
        return apiResponse.data.bestSeller.slice(0, 50).map((item, idx) => ({
          rank: item.prstRnkn || (idx + 1),
          title: item.cmdtName,
          author: cleanAuthor(item.chrcName),
          publisher: item.pbcmName || '알수없음',
          pub_date: formatDate(item.rlseDate),
          isbn: item.cmdtCode
        })).filter(b => isValidBook(b.title, b.author));
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

// 리디 - Puppeteer + __NEXT_DATA__ (재시도 로직 포함)
async function scrapeRidi(category, retries = 3) {
  console.log(`[Ridi] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();

    try {
      await page.setUserAgent(HEADERS['User-Agent']);
      // 리디 베스트셀러 기본 URL 변경
      const url = category.ridi === 'general' 
        ? 'https://ridibooks.com/bestsellers/general'
        : `https://ridibooks.com/category/bestsellers/${category.ridi}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      const books = await page.evaluate(() => {
        try {
          const nextDataEl = document.getElementById('__NEXT_DATA__');
          if (!nextDataEl) return [];
          const data = JSON.parse(nextDataEl.textContent);

          const queries = data.props?.pageProps?.dehydratedState?.queries || [];
          const bestsellersQuery = queries.find(q => q.state?.data?.bestsellers);
          if (!bestsellersQuery) return [];

          const items = bestsellersQuery.state.data.bestsellers.items || [];

          return items.slice(0, 50).map((item, idx) => {
            const book = item.book;
            const authors = book.authors
              ?.filter(a => ['author', 'AUTHOR', 'original_author'].includes(a.role))
              .map(a => a.name)
              .join(', ') || '알수없음';

            return {
              rank: idx + 1,
              title: book.title?.main || book.title,
              author: authors,
              publisher: book.publicationInfo?.name || book.publisher?.name || '리디북스',
              isbn: book.isbn || book.id
            };
          });
        } catch (e) {
          return [];
        }
      });

      await page.close();

      const cleanedBooks = books
        .map(book => ({
          ...book,
          author: cleanAuthor(book.author)
        }))
        .filter(book => isValidBook(book.title, book.author));

      if (cleanedBooks.length > 0) return cleanedBooks;
    } catch (e) {
      console.error(`  [!] Ridi Attempt ${attempt} failed: ${e.message}`);
      await page.close();
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return [];
}

// 밀리 - Puppeteer + DOM (재시도 및 다양한 셀렉터 전략)
async function scrapeMillie(category, retries = 3) {
  console.log(`[Millie] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();

    try {
      await page.setUserAgent(HEADERS['User-Agent']);
      // 밀리 v3 종합 주소 변경
      const url = `https://www.millie.co.kr/v3/today/more/best/ranking/${category.millie}`;

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 4000));

      const books = await page.evaluate(() => {
        const list = [];
        // v3 도서 카드 셀렉터
        const items = document.querySelectorAll('a.book-data');
        
        items.forEach((el, idx) => {
          if (list.length >= 50) return;
          
          const pTags = Array.from(el.querySelectorAll('p'));
          let title = '';
          let author = '';
          
          // 밀리 특유의 '낭독자' 포함 구조 필터링
          if (pTags.length >= 3) {
            // 0: 낭독자, 1: 제목, 2: 저자
            title = pTags[1].innerText.trim();
            author = pTags[2].innerText.trim();
          } else if (pTags.length === 2) {
            // 0: 제목, 1: 저자
            title = pTags[0].innerText.trim();
            author = pTags[1].innerText.trim();
          } else if (pTags.length === 1) {
            title = pTags[0].innerText.trim();
          }

          if (title) {
            const imgEl = el.querySelector('img');
            // Check robustly for lazy-loaded src or standard src
            const coverSrc = imgEl?.src || imgEl?.dataset?.src || imgEl?.dataset?.original || imgEl?.getAttribute('data-src');
            // If it starts with data:image (base64 placeholder), we consider it missing
            const finalCover = coverSrc && !coverSrc.startsWith('data:image') ? coverSrc : null;
            
            list.push({
              rank: idx + 1,
              title,
              author: author || '알수없음',
              publisher: '밀리의서재'
            });
          }
        });
        return list;
      });

      await page.close();

      const cleanedBooks = books
        .map(book => ({
          ...book,
          author: cleanAuthor(book.author)
        }))
        .filter(book => isValidBook(book.title, book.author));

      if (cleanedBooks.length > 0) return cleanedBooks;
    } catch (e) {
      console.error(`  [!] Millie Attempt ${attempt} failed: ${e.message}`);
      await page.close();
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  return [];
}

async function sync(platform, books, categoryName) {
  if (books.length === 0) return;
  console.log(`  -> Syncing ${books.length} items for ${platform}...`);

  for (const book of books) {
    try {
      const cleanTitle = book.title.replace(/\[도서\]/g, '').trim();
      let cover = book.cover_url;
      let pub = book.publisher;
      let isbn = book.isbn;

      // 알라딘 API를 이용한 결측치 메꾸기 (표지가 없거나 밀리의서재/알수없음 출판사인 경우)
      if (!cover || !cover.startsWith('http') || pub === '알수없음' || pub === '밀리의서재') {
        const fallback = await fetchMissingInfo(cleanTitle, book.author);
        if (fallback) {
          if (!cover || !cover.startsWith('http')) cover = fallback.cover_url;
          if (pub === '알수없음' || pub === '밀리의서재') pub = fallback.publisher;
          if (!isbn) isbn = fallback.isbn;
        }
      }

      const { data: record } = await supabase.from('bw_books')
        .upsert({
          title: cleanTitle,
          author: book.author || '알수없음',
          publisher: pub || '알수없음',
          pub_date: book.pub_date || null,
          isbn: isbn || null
        }, { onConflict: 'title,author' }) // ISBN이 있으면 더 좋지만 일단 호환성 유지
        .select().single();

      if (record) {
        await supabase.from('bw_bestseller_snapshots').insert({
          book_id: record.id,
          platform,
          period_type: 'daily',
          rank: book.rank,
          common_category: categoryName,
          snapshot_date: getYesterdayKST()
        });
      }
    } catch (err) {
      // 중복 데이터 무시
    }
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Bestseller Scraping Started (All Categories)...`);
  
  await initBrowser();

  try {
    for (const category of COMMON_CATEGORIES) {
      console.log(`\n--- Scraping Category: ${category.name} ---`);
      
      const [yes24, aladin, kyobo, ridi, millie] = await Promise.all([
        scrapeYes24(category),
        scrapeAladdin(category),
        scrapeKyobo(category),
        scrapeRidi(category),
        scrapeMillie(category)
      ]);

      await sync('yes24', yes24, category.name);
      await sync('aladin', aladin, category.name);
      await sync('kyobo', kyobo, category.name);
      await sync('ridi', ridi, category.name);
      await sync('millie', millie, category.name);

      console.log(`✅ Category ${category.name} completed.`);
    }
  } catch (error) {
    console.error('❌ Scraping session failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log(`\n[${new Date().toISOString()}] All tasks completed.`);
    process.exit(0);
  }
}

module.exports = {
  initBrowser,
  scrapeKyobo,
  scrapeYes24,
  scrapeAladdin,
  scrapeRidi,
  scrapeMillie,
  run: main
};

if (require.main === module) {
  main();
}
