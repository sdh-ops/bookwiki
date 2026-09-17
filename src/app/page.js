import HomeClient from "./HomeClient";

/**
 * 홈(목록) — 서버 껍데기.
 *
 * 목록은 그대로 브라우저가 그린다(HomeClient). 이 파일이 하는 일은 하나뿐이다:
 * 「이 화면의 정본 주소는 홈이다」를 검색엔진에 알린다.
 *
 * 왜 필요했나 — 게시판·페이지·검색어가 모두 쿼리 파라미터(`/?board=job`, `/?page=2`)라
 * 서버가 내보내는 HTML 이 주소마다 바이트까지 똑같았다. canonical 이 없으니 구글은
 * 「사용자가 선택한 표준이 없는 중복 페이지」로 보고 색인을 포기했다(2026-09-17 Search Console 통보).
 *
 * ⛔ searchParams 를 읽지 마라. 여기서 한 번 읽는 순간 홈이 정적 → 동적 렌더로 내려가
 * 첫 로딩이 느려진다. 검색결과 주소(`?q=`)는 robots.txt 로 막는다.
 * ⛔ canonical 을 루트 layout 으로 올리지 마라 — 글 상세까지 「정본은 홈」이 된다(layout.js 주석 참조).
 */
export const metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <HomeClient />;
}
