"use strict";

const { supabase } = require('./common');

/**
 * 제목 정규화 함수
 * - 괄호 내용 제거 (영화 특별판), (양장) 등
 * - 특수문자 제거
 * - 공백 정리
 * - 소문자 변환
 */
function normalizeTitle(title) {
  if (!title) return '';

  return title
    // 괄호와 괄호 내용 제거
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    // 특수문자 제거 (한글, 영문, 숫자만 남김)
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
    // 연속된 공백을 하나로
    .replace(/\s+/g, ' ')
    // 앞뒤 공백 제거
    .trim()
    // 소문자 변환
    .toLowerCase();
}

/**
 * 저자 정규화 함수
 * - (지은이), (옮긴이) 등 제거
 * - 첫 번째 저자만 추출
 */
function normalizeAuthor(author) {
  if (!author || author === '알수없음') return '';

  return author
    .replace(/\(지은이\)/g, '')
    .replace(/\(옮긴이\)/g, '')
    .replace(/\(감수\)/g, '')
    .replace(/\(그림\)/g, '')
    .replace(/\(역\)/g, '')
    .replace(/\(저\)/g, '')
    .replace(/저$/g, '')
    .replace(/역$/g, '')
    .replace(/지은이$/g, '')
    .replace(/옮긴이$/g, '')
    .split(',')[0]
    .split('/')[0]
    .split(';')[0]
    .trim()
    .toLowerCase();
}

async function normalizeAllBooks() {
  console.log('\n=== Book Normalization Started ===\n');

  // 1. 모든 책 가져오기
  const { data: allBooks, error } = await supabase
    .from('bw_books')
    .select('id, title, author, isbn, normalized_title')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching books:', error);
    return;
  }

  console.log(`Total books to process: ${allBooks?.length || 0}\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  // 2. 각 책의 normalized_title 업데이트
  for (const book of allBooks) {
    const normalized = normalizeTitle(book.title);

    // 이미 정규화되어 있으면 스킵
    if (book.normalized_title === normalized) {
      skippedCount++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('bw_books')
      .update({ normalized_title: normalized })
      .eq('id', book.id);

    if (updateError) {
      console.error(`  ❌ Failed to update book ${book.id}: ${updateError.message}`);
    } else {
      updatedCount++;
      if (updatedCount % 50 === 0) {
        console.log(`  Progress: ${updatedCount} books normalized...`);
      }
    }
  }

  console.log('\n=== Normalization Complete ===');
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📊 Total: ${allBooks.length}`);

  // 3. 중복 분석
  console.log('\n=== Analyzing Duplicates ===\n');

  const groups = {};
  allBooks.forEach(book => {
    const key = book.normalized_title || normalizeTitle(book.title);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(book);
  });

  const duplicates = Object.entries(groups).filter(([key, books]) => books.length > 1);

  console.log(`Found ${duplicates.length} groups with duplicates\n`);

  // 상위 10개 중복 그룹 표시
  const top10 = duplicates
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  console.log('Top 10 duplicate groups:');
  top10.forEach(([normalizedTitle, books], idx) => {
    console.log(`\n${idx + 1}. "${normalizedTitle}" (${books.length} variations):`);
    books.forEach(book => {
      console.log(`   - ${book.title} (${book.author || '저자 없음'}) [ISBN: ${book.isbn || 'N/A'}]`);
    });
  });

  console.log('\n✅ Normalization and analysis complete!\n');
}

module.exports = { normalizeTitle, normalizeAuthor };

// Run if called directly
if (require.main === module) {
  normalizeAllBooks();
}
