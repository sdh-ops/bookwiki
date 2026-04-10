"use strict";

const axios = require('axios');
const { supabase } = require('./common');

const ALADIN_API_KEY = 'ttbsue_1201547001';
const BATCH_SIZE = 5; // 병렬 처리 개수 (API 호출 제한 고려)

/**
 * 알라딘 API를 사용하여 도서의 정확한 메타데이터(출판사, ISBN, 출간일)를 가져옵니다.
 */
async function fetchCorrectInfo(title, author) {
  try {
    const query = `${title} ${author}`;
    const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ALADIN_API_KEY}&Query=${encodeURIComponent(query)}&QueryType=Keyword&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`;
    
    const response = await axios.get(url);
    const item = response.data.item?.[0];
    
    if (item) {
      return {
        publisher: item.publisher,
        isbn: item.isbn13 || item.isbn,
        pub_date: item.pubDate
      };
    }
  } catch (error) {
    console.error(`Error fetching info for ${title}:`, error.message);
  }
  return null;
}

/**
 * "밀리의서재"로 잘못 저장된 도서들을 찾아 수정합니다.
 */
async function fixMilliePublishers() {
  console.log('--- "밀리의서재" 출판사 정보 수정 시작 ---');

  // 1. "밀리의서재" 출판사를 가진 도서 목록 조회
  const { data: books, error } = await supabase
    .from('bw_books')
    .select('id, title, author, publisher')
    .eq('publisher', '밀리의서재');

  if (error) {
    console.error('도서 목록 조회 중 오류 발생:', error.message);
    return;
  }

  if (!books || books.length === 0) {
    console.log('수정할 도서가 없습니다.');
    return;
  }

  console.log(`총 ${books.length}권의 도서를 수정해야 합니다.`);

  let successCount = 0;
  let failCount = 0;

  // 2. 배치 단위로 처리
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (book) => {
      console.log(`[${i + batch.indexOf(book) + 1}/${books.length}] 처리 중: ${book.title} (${book.author})`);
      
      const correctInfo = await fetchCorrectInfo(book.title, book.author);
      
      if (correctInfo && correctInfo.publisher && correctInfo.publisher !== '밀리의서재') {
        const { error: updateError } = await supabase
          .from('bw_books')
          .update({
            publisher: correctInfo.publisher,
            isbn: correctInfo.isbn,
            pub_date: correctInfo.pub_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.id);

        if (updateError) {
          console.error(`  - 업데이트 실패 (${book.title}):`, updateError.message);
          failCount++;
        } else {
          console.log(`  - 업데이트 성공: ${book.publisher} -> ${correctInfo.publisher}`);
          successCount++;
        }
      } else {
        console.warn(`  - 정확한 정보를 찾을 수 없거나 출판사가 여전히 부적절함: ${book.title}`);
        failCount++;
      }
    }));

    // API 호출 간 약간의 지연 (Rate limit 방지)
    if (i + BATCH_SIZE < books.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('--- 작업 완료 ---');
  console.log(`성공: ${successCount}권`);
  console.log(`실패: ${failCount}권`);
}

// 스크립트 실행
if (require.main === module) {
  fixMilliePublishers()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
