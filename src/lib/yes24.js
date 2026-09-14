// YES24 Open API — 알라딘 Open API(2026-10-30 종료)의 대체 축.
//
// ⛔ **서버에서만 쓴다.** 키는 `YES24_API_KEY`(NEXT_PUBLIC_ 아님) — 클라이언트 번들에 들어가면 안 된다.
//    이 파일을 클라이언트 컴포넌트에서 import 하지 마라.
//
// ⛔ 「없다」와 「못 읽었다」를 섞지 않는다. API 가 둘을 갈라 준다(2026-09-14 실측):
//      · 없는 상품 → HTTP 404 + `errorCode: "GOODS_002"` → `{state:'none'}` (**사실**)
//      · 그 밖의 오류·네트워크·429 → `{state:'unknown'}` (**미확인**)
//    unknown 을 「없음」으로 캐시하면 그 책은 영영 빈 채로 남는다.
//
// ⛔ 429 는 `RATE_001` — **초당** 10회 한도(기본키, 일 20,000회)다. 쉬었다 다시 친다.
//
// ⚠️ 이 키는 더난 ERP 와 **같은 키**다. 한도를 나눠 쓴다 — 여기서 무분별하게 부르면 ERP 수집이 굶는다.
//    그래서 호출부는 반드시 캐시 뒤에 둔다(우리가 아는 책만, 한 번 받으면 저장).

const BASE = 'https://apis.yes24.com/v1';
const TIMEOUT_MS = 12000;

export function yes24Key() {
  return process.env.YES24_API_KEY || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 호출 한 번. {state:'ok'|'none'|'unknown'} */
export async function yes24Call(path, params) {
  const key = yes24Key();
  if (!key) return { state: 'unknown', reason: 'YES24_API_KEY 없음' };

  const qs = new URLSearchParams(params).toString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${BASE}${path}?${qs}`, {
        headers: { 'X-Api-Key': key },
        signal: ac.signal,
        cache: 'no-store',
      });
    } catch (e) {
      if (attempt < 2) { await sleep(800); continue; }
      return { state: 'unknown', reason: `네트워크: ${e?.message ?? e}` };
    } finally {
      clearTimeout(t);
    }

    if (res.status === 429) {
      if (attempt < 2) { await sleep(attempt === 0 ? 1200 : 2500); continue; }
      return { state: 'unknown', reason: '429 초당 한도(RATE_001)' };
    }

    const j = await res.json().catch(() => null);
    // ⭐ 「그 상품이 없다」는 여기서만 나온다. 다른 어떤 실패도 none 이 아니다.
    if (res.status === 404 && j?.errorCode === 'GOODS_002') return { state: 'none' };
    if (!res.ok || j?.success !== true) {
      return { state: 'unknown', reason: `${res.status} ${j?.errorCode ?? ''}`.trim() };
    }
    const items = j?.data?.items ?? [];
    if (items.length === 0) return { state: 'none' };
    return { state: 'ok', items, totalCount: j?.data?.totalCount ?? items.length };
  }
  return { state: 'unknown', reason: '재시도 후에도 읽지 못했습니다' };
}

/** YES24 item → 우리 서지 모양. 표지는 원본(L) 그대로. */
export function toBook(it) {
  const pub = String(it.publishDate ?? '').trim();
  return {
    title: it.title ?? null,
    author: it.author ?? null,
    publisher: it.publisher ?? null,
    // 'YYYYMMDD' → 'YYYY-MM-DD'. 아니면 비운다 — 지어내지 않는다.
    pubDate: /^\d{8}$/.test(pub) ? `${pub.slice(0, 4)}-${pub.slice(4, 6)}-${pub.slice(6)}` : null,
    description: it.contentDetail?.bookIntroduction || it.contentDetail?.bookSummary || null,
    isbn: it.isbn13 ?? null,
    cover: it.cover ?? null,
    categoryName: it.goodsSortNm ?? null,
    priceStandard: typeof it.shopPrice === 'number' ? Math.round(it.shopPrice) : null,
    link: it.link ?? null,
  };
}

/** ISBN13 한 건. */
export async function yes24ByIsbn(isbn) {
  return await yes24Call('/goods/itemDetail', {
    searchType: 'ISBN13', query: isbn, detail: 'Y',
  });
}

/**
 * 제목(+저자) 검색. **저자 전용 검색이 없어** 통합 검색이다 —
 * 그래서 호출부가 제목 유사도로 한 번 더 거른다.
 */
export async function yes24Search(query, pageSize = 10) {
  return await yes24Call('/goods/itemList', {
    query, category: 'BOOK', pageSize: String(pageSize), detail: 'Y',
  });
}
