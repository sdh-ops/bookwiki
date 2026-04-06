"use strict";

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

const ALADIN_API_KEY = 'ttbsue_1201547001';

/**
 * [Bestseller Scraper FINAL - 5 Platforms Integrated]
 * 교보/예스24/알라딘/리디/밀리 - 모든 플랫폼 지원
 */

const COMMON_CATEGORIES = [
  { name: '종합', yes24: '001', aladin: '0', kyobo: '0', ridi: 'general', millie: 'total' },
  { name: '소설', yes24: '001001046', aladin: '1', kyobo: '01', ridi: '100', millie: 'story' },
  { name: '에세이/시', yes24: '001001047', aladin: '51387', kyobo: '03', ridi: '110', millie: 'poem' },
  { name: '인문', yes24: '001001019', aladin: '656', kyobo: '05', ridi: '120', millie: 'humanities' },
  { name: '경제경영', yes24: '001001025', aladin: '170', kyobo: '13', ridi: '200', millie: 'economy' },
  { name: '자기계발', yes24: '001001026', aladin: '336', kyobo: '15', ridi: '300', millie: 'self-development' },
  { name: '사회과학', yes24: '001001022', aladin: '798', kyobo: '17', ridi: '420', millie: 'total' },
  { name: '역사', yes24: '001001010', aladin: '74', kyobo: '19', ridi: '440', millie: 'total' },
  { name: '예술', yes24: '001001007', aladin: '517', kyobo: '21', ridi: '430', millie: 'total' },
  { name: '종교', yes24: '001001021', aladin: '1237', kyobo: '23', ridi: '700', millie: 'total' },
  { name: '과학', yes24: '001001002', aladin: '987', kyobo: '25', ridi: '1100', millie: 'total' },
  { name: '기술/IT', yes24: '001001003', aladin: '351', kyobo: '27', ridi: '2200', millie: 'total' },
  { name: '만화', yes24: '001001008', aladin: '2551', kyobo: '47', ridi: '1500', millie: 'total' },
  { name: '여행', yes24: '001001009', aladin: '1196', kyobo: '32', ridi: '800', millie: 'hobby' },
  { name: '건강', yes24: '001001011', aladin: '55890', kyobo: '07' /*교보 건강은 07*/, ridi: '500', millie: 'hobby' }
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};

let browser = null;

// 알라딘 API 중복 호출 방지 캐시 (같은 책이 여러 카테고리에 등장할 때 재사용)
const aladdinCache = new Map();

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
    .replace(/\s(저|지음|그림|외|옮김|역).*$/g, '') // " 저", " 지음" 등 제거
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

