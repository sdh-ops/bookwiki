"use strict";

const axios = require('axios');
const fs = require('fs');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': 'https://www.google.com/'
};

async function extractNextData(url, name) {
    console.log(`\n=== ${name} ===`);
    console.log('URL:', url);

    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        const html = res.data;

        // __NEXT_DATA__ 찾기 (여러 패턴 시도)
        const patterns = [
            /__NEXT_DATA__[^>]*>([^<]+)<\/script>/,
            /id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/,
            /id='__NEXT_DATA__'[^>]*>([^<]+)<\/script>/
        ];

        let jsonData = null;

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                console.log('✓ __NEXT_DATA__ 발견 (패턴 방식)');
                try {
                    jsonData = JSON.parse(match[1]);
                    console.log('✓ JSON 파싱 성공');
                    break;
                } catch (e) {
                    console.log('✗ JSON 파싱 실패:', e.message);
                }
            }
        }

        // 대체 방법: split으로 추출
        if (!jsonData && html.includes('__NEXT_DATA__')) {
            console.log('Split 방식 시도...');
            try {
                const parts = html.split('__NEXT_DATA__');
                if (parts.length > 1) {
                    const afterScript = parts[1];
                    const jsonStart = afterScript.indexOf('>') + 1;
                    const jsonEnd = afterScript.indexOf('</script>');
                    if (jsonStart > 0 && jsonEnd > jsonStart) {
                        const jsonStr = afterScript.substring(jsonStart, jsonEnd).trim();
                        jsonData = JSON.parse(jsonStr);
                        console.log('✓ Split 방식으로 파싱 성공');
                    }
                }
            } catch (e) {
                console.log('✗ Split 방식 실패:', e.message);
            }
        }

        if (jsonData) {
            // JSON 구조 분석
            console.log('\n데이터 구조:');
            console.log('  props 키:', Object.keys(jsonData.props || {}));
            console.log('  pageProps 키:', Object.keys(jsonData.props?.pageProps || {}));

            // 파일로 저장
            const filename = `c:\\Users\\15Z990\\Desktop\\더난\\북위키\\scripts\\${name.toLowerCase()}_next_data.json`;
            fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
            console.log(`\n✓ 전체 데이터를 ${filename}에 저장했습니다`);

            // 책 데이터 찾기
            const pageProps = jsonData.props?.pageProps;
            if (pageProps) {
                const possibleKeys = ['books', 'items', 'data', 'initialBooks', 'bestSellers', 'products'];
                for (const key of possibleKeys) {
                    if (pageProps[key]) {
                        console.log(`\n✓ ${key} 발견:`, Array.isArray(pageProps[key]) ? `${pageProps[key].length}개 아이템` : typeof pageProps[key]);
                        if (Array.isArray(pageProps[key]) && pageProps[key].length > 0) {
                            console.log('  첫 번째 아이템의 키:', Object.keys(pageProps[key][0]));
                        }
                    }
                }
            }
        } else {
            console.log('✗ __NEXT_DATA__를 찾을 수 없음');
            // HTML 샘플 저장
            const sample = html.substring(0, 5000);
            fs.writeFileSync(`c:\\Users\\15Z990\\Desktop\\더난\\북위키\\scripts\\${name.toLowerCase()}_sample.html`, sample);
            console.log(`  HTML 샘플을 저장했습니다`);
        }

    } catch (e) {
        console.error('✗ 에러:', e.message);
    }
}

async function run() {
    await extractNextData('https://ridibooks.com/bestsellers/general', 'RIDI_GENERAL');
    await extractNextData('https://ridibooks.com/category/bestseller/100', 'RIDI_BESTSELLER');
    await extractNextData('https://store.kyobobook.co.kr/bestseller/online/weekly/domestic/01', 'KYOBO');
    await extractNextData('https://product.kyobobook.co.kr/bestseller/online?period=001', 'KYOBO_PRODUCT');
}

run();
