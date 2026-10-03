import PostDetailClient from "./PostDetailClient";
import { getPublicPost, getNeighborPosts, summarizeHtml, firstImageUrl, SITE_URL } from "@/lib/postServer";
import { boardName } from "@/lib/boards";

/**
 * 글 상세.
 *
 * 제목·본문을 서버에서 먼저 그려서 보낸다. 예전엔 화면 전체를 브라우저에서 그려서
 * 카톡 공유 미리보기와 검색엔진이 모든 글을 「북위키 | 출판업계 정보 공유 플랫폼」으로만 봤다.
 * 댓글·조회수·관리 버튼 같은 움직이는 부분은 그대로 브라우저(PostDetailClient)가 맡는다.
 *
 * 공개 조회로 안 보이는 글(삭제된 글 등)은 서버가 비워서 넘기고, 브라우저가 로그인 세션으로
 * 다시 읽는다 — 관리자는 휴지통의 글을 이 화면에서 계속 열어 볼 수 있다.
 *
 * ⭐ 그린 HTML 은 10분 캐시한다(ISR). 요청마다 새로 그리다가 크롤러 때문에 Vercel 무료 한도
 * (Fluid Active CPU 4시간)를 다 썼다(2026-10-03). 고치기·지우기·옮기기·되살리기는
 * `lib/postCache.refreshPostCache` 로 그 글만 바로 비운다. 조회수는 브라우저가 새로 읽는다.
 * ⛔ 여기서 cookies()·headers()·searchParams 를 읽지 마라 — 읽는 순간 다시 요청마다 그린다.
 */
export const revalidate = 600;

// 빈 목록 = 빌드 때 미리 그리지 않고, 처음 열린 글부터 그려서 캐시한다
export async function generateStaticParams() {
  return [];
}
export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getPublicPost(id);
  if (!post || post.is_deleted) {
    return { title: "게시글", robots: { index: false, follow: false } };
  }

  const url = `${SITE_URL}/post/${id}`;
  const description = summarizeHtml(post.content) || `북위키 ${boardName(post.board_type)} 게시판 글`;
  const image = firstImageUrl(post);

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description,
      siteName: "북위키",
      locale: "ko_KR",
      publishedTime: post.created_at,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PostDetailPage({ params }) {
  const { id } = await params;
  const post = await getPublicPost(id);
  const visible = post && !post.is_deleted ? post : null;
  const neighbors = visible ? await getNeighborPosts(visible) : null;

  return <PostDetailClient key={id} id={id} initialPost={visible} initialNeighbors={neighbors} />;
}
