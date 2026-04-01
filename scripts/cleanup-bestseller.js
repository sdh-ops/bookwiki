const { supabase } = require('./common');

// Using the same ultra-strict validation as the scraper
function isValidBook(title, author) {
  if (!title || title.length < 2) return false;
  
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
    '마그넷', '자석', '메모지', '포스트잇', '볼펜', '연필', '지우개', '샤프', '스케줄러'
  ];

  const lowerTitle = title.toLowerCase();
  if (blacklist.some(word => lowerTitle.includes(word.toLowerCase()))) return false;
  
  if (!author || author === '저자 미상' || author === '알수없음') {
    if (title.length < 5) return false;
    if (lowerTitle.includes('원 이상')) return false;
  }

  return true;
}

async function cleanup() {
  console.log('Starting bestseller data cleanup...');
  
  const { data: books, error: fetchError } = await supabase
    .from('bw_books')
    .select('id, title, author');

  if (fetchError) {
    console.error('Error fetching books:', fetchError);
    return;
  }

  console.log(`Total books in database: ${books.length}`);

  const invalidBooks = books.filter(b => !isValidBook(b.title, b.author));
  console.log(`Found ${invalidBooks.length} invalid books.`);

  if (invalidBooks.length === 0) {
    console.log('No invalid books to clean up.');
    return;
  }

  const invalidIds = invalidBooks.map(b => b.id);
  console.log(`Deleting ${invalidIds.length} invalid books and their snapshots...`);

  // Split into chunks of 100 to avoid large query errors
  const chunkSize = 100;
  for (let i = 0; i < invalidIds.length; i += chunkSize) {
    const chunk = invalidIds.slice(i, i + chunkSize);
    
    // snapshots deletion (FK cascade should handle it but being safe)
    await supabase.from('bw_bestseller_snapshots').delete().in('book_id', chunk);
    
    // books deletion
    const { error: delError } = await supabase.from('bw_books').delete().in('id', chunk);
    
    if (delError) {
      console.error(`Error deleting chunk ${i/chunkSize + 1}:`, delError.message);
    } else {
      console.log(`[${i + chunk.length}/${invalidIds.length}] Deleted...`);
    }
  }

  console.log('Cleanup complete.');
}

cleanup();
