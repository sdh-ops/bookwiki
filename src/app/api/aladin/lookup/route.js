import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 책 표지·소개문 조회.
//
// 【왜 스크래핑인가 (2026-09-05)】
// 알라딘 Open API 는 **2026-10-30 에 종료**된다(신규 키 발급은 09-04 마감, 재발급 불가).
// 그런데 같은 값이 알라딘 상품 페이지의 JSON-LD 에 그대로 있다 — 표지(cover500)·소개문·저자·출판사.
// 그래서 ISBN 조회는 API 를 안 쓰고 상품 페이지에서 읽는다. 종료 전후로 동작이 같다.
//
// 【부하 — 이게 설계의 핵심】
// 상품 페이지는 **약 390KB** 다(API 응답은 2KB). 클릭마다 받으면 감당이 안 된다.
// → **한 번 받으면 bw_books 에 저장하고 다시는 안 받는다.** 두 번째부터는 외부 요청이 0이다.
//   bw_books 는 26,562행인데 표지가 116개뿐이라(2026-09-05) 채울 자리도 넓다.
//   실사용은 베스트셀러 목록에 새로 뜬 책만 긁게 되므로 하루 수십 건 수준이다.
//
// 【robots】 알라딘 robots.txt 는 `/shop/` 을 허용하고 `/search/`·`/ttb/` 를 막는다.
// ⛔ 그래서 **제목 검색은 스크래핑하지 않는다.** 제목 경로는 Open API 로만 두고,
//    2026-10-30 뒤에는 실패한다 — 호출부(베스트셀러 상세 팝업)에 이미 폴백 문구가 있다.

const PRODUCT_URL = 'https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=';
const ALADIN_SEARCH_URL = 'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
const ALADIN_API_KEY = process.env.ALADIN_TTB_KEY;

// 사람이 쓰는 브라우저만 상대하는 페이지다. 기본 헤더로 가면 빈 응답이 온다.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 12000;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function fetchHtml(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: ac.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text || null; // 0바이트는 "빈 결과"가 아니라 "못 읽었다"이다
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * 상품 페이지에서 서지를 뽑는다.
 * ⛔ 상품이 아니면(알라딘 홈으로 떨어지면) null — 「없다」가 아니라 「이 경로로는 못 찾았다」이다.
 */
function parseProduct(html) {
  if (!html || !/"@type"\s*:\s*"Book"/.test(html)) return null;

  const block = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  let ld = null;
  if (block) {
    try {
      ld = JSON.parse(block[1].trim());
    } catch {
      ld = null;
    }
  }

  const pick = (v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x == null) return null;
    if (typeof x === 'object') return x.name ?? null;
    const s = String(x).trim();
    return s || null;
  };

  // JSON-LD 가 깨지면 메타태그로 내려앉는다. 표지 하나라도 건지는 쪽이 낫다.
  const meta = (prop) =>
    html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ?? null;

  const cover = pick(ld?.image) ?? meta('og:image');
  const description = pick(ld?.description) ?? meta('og:description');
  if (!cover && !description) return null;

  return {
    title: pick(ld?.name),
    author: pick(ld?.author),
    publisher: pick(ld?.publisher),
    pubDate: pick(ld?.datePublished),
    description,
    isbn: pick(ld?.isbn),
    cover,
    categoryName: null,
    priceStandard: null,
    link: null,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isbn = searchParams.get('isbn');
    const title = searchParams.get('title');
    const author = searchParams.get('author');
    const type = searchParams.get('type'); // 'cover' = 표지만

    if (isbn) return await lookupByIsbn(isbn, type);
    if (title) return await searchByTitle(title, author, type);

    return NextResponse.json({ error: 'ISBN or title is required' }, { status: 400 });
  } catch (error) {
    console.error('[aladin] lookup 실패:', error);
    return NextResponse.json({ error: 'Failed to fetch book details' }, { status: 500 });
  }
}

