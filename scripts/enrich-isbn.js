"use strict";

const axios = require('axios');
const { supabase } = require('./common');

/**
 * 알라딘 ItemSearch API로 ISBN 보강
 * - ISBN 없는 책들을 제목+저자로 검색
 * - ISBN, 표지, 설명, 출판일 등 업데이트
 */

const ALADIN_API_KEY = 'ttbsdh10220011';
const ALADIN_SEARCH_URL = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
const DELAY_MS = 1000; // API 호출 간격 (1초)

async function searchBookOnAladin(title, author) {
  try {
    // 제목에서 불필요한 문자 제거
    let cleanTitle = title
      .replace(/\[도서\]/g, '')
      .replace(/\(.*?\)/g, '')  // 괄호 제거
      .replace(/[0-9,원→\-할인마일리지%\s]/g, '')  // 가격 정보 제거
      .trim();

    // 저자명 정리
    let cleanAuthor = author || '';

    // 가격 정보가 포함되어 있으면 건너뛰기
    if (cleanAuthor.includes('원') || cleanAuthor.includes('할인')) {
      cleanAuthor = '';
    } else {
      cleanAuthor = cleanAuthor
        .replace(/\(지은이\)/g, '')
        .replace(/\(옮긴이\)/g, '')
        .replace(/\(감수\)/g, '')
        .replace(/\(그림\)/g, '')
        .replace(/\(저\)/g, '')
        .replace(/\(역\)/g, '')
        .replace(/저$/g, '')
        .replace(/역$/g, '')
        .split(',')[0]
        .split('/')[0]
        .trim();
    }

    const params = {
      ttbkey: ALADIN_API_KEY,
      Query: cleanTitle,
      QueryType: 'Title',
      MaxResults: 5,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };

    const response = await axios.get(ALADIN_SEARCH_URL, { params, timeout: 10000 });

    if (!response.data || !response.data.item || response.data.item.length === 0) {
      return null;
    }

    // 제목과 저자가 가장 유사한 결과 찾기
    for (const item of response.data.item) {
      const titleMatch = item.title.toLowerCase().includes(cleanTitle.toLowerCase()) ||
                        cleanTitle.toLowerCase().includes(item.title.toLowerCase());

      const authorMatch = !cleanAuthor ||
                         item.author.toLowerCase().includes(cleanAuthor.toLowerCase()) ||
                         cleanAuthor.toLowerCase().includes(item.author.toLowerCase());

      if (titleMatch && authorMatch) {
        return {
          isbn: item.isbn13 || item.isbn,
          cover_url: item.cover,
          description: item.description,
          publisher: item.publisher,
          pubDate: item.pubDate,
          category: item.categoryName
        };
      }
    }

    // 정확한 매칭 없으면 첫 번째 결과 반환 (제목이 포함되어 있으면)
    const firstItem = response.data.item[0];
    if (firstItem.title.toLowerCase().includes(cleanTitle.toLowerCase())) {
      return {
        isbn: firstItem.isbn13 || firstItem.isbn,
        cover_url: firstItem.cover,
        description: firstItem.description,
        publisher: firstItem.publisher,
        pubDate: firstItem.pubDate,
        category: firstItem.categoryName
      };
    }

    return null;

  } catch (error) {
    console.error(`  [!] API Error for "${title}":`, error.message);
    return null;
  }
}

async function enrichBooks() {
  console.log('\n=== ISBN Enrichment Started ===\n');

  // ISBN이 없는 책들 조회
  const { data: booksWithoutIsbn, error } = await supabase
    .from('bw_books')
    .select('id, title, author, publisher, cover_url')
    .is('isbn', null)
    .order('created_at', { ascending: false })
    .limit(100); // 한 번에 100개씩 처리

  if (error) {
    console.error('Error fetching books:', error);
    return;
  }

  if (!booksWithoutIsbn || booksWithoutIsbn.length === 0) {
    console.log('✅ All books already have ISBN!');
    return;
  }

  console.log(`Found ${booksWithoutIsbn.length} books without ISBN\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < booksWithoutIsbn.length; i++) {
    const book = booksWithoutIsbn[i];

    console.log(`[${i + 1}/${booksWithoutIsbn.length}] Searching: ${book.title} - ${book.author}`);

    const result = await searchBookOnAladin(book.title, book.author);

    if (result && result.isbn) {
      // DB 업데이트
      const updateData = {
        isbn: result.isbn
      };

      // 표지가 없거나 더 좋은 표지가 있으면 업데이트
      if (!book.cover_url || (result.cover_url && result.cover_url.includes('cover200'))) {
        updateData.cover_url = result.cover_url;
      }

      // 설명이 있으면 추가
      if (result.description) {
        updateData.description = result.description;
      }

      // 카테고리가 있으면 추가
      if (result.category) {
        updateData.category = result.category;
      }

      const { error: updateError } = await supabase
        .from('bw_books')
        .update(updateData)
        .eq('id', book.id);

      if (updateError) {
        console.log(`  ❌ Failed to update: ${updateError.message}`);
        failCount++;
      } else {
        console.log(`  ✅ Updated with ISBN: ${result.isbn}`);
        successCount++;
      }
    } else {
      console.log(`  ⚠️  Not found on Aladin`);
      failCount++;
    }

    // API Rate Limiting - 요청 간 대기
    if (i < booksWithoutIsbn.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n=== Enrichment Complete ===');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${booksWithoutIsbn.length}`);
}

enrichBooks();
