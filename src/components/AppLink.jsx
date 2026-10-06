import Link from "next/link";

/**
 * 이 사이트의 모든 링크는 next/link 대신 이걸 쓴다 — 미리 불러오기(prefetch)를 끈 Link.
 *
 * Next 의 Link 는 화면에 보이는 순간 가려는 화면을 미리 받아 둔다(마우스를 올리거나 터치해도 받는다).
 * 홈 한 번 여는 데 61건(그중 44건이 미리 불러오기), 글 상세는 약 45건이 Vercel 로 나갔다 —
 * 글 목록 15건 + 메뉴·푸터 9곳이 링크마다 요청이 되고, 크롤러가 그걸 화면마다 되풀이한다.
 * 그게 무료 한도(CDN 요청 월 100만)의 75% 를 넘긴 원인이다(2026-10-06 실측).
 * 끄면 누른 순간에만 가져온다. 글·목록은 CDN 캐시라 체감 차이는 거의 없다.
 *
 * ⛔ 링크마다 prefetch 를 다시 켜지 마라. 정말 필요한 한두 곳만 `prefetch` 를 넘기면 그 링크만 켜진다.
 * eslint 가 next/link 를 직접 가져오는 걸 막는다(eslint.config.mjs).
 */
export default function AppLink(props) {
  return <Link prefetch={false} {...props} />;
}
