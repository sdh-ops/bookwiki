const { supabase } = require('./common');
const puppeteer = require('puppeteer');

async function fixPublishers() {
  console.log('[*] Starting publisher data repair...');

  // 1. 밀리의서재/알수없음 도서 추출
  const { data: books, error } = await supabase
    .from('bw_books')
    .select('id, title, author, publisher')
    .or('publisher.eq.밀리의서재,publisher.eq.알수없음,publisher.eq.밀리')
    .limit(300); // 안전을 위해 한 번에 300개씩

  if (error) {
    console.error('[!] Error fetching books:', error.message);
    return;
  }

  console.log(`[*] Found ${books.length} books needing repair.`);

  if (books.length === 0) return;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    console.log(`[${i+1}/${books.length}] Searching for: ${book.title} (${book.author})`);

    try {
      const page = await browser.newPage();
      // 알라딘 검색 (제목 + 저자)
      const searchQuery = encodeURIComponent(`${book.title} ${book.author}`);
      const searchUrl = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=All&SearchWord=${searchQuery}`;
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // 첫 번째 검색 결과에서 출판사, ISBN, 출간일 추출
      const info = await page.evaluate(() => {
        const firstItem = document.querySelector('.ss_book_list');
        if (!firstItem) return null;

        const infoText = firstItem.innerText;
        // 보통 '출판사 | 2024년 1월' 형태 또는 리스트 하단에 있음
        // 알라딘 검색 결과의 상세 텍스트 추출
        const liElements = firstItem.querySelectorAll('li');
        let publisher = null;
        let pubDate = null;
        
        for (const li of liElements) {
          const text = li.innerText;
          if (text.includes('|') && (text.includes('20') || text.includes('19'))) {
            const parts = text.split('|').map(s => s.trim());
            // 예: 작가 | 출판사 | 2024-01-01
            if (parts.length >= 3) {
              publisher = parts[parts.length - 2];
              pubDate = parts[parts.length - 1];
            }
          }
        }

        // ISBN은 상세 페이지에 있으나, 검색 결과의 상품 코드(Item Id)를 이용하거나 
        // 그냥 출판사만이라도 제대로 가져오는 것이 우선
        return { publisher, pubDate };
      });

      if (info && info.publisher && info.publisher !== '밀리의서재') {
        console.log(`    [+] Found: ${info.publisher} (${info.pubDate})`);
        
        const { error: updateError } = await supabase
          .from('bw_books')
          .update({ 
            publisher: info.publisher,
            pub_date: info.pubDate ? new Date(info.pubDate.replace(/년|월|일/g, '-').replace(/-$/, '')) : null
          })
          .eq('id', book.id);

        if (updateError) {
          console.error(`    [!] Update failed:`, updateError.message);
        } else {
          console.log(`    [v] Updated successfully.`);
        }
      } else {
        console.log(`    [-] No reliable info found.`);
      }

      await page.close();
      // 매너 대기
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`    [!] Error during search:`, err.message);
    }
  }

  await browser.close();
  console.log('[*] Repair process finished.');
}

fixPublishers();
