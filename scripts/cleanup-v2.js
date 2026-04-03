const { supabase } = require('./common');
const axios = require('axios');

const ALADIN_API_KEY = 'ttbsue_1201547001';

/**
 * Cleanup V2: 더 강력한 출판사 교정 스크립트
 * 1. '밀리의서재'로 된 책들을 찾음
 * 2. 동일한 제목(정규화)을 가진 다른 책들 중 제대로 된 출판사가 있는지 확인
 * 3. 없으면 알라딘 API로 재조회
 * 4. 정보 업데이트
 */

function normalizeTitle(title) {
  return title
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\s+/g, '')
    .trim();
}

async function fetchFromAladin(title, author) {
    try {
        console.log(`🔍 [Aladin API] Searching for: ${title} / ${author}`);
        // ISBN 검색 시도 (제목+저자)
        const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ALADIN_API_KEY}&Query=${encodeURIComponent(title + ' ' + author)}&QueryType=Keyword&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`;
        const res = await axios.get(url);
        if (res.data && res.data.item && res.data.item.length > 0) {
            return res.data.item[0];
        }
    } catch (e) {
        console.error('Aladin API Error:', e.message);
    }
    return null;
}

async function runCleanup() {
    console.log("🚀 Starting Cleanup V2...");
    
    // 1. 밀리의서재로 된 책들 다 가져오기
    const { data: badBooks, error } = await supabase
        .from('bw_books')
        .select('*')
        .eq('publisher', '밀리의서재');
    
    if (error) {
        console.error("Fetch error:", error);
        return;
    }
    
    console.log(`Found ${badBooks.length} books with '밀리의서재' as publisher.`);

    // 모든 책 일단 가져오기 (트윈 찾기용)
    const { data: allBooks } = await supabase.from('bw_books').select('*');
    const bookMap = {}; // normalizedTitle -> [books]
    allBooks.forEach(b => {
        const key = normalizeTitle(b.title);
        if (!bookMap[key]) bookMap[key] = [];
        bookMap[key].push(b);
    });

    for (const book of badBooks) {
        let fixedInfo = null;

        // 2. 트윈 찾기
        const key = normalizeTitle(book.title);
        const twins = bookMap[key] || [];
        const validTwin = twins.find(t => t.publisher && t.publisher !== '밀리의서재' && t.publisher !== '알수없음');

        if (validTwin) {
            console.log(`✅ Found twin for "${book.title}": ${validTwin.publisher}`);
            fixedInfo = {
                publisher: validTwin.publisher,
                pub_date: validTwin.pub_date,
                isbn: validTwin.isbn,
                cover_url: validTwin.cover_url,
                description: validTwin.description
            };
        } else {
            // 3. 알라딘 조회
            const aladinData = await fetchFromAladin(book.title, book.author);
            if (aladinData) {
                console.log(`✨ Aladin match for "${book.title}": ${aladinData.publisher}`);
                fixedInfo = {
                    publisher: aladinData.publisher,
                    pub_date: aladinData.pubDate,
                    isbn: aladinData.isbn,
                    cover_url: aladinData.cover,
                    description: aladinData.description
                };
            }
        }

        if (fixedInfo) {
            const { error: updateError } = await supabase
                .from('bw_books')
                .update(fixedInfo)
                .eq('id', book.id);
            
            if (updateError) {
                console.error(`❌ Failed to update ${book.id}:`, updateError);
            } else {
                console.log(`🎉 Successfully updated "${book.title}"`);
            }
        } else {
            console.log(`⚠️ No better info found for "${book.title}"`);
        }
    }
    
    console.log("🏁 Cleanup V2 Finished.");
}

runCleanup();