async function lookupByIsbn(isbn, type) {
  const supabase = db();

  // ① 캐시 — 저장돼 있으면 외부를 아예 안 부른다. 이게 부하 대책의 전부다.
  let cached = null;
  if (supabase) {
    const { data } = await supabase
      .from('bw_books')
      .select('id, title, author, publisher, cover_url, description, pub_date')
      .eq('isbn', isbn)
      .maybeSingle();
    cached = data ?? null;
  }
  if (type === 'cover' && cached?.cover_url) {
    return NextResponse.json({ cover: cached.cover_url });
  }
  if (cached?.cover_url && cached?.description) {
    return NextResponse.json({
      title: cached.title,
      author: cached.author,
      publisher: cached.publisher,
      pubDate: cached.pub_date,
      description: cached.description,
      isbn,
      cover: cached.cover_url,
      categoryName: null,
      priceStandard: null,
      link: null,
    });
  }

  // ⛔ 우리가 아는 책만 긁는다. 이 라우트는 공개라, 이 가드가 없으면 아무 ISBN 이나 넣어
  //    **우리 서버를 알라딘 스크래핑 대리인으로** 쓸 수 있다(요청 1건당 390KB 를 대신 받아준다).
  //    호출부는 늘 bw_books 의 책을 넘기므로 정상 사용에는 영향이 없다.
  if (supabase && !cached) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // ② 상품 페이지에서 읽는다.
  const book = parseProduct(await fetchHtml(PRODUCT_URL + encodeURIComponent(isbn)));
  if (!book) {
    // 캐시에 반쪽이라도 있으면 그거라도 준다 — 빈손보다 낫다.
    if (cached?.cover_url || cached?.description) {
      return NextResponse.json({
        title: cached.title,
        author: cached.author,
        publisher: cached.publisher,
        pubDate: cached.pub_date,
        description: cached.description,
        isbn,
        cover: cached.cover_url,
      });
    }
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // ③ 저장 — 다음부터는 ①에서 끝난다. ⛔ 이미 있는 값은 덮지 않는다(사람이 고친 값을 지우지 않게).
  if (supabase && cached?.id) {
    const patch = {};
    if (!cached.cover_url && book.cover) patch.cover_url = book.cover;
    if (!cached.description && book.description) patch.description = book.description;
    if (!cached.publisher && book.publisher) patch.publisher = book.publisher;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('bw_books').update(patch).eq('id', cached.id);
      // 저장 실패는 조회 실패가 아니다 — 값은 그대로 돌려주고 로그만 남긴다.
      if (error) console.error('[aladin] 캐시 저장 실패:', error.message);
    }
  }

  if (type === 'cover') return NextResponse.json({ cover: book.cover ?? null });
  return NextResponse.json({ ...book, isbn: book.isbn ?? isbn });
}

/**
 * 제목 검색 — Open API 전용.
 * ⛔ 스크래핑하지 않는다: 알라딘 robots.txt 가 `/search/` 를 막는다.
 * ⚠️ 2026-10-30 이후에는 늘 실패한다. 호출부에 「직접 검색해보세요」 폴백이 이미 있다.
 */
async function searchByTitle(title, author, type) {
  if (!ALADIN_API_KEY) {
    return NextResponse.json(
      { error: 'title search unavailable (Aladin Open API ended)' },
      { status: 503 }
    );
  }

  const url = new URL(ALADIN_SEARCH_URL);
  url.searchParams.append('ttbkey', ALADIN_API_KEY);
  url.searchParams.append('Query', title);
  url.searchParams.append('QueryType', 'Keyword');
  url.searchParams.append('MaxResults', '10');
  url.searchParams.append('start', '1');
  url.searchParams.append('SearchTarget', 'Book');
  url.searchParams.append('output', 'js');
  url.searchParams.append('Version', '20131101');

  const res = await fetch(url.toString(), { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: 'Aladin API request failed' }, { status: 502 });

  const data = await res.json();
  if (!data.item || data.item.length === 0) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  let best = data.item[0];
  if (author) {
    const clean = author.split(/[,/|]/)[0].replace(/\s(저|지음|그림|역|옮김|외)$/, '').trim().toLowerCase();
    for (const item of data.item) {
      if ((item.author ?? '').toLowerCase().includes(clean)) {
        best = item;
        break;
      }
    }
  }

  if (type === 'cover') return NextResponse.json({ cover: best.cover || null });
  return NextResponse.json({
    title: best.title,
    author: best.author,
    publisher: best.publisher,
    pubDate: best.pubDate,
    description: best.description,
    isbn: best.isbn13 || best.isbn,
    cover: best.cover,
    categoryName: best.categoryName,
    priceStandard: best.priceStandard,
    link: best.link,
  });
}