// 누락된 출판사/출간일 정보를 알라딘 API를 통해 보완 (Fallback)
async function fetchMissingInfo(title, author) {
  const cacheKey = `${title}|||${author}`;
  if (aladdinCache.has(cacheKey)) return aladdinCache.get(cacheKey);

  try {
    const safeTitle = title.replace(/\[도서\]/g, '').split('(')[0].split('-')[0].trim();
    const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
    const baseParams = {
      ttbkey: ALADIN_API_KEY,
      QueryType: 'Keyword',
      MaxResults: 3,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };

    // 제목으로 결과를 검색하고 가장 유사한 항목을 반환
    async function searchAladin(query) {
      const response = await axios.get(url, { params: { ...baseParams, Query: query }, timeout: 5000 });
      return response.data?.item || [];
    }

    // 제목 유사도 검사 (앞 4글자 이상 일치 여부)
    function titleMatches(foundTitle) {
      const normalize = s => s.replace(/\s/g, '').replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, '').toLowerCase();
      const a = normalize(safeTitle).substring(0, Math.min(4, normalize(safeTitle).length));
      return normalize(foundTitle).includes(a);
    }

    let items = [];

    // 1차 시도: 제목 + 저자 첫 단어
    if (author && author !== '저자 미상' && author !== '알수없음') {
      items = await searchAladin(`${safeTitle} ${author.split(' ')[0]}`);
    }

    // 2차 시도: 제목만 (1차에서 결과 없거나 title 불일치 시)
    if (items.length === 0 || !titleMatches(items[0].title)) {
      items = await searchAladin(safeTitle);
    }

    // 제목이 일치하는 첫 번째 항목 선택
    const book = items.find(i => titleMatches(i.title)) || items[0];
    if (book) {
      const result = {
        publisher: book.publisher,
        isbn: book.isbn13 || book.isbn,
        pubDate: book.pubDate,
        description: book.description
      };
      aladdinCache.set(cacheKey, result);
      return result;
    }
  } catch (e) {}
  aladdinCache.set(cacheKey, null);
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

        const pubText = $(el).find('.info_pub').text().trim();
        const pub = pubText.split('|')[0]?.trim() || '알수없음';
        const dateMatch = pubText.match(/\d{4}년\s*\d{1,2}월\s*(\d{1,2}일)?/);
        const pubDate = dateMatch ? formatDate(dateMatch[0]) : null;

        // 판매지수 추출
        let salesPoint = null;
        $(el).find('span').each((_j, span) => {
          const text = $(span).text().replace(/\s+/g, ' ').trim();
          const match = text.match(/^판매지수\s*([\d,]+)$/);
          if (match) { salesPoint = parseInt(match[1].replace(/,/g, ''), 10); return false; }
        });

        books.push({
          rank: books.length + 1,
          title: titleText,
          author,
          publisher: pub,
          pub_date: pubDate,
          isbn,
          sales_point: salesPoint
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
  console.log(`[Aladin] ${category.name}...`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=${category.aladin}`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(res.data);

      const books = [];
      const seenTitles = new Set();

      $('.ss_book_box').each((i, el) => {
        if (books.length >= 50) return;

        // 알라딘 리스트는 굿즈나 사은품 안내가 섞여 있어 li 태그들을 순회하며 실제 제목 탐색
        let titleLink = null;
        let metadataLine = null;

        $(el).find('.ss_book_list li').each((idx, li) => {
          const a = $(li).find('a.bo3');
          if (a.length > 0 && !titleLink) {
            titleLink = a;
            // 제목 바로 다음 li가 보통 작가/출판사/날짜 정보
            metadataLine = $(li).next();
          }
        });

        if (!titleLink) return;

        const titleText = titleLink.text().trim();
        if (!titleText || !isValidBook(titleText, 'Aladin')) return;

        const info = metadataLine ? metadataLine.text().trim() : '';
        if (!info.includes('|')) return;

        const normalizedTitle = titleText.replace(/\s+/g, '').toLowerCase();
        if (seenTitles.has(normalizedTitle)) return;
        seenTitles.add(normalizedTitle);

        const parts = info.split('|');
        // 보통 [작가] | [출판사] | [날짜] 순서
        const author = cleanAuthor(parts[0]?.trim());
        const pub = parts[1]?.trim() || '알수없음';
        const dateStr = parts[2]?.trim() || ''; 
        const pubDate = formatDate(dateStr);
        
        const href = titleLink.attr('href') || '';
        const isbnMatch = href.match(/ItemId=(\d+)/);
        const isbn = isbnMatch ? isbnMatch[1] : null;

        const salesPointRaw = $(el).find('.sales_point').text().trim().replace(/,/g, '');
        const salesPoint = salesPointRaw ? parseInt(salesPointRaw, 10) : null;

        books.push({
          rank: books.length + 1,
          title: titleText,
          author,
          publisher: pub,
          pub_date: pubDate,
          isbn,
          sales_point: salesPoint
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
      console.log(`  -> Visiting Kyobo URL: ${url}`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // API 응답 캡처를 위해 조금 더 대기 (네트워크 상황 고려)
      await new Promise(r => setTimeout(r, 3000));

      if (apiResponse && apiResponse.data && apiResponse.data.bestSeller) {
        const kyoboBooks = apiResponse.data.bestSeller.slice(0, 50).map((item, idx) => ({
          rank: item.prstRnkn || (idx + 1),
          title: item.cmdtName,
          author: cleanAuthor(item.chrcName),
          publisher: item.pbcmName || '알수없음',
          pub_date: formatDate(item.rlseDate),
          isbn: item.cmdtCode
        })).filter(b => isValidBook(b.title, b.author));

        await page.close();
        if (kyoboBooks.length > 0) return kyoboBooks;
      }

      console.log(`  [!] API response not captured for Kyobo ${category.name}, trying DOM fallback...`);
      // DOM Fallback (만약 API 캡처 실패 시)
      const domBooks = await page.evaluate(() => {
        const list = [];
        // 교보 신규 스토어는 ol > li 또는 .prod_item 구조 사용
        const items = document.querySelectorAll('ol > li, .prod_item');
        items.forEach((el, idx) => {
          const titleEl = el.querySelector('a.prod_link, .prod_name');
          const infoEl = el.querySelector('div.text-gray-800, .prod_author'); 
          if (titleEl) {
            const infoText = infoEl ? infoEl.innerText.trim() : '';
            const author = infoText.split('·')[0].trim() || '알수없음';
            list.push({
              rank: idx + 1,
              title: titleEl.innerText.trim(),
              author: author
            });
          }
        });
        return list;
      });

      await page.close();

      if (domBooks.length > 0) {
        return domBooks.map(b => ({
          ...b,
          author: cleanAuthor(b.author)
        })).filter(b => isValidBook(b.title, b.author));
      }

      if (attempt < retries) {
        console.log(`  [!] Kyobo Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 3000));
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

          // 1. 종합 베스트셀러 쿼리 찾기
          const bestsellersQuery = queries.find(q => q.state?.data?.bestsellers);
          if (bestsellersQuery) {
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
                pub_date: book.publicationDate,
                isbn: book.isbn || book.id
              };
            });
          }

          // 2. 카테고리 베스트셀러 쿼리 찾기 (category/detail)
          const categoryQuery = queries.find(q => q.queryKey[0] === 'category/detail');
          if (categoryQuery && Array.isArray(categoryQuery.state?.data)) {
            const items = categoryQuery.state.data || [];
            return items.slice(0, 50).map((item, idx) => {
              const book = item.book;
              if (!book) return null;
              const authors = book.authors
                ?.filter(a => ['author', 'AUTHOR', 'original_author'].includes(a.role))
                .map(a => a.name)
                .join(', ') || '알수없음';

              return {
                rank: idx + 1,
                title: book.title?.main || book.title,
                author: authors,
                publisher: book.publicationInfo?.name || book.publisher?.name || '리디북스',
                pub_date: book.publicationDate,
                isbn: book.isbn || book.id
              };
            }).filter(i => i !== null);
          }
          return [];
        } catch (e) {
          return [];
        }
      });

      await page.close();

      const cleanedBooks = books
        .map(book => ({
          ...book,
          author: cleanAuthor(book.author),
          pub_date: book.pub_date ? book.pub_date.split('T')[0] : null
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

// 밀리 - Puppeteer + DOM (v3 전용)
async function scrapeMillie(category, retries = 3) {
  console.log(`[Millie] ${category.name}...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage();

    try {
      await page.setUserAgent(HEADERS['User-Agent']);
      // 밀리 v3 베스트셀러 주소 (서점 베스트 기준)
      const url = `https://www.millie.co.kr/v3/today/more/best/bookstore/${category.millie}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      // 50개를 채우기 위해 스크롤 (밀리는 지연 로딩 발생 가능)
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(r => setTimeout(r, 800));
        }
      });

      const books = await page.evaluate(() => {
        const list = [];
        // 밀리 v3 도서 리스트 아이템 셀렉터 (a.book-data 또는 li.item)
        const items = document.querySelectorAll('a.book-data, li.item');
        
        items.forEach((el, idx) => {
          if (list.length >= 50) return;
          
          const titleEl = el.querySelector('p.title, .title');
          const authorEl = el.querySelector('p.author, .author');
          
          if (titleEl) {
            const title = titleEl.innerText.trim();
            // 제목 앞의 배지(오디오북 등) 제거 로직이 필요할 수 있으나 일단 포함
            const author = authorEl ? authorEl.innerText.trim() : '알수없음';
            
            // 중복 및 비정상 데이터 방지
            if (title && !list.some(b => b.title === title)) {
              list.push({
                rank: list.length + 1,
                title,
                author,
                publisher: '밀리의서재'
              });
            }
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

async function sync(platform, books, categoryName, targetDate = null) {
  if (books.length === 0) return;
  const snapshotDate = targetDate || getYesterdayKST();
  console.log(`  -> Syncing ${books.length} items for ${platform} on ${snapshotDate}...`);

  // Step 1: 알라딘 API 보완 - 5개씩 병렬 처리 (rate limit 고려)
  const enrichedBooks = [];
  const ENRICH_BATCH = 5;
  for (let i = 0; i < books.length; i += ENRICH_BATCH) {
    const batch = books.slice(i, i + ENRICH_BATCH);
    const results = await Promise.all(batch.map(async (book) => {
      const cleanTitle = book.title.replace(/\[도서\]/g, '').trim();
      let pub = book.publisher;
      let pubDate = book.pub_date;
      let isbn = book.isbn;
      let description = book.description || null;

      const isInvalidIsbn = !isbn || (isbn.length < 10) || (!isbn.startsWith('978') && !isbn.startsWith('979'));

      if (pub === '알수없음' || pub === '밀리의서재' || !pubDate || isInvalidIsbn || platform === 'millie') {
        const fallback = await fetchMissingInfo(cleanTitle, book.author);
        if (fallback) {
          if (pub === '알수없음' || pub === '밀리의서재' || platform === 'millie') {
            if (fallback.publisher && fallback.publisher !== '밀리의서재') pub = fallback.publisher;
          }
          if (!pubDate || pubDate === 'null') pubDate = fallback.pubDate;
          if (!description) description = fallback.description;
          if (isInvalidIsbn) isbn = fallback.isbn;
        }
      }

      return {
        rank: book.rank,
        title: cleanTitle,
        author: book.author || '알수없음',
        publisher: pub || '알수없음',
        pub_date: pubDate || null,
        isbn: (isbn && isbn.length >= 10) ? isbn : null,
        description,
        sales_point: book.sales_point || null
      };
    }));
    enrichedBooks.push(...results);
  }

  try {
    // Step 2: bw_books 배치 upsert
    // 개별적으로 처리하여 한 권의 에러가 전체 배치를 망치지 않게 함
    const upsertResults = await Promise.all(enrichedBooks.map(async (b) => {
      try {
        const { data, error } = await supabase
          .from('bw_books')
          .upsert(
            {
              title: b.title, author: b.author, publisher: b.publisher,
              pub_date: b.pub_date, isbn: b.isbn, description: b.description
            },
            { onConflict: 'title,author', ignoreDuplicates: false }
          )
          .select('id, title, author')
          .single();
        
        if (error) {
          // ISBN 중복일 경우 처리 시도 (ISBN이 다를 수 있음)
          if (error.message.includes('bw_books_isbn_key')) {
             const { data: existing } = await supabase.from('bw_books').select('id, title, author').eq('isbn', b.isbn).single();
             if (existing) return existing;
          }
          console.error(`      [!] Upsert failed for "${b.title}":`, error.message);
          return null;
        }
        return data;
      } catch (e) {
        return null;
      }
    }));

    const upsertedBooks = upsertResults.filter(Boolean);

    if (upsertedBooks.length === 0) {
      console.error(`  [!] No books upserted for [${platform}/${categoryName}]`);
      return;
    }

    // Step 3: book_id 매핑 후 스냅샷 배치 upsert
    const bookIdMap = new Map(upsertedBooks.map(b => [`${b.title}|||${b.author}`, b.id]));
    const snapshots = enrichedBooks
      .map(book => {
        const id = bookIdMap.get(`${book.title}|||${book.author}`);
        if (!id) return null;
        return { book_id: id, platform, period_type: 'daily', rank: book.rank, common_category: categoryName, snapshot_date: snapshotDate, sales_point: book.sales_point || null };
      })
      .filter(Boolean);

    if (snapshots.length > 0) {
      await supabase.from('bw_bestseller_snapshots')
        .upsert(snapshots, { onConflict: 'book_id,platform,period_type,snapshot_date,common_category', ignoreDuplicates: true });
    }
  } catch (err) {
    console.error(`  [!] Sync error for ${platform}/${categoryName}:`, err.message);
  }
}

// 동시 실행 수 제한 헬퍼
function withConcurrency(limit) {
  let active = 0;
  const queue = [];
  return function run(fn) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        active++;
        try { resolve(await fn()); }
        catch (e) { reject(e); }
        finally {
          active--;
          if (queue.length > 0) queue.shift()();
        }
      };
      if (active < limit) execute();
      else queue.push(execute);
    });
  };
}

async function main(targetDateStr = null) {
  const targetDate = targetDateStr || getYesterdayKST();
  console.log(`[${new Date().toISOString()}] Bestseller Scraping Started (Date: ${targetDate})...`);

  await initBrowser();

  // 카테고리 3개씩 병렬 처리 (Puppeteer 탭 수 = 최대 9개 동시)
  const limit = withConcurrency(3);

  try {
    await Promise.all(COMMON_CATEGORIES.map(category => limit(async () => {
      console.log(`\n--- Scraping Category: ${category.name} ---`);

      const [yes24, aladin, kyobo, ridi, millie] = await Promise.all([
        scrapeYes24(category),
        scrapeAladdin(category),
        scrapeKyobo(category),
        scrapeRidi(category),
        scrapeMillie(category)
      ]);

      // 플랫폼별 sync도 병렬 처리
      await Promise.all([
        sync('yes24', yes24, category.name, targetDate),
        sync('aladin', aladin, category.name, targetDate),
        sync('kyobo', kyobo, category.name, targetDate),
        sync('ridi', ridi, category.name, targetDate),
        sync('millie', millie, category.name, targetDate),
      ]);

      console.log(`✅ Category ${category.name} completed.`);
    })));
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
  const args = process.argv.slice(2);
  const manualDate = args[0] || null;
  main(manualDate);
}
