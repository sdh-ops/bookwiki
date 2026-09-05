import { NextResponse } from 'next/server';

// 알라딘 Open API 키. ⛔ 하드코딩하지 마라 — 이 저장소는 **공개**다(2026-09-05 이전엔 박혀 있었다).
// ⚠️ 알라딘 Open API 는 2026-10-30 종료된다. 신규 키 발급도 끝나 **재발급이 불가**하다.
//    그날 이후 이 라우트는 늘 실패한다 — 호출부(admin/bestseller)에 이미 폴백이 있다.
const ALADIN_API_KEY = process.env.ALADIN_TTB_KEY;
const ALADIN_LOOKUP_URL = 'https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx';
const ALADIN_SEARCH_URL = 'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx';

export async function GET(request) {
  try {
    // 키가 없으면 `ttbkey=undefined` 로 알라딘을 부르게 된다 — 그러면 「책을 못 찾았다」처럼
    // 보여서 진짜 원인(환경변수 누락)이 숨는다. 여기서 분명히 끊는다.
    if (!ALADIN_API_KEY) {
      console.error('[aladin] ALADIN_TTB_KEY 환경변수가 없습니다 — 조회를 중단합니다');
      return NextResponse.json(
        { error: 'ALADIN_TTB_KEY not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isbn = searchParams.get('isbn');
    const title = searchParams.get('title');
    const author = searchParams.get('author');
    const type = searchParams.get('type'); // 'cover' for cover only

    // ISBN lookup
    if (isbn) {
      return await lookupByIsbn(isbn, type);
    }

    // Title search
    if (title) {
      return await searchByTitle(title, author, type);
    }

    return NextResponse.json(
      { error: 'ISBN or title is required' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Aladin API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book details' },
      { status: 500 }
    );
  }
}

async function lookupByIsbn(isbn, type) {
  const aladinUrl = new URL(ALADIN_LOOKUP_URL);
  aladinUrl.searchParams.append('ttbkey', ALADIN_API_KEY);
  aladinUrl.searchParams.append('ItemId', isbn);
  aladinUrl.searchParams.append('ItemIdType', 'ISBN13');
  aladinUrl.searchParams.append('output', 'js');
  aladinUrl.searchParams.append('Version', '20131101');
  aladinUrl.searchParams.append('OptResult', 'ebookList,usedList,previewImgList');

  const response = await fetch(aladinUrl.toString());

  if (!response.ok) {
    throw new Error('Aladin API request failed');
  }

  const data = await response.json();

  if (!data.item || data.item.length === 0) {
    return NextResponse.json(
      { error: 'Book not found' },
      { status: 404 }
    );
  }

  const book = data.item[0];

  // If only cover is requested
  if (type === 'cover') {
    return NextResponse.json({
      cover: book.cover || null
    });
  }

  // Return full book details
  return NextResponse.json({
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    pubDate: book.pubDate,
    description: book.description,
    isbn: book.isbn13 || book.isbn,
    cover: book.cover,
    categoryName: book.categoryName,
    priceStandard: book.priceStandard,
    link: book.link
  });
}

async function searchByTitle(title, author, type) {
  const aladinUrl = new URL(ALADIN_SEARCH_URL);
  aladinUrl.searchParams.append('ttbkey', ALADIN_API_KEY);
  aladinUrl.searchParams.append('Query', title);
  aladinUrl.searchParams.append('QueryType', 'Keyword'); // Using Keyword is more flexible
  aladinUrl.searchParams.append('MaxResults', '10');
  aladinUrl.searchParams.append('start', '1');
  aladinUrl.searchParams.append('SearchTarget', 'Book');
  aladinUrl.searchParams.append('output', 'js');
  aladinUrl.searchParams.append('Version', '20131101');

  const response = await fetch(aladinUrl.toString());

  if (!response.ok) {
    throw new Error('Aladin API request failed');
  }

  const data = await response.json();

  if (!data.item || data.item.length === 0) {
    // Retry with Keyword if not already or maybe search again with broader query
    return NextResponse.json(
      { error: 'Book not found' },
      { status: 404 }
    );
  }

  // Find best match among results
  let bestMatch = data.item[0];

  if (author) {
    // Simplify author for matching (e.g. "앤디 위어 저" -> "앤디 위어")
    const cleanAuth = author.split(/[,/|]/)[0].replace(/\s(저|지음|그림|역|옮김|외)$/, '').trim().toLowerCase();

    for (const item of data.item) {
      if (item.author.toLowerCase().includes(cleanAuth)) {
        bestMatch = item;
        break;
      }
    }
  }

  // Return full book details
  return NextResponse.json({
    title: bestMatch.title,
    author: bestMatch.author,
    publisher: bestMatch.publisher,
    pubDate: bestMatch.pubDate,
    description: bestMatch.description,
    isbn: bestMatch.isbn13 || bestMatch.isbn,
    cover: bestMatch.cover,
    categoryName: bestMatch.categoryName,
    priceStandard: bestMatch.priceStandard,
    link: bestMatch.link
  });
}
