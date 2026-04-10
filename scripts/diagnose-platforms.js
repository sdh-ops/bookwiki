"use strict";

const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Referer': 'https://www.google.com/'
};

async function diagnoseKyobo() {
    console.log('\n=== KYOBO 진단 ===');
    const url = 'https://store.kyobobook.co.kr/bestseller/online/weekly/domestic/01';

    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        const html = res.data;
        const $ = cheerio.load(html);

        console.log('✓ 페이지 로드 성공:', html.length, 'bytes');

        // __NEXT_DATA__ 확인
        if (html.includes('__NEXT_DATA__')) {
            console.log('✓ __NEXT_DATA__ 발견');
            try {
                const jsonStr = html.split('__NEXT_DATA__">')[1].split('</script>')[0];
                const data = JSON.parse(jsonStr);
                console.log('✓ JSON 파싱 성공');

                // 가능한 데이터 경로들 탐색
                const paths = [
                    data.props?.pageProps?.initialData?.items,
                    data.props?.pageProps?.items,
                    data.props?.pageProps?.data?.items,
                    data.props?.pageProps?.bestSeller?.items
                ];

                for (let i = 0; i < paths.length; i++) {
                    if (paths[i] && Array.isArray(paths[i])) {
                        console.log(`✓ 경로 ${i}에서 아이템 발견:`, paths[i].length, '개');
                        console.log('  첫 번째 아이템:', JSON.stringify(paths[i][0], null, 2).substring(0, 300));
                        return;
                    }
                }

                console.log('✗ 알려진 경로에서 아이템을 찾을 수 없음');
                console.log('  pageProps 키:', Object.keys(data.props?.pageProps || {}));
            } catch (e) {
                console.error('✗ JSON 파싱 실패:', e.message);
            }
        } else {
            console.log('✗ __NEXT_DATA__ 없음');
        }

        // Cheerio 셀렉터 확인
        const prodItems = $('.prod_item').length;
        const prodNames = $('.prod_name').length;
        console.log(`Cheerio: .prod_item=${prodItems}, .prod_name=${prodNames}`);

    } catch (e) {
        console.error('✗ 에러:', e.message);
    }
}

async function diagnoseRidi() {
    console.log('\n=== RIDI 진단 ===');
    const urls = [
        'https://ridibooks.com/bestsellers/general',
        'https://ridibooks.com/categories/001000/?order=best',
        'https://ridibooks.com/category/bestseller/100'
    ];

    for (const url of urls) {
        console.log('\nURL:', url);
        try {
            const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
            const html = res.data;
            const $ = cheerio.load(html);

            console.log('  페이지 크기:', html.length, 'bytes');

            // __NEXT_DATA__ 확인
            if (html.includes('__NEXT_DATA__')) {
                console.log('  ✓ __NEXT_DATA__ 발견');
                try {
                    const jsonStr = html.split('__NEXT_DATA__">')[1].split('</script>')[0];
                    const data = JSON.parse(jsonStr);

                    // props 구조 탐색
                    const pageProps = data.props?.pageProps;
                    if (pageProps) {
                        console.log('    pageProps 키:', Object.keys(pageProps));

                        // 가능한 데이터 경로
                        if (pageProps.books) console.log('    ✓ books:', pageProps.books.length);
                        if (pageProps.items) console.log('    ✓ items:', pageProps.items.length);
                        if (pageProps.initialBooks) console.log('    ✓ initialBooks:', pageProps.initialBooks.length);
                    }
                } catch (e) {
                    console.log('    ✗ JSON 파싱 실패');
                }
            }

            // Cheerio 셀렉터 확인
            const articles = $('article').length;
            const bookItems = $('[class*="BookItem"]').length;
            const h3s = $('h3').length;
            console.log(`  Cheerio: article=${articles}, BookItem=${bookItems}, h3=${h3s}`);

        } catch (e) {
            console.error('  ✗ 에러:', e.message);
        }
    }
}

async function diagnoseMillie() {
    console.log('\n=== MILLIE 진단 ===');
    const urls = [
        'https://www.millie.co.kr/v3/bestseller',
        'https://www.millie.co.kr/v3/rank?type=WEEKLY&category=1',
        'https://api.millie.co.kr/v3/rank?type=WEEKLY&category=1'
    ];

    const headers = [
        HEADERS,
        {
            ...HEADERS,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.millie.co.kr',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors'
        }
    ];

    for (const url of urls) {
        for (let h = 0; h < headers.length; h++) {
            console.log(`\nURL: ${url} (헤더 세트 ${h + 1})`);
            try {
                const res = await axios.get(url, { headers: headers[h], timeout: 15000 });
                console.log('  ✓ 상태:', res.status);
                console.log('  크기:', res.data.length || JSON.stringify(res.data).length, 'bytes');
                console.log('  Content-Type:', res.headers['content-type']);

                if (typeof res.data === 'object') {
                    console.log('  ✓ JSON 응답:', Object.keys(res.data));
                } else {
                    const $ = cheerio.load(res.data);
                    const bookInfos = $('.book-info, [class*="book_info"]').length;
                    console.log('  Cheerio: book-info 요소', bookInfos, '개');
                }

                break; // 성공하면 다음 URL로
            } catch (e) {
                console.error('  ✗ 에러:', e.response?.status || e.message);
            }
        }
    }
}

async function run() {
    await diagnoseKyobo();
    await diagnoseRidi();
    await diagnoseMillie();

    console.log('\n=== 진단 완료 ===');
}

run();
