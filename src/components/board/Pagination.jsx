import Link from "next/link";

const MAX_VISIBLE = 5;

function pageWindow(current, total) {
  let start = Math.max(1, current - Math.floor(MAX_VISIBLE / 2));
  const end = Math.min(total, start + MAX_VISIBLE - 1);
  if (end - start + 1 < MAX_VISIBLE) start = Math.max(1, end - MAX_VISIBLE + 1);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

// 모바일에서도 손가락으로 누를 수 있게 40px(모바일)·32px(PC) 이상
// display(inline-flex/hidden)는 BOX 에 넣지 않는다 — 「모바일에선 숨김」과 한 요소에서 부딪친다
const BOX = "items-center justify-center min-w-10 h-10 md:min-w-8 md:h-8 px-2 rounded-md text-sm md:text-xs";

function Arrow({ href, disabled, label, children, className = "inline-flex" }) {
  if (disabled) {
    return (
      <span aria-hidden="true" className={`${BOX} text-gray-300 ${className}`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${BOX} text-gray-600 hover:bg-gray-100 ${className}`}>
      {children}
    </Link>
  );
}

/**
 * 페이지 번호. 각 번호가 진짜 링크라서 검색어·말머리·필터가 그대로 실린다
 * (hrefFor 가 현재 조건을 유지한 주소를 만든다).
 */
export default function Pagination({ currentPage, totalPages, totalCount, hrefFor }) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(currentPage, totalPages);

  return (
    <nav aria-label="페이지" className="mt-6 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        <Arrow href={hrefFor(1)} disabled={currentPage === 1} label="첫 페이지" className="hidden sm:inline-flex">
          «
        </Arrow>
        <Arrow href={hrefFor(currentPage - 1)} disabled={currentPage === 1} label="이전 페이지">
          ‹
        </Arrow>
        {pages.map((page) =>
          page === currentPage ? (
            <span key={page} aria-current="page" className={`inline-flex ${BOX} bg-[#355E3B] text-white font-bold`}>
              {page}
            </span>
          ) : (
            <Link key={page} href={hrefFor(page)} className={`inline-flex ${BOX} text-gray-600 hover:bg-gray-100`}>
              {page}
            </Link>
          )
        )}
        <Arrow href={hrefFor(currentPage + 1)} disabled={currentPage === totalPages} label="다음 페이지">
          ›
        </Arrow>
        <Arrow href={hrefFor(totalPages)} disabled={currentPage === totalPages} label="마지막 페이지" className="hidden sm:inline-flex">
          »
        </Arrow>
      </div>
      <span className="text-xs text-gray-500">
        총 {totalCount.toLocaleString()}개 · {currentPage}/{totalPages} 페이지
      </span>
    </nav>
  );
}
