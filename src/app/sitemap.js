import { getSitemapPosts, SITE_URL } from "@/lib/postServer";

/**
 * sitemap.xml — 글 전부를 태운다.
 *
 * 전엔 `public/sitemap.xml` 정적 파일이었다. 주소 6개에 lastmod 는 2026-04-09 고정이고,
 * 정작 서버렌더 + canonical 이 제대로 박힌 **글 상세가 한 건도 없었다**. 없는 경로(`/post`)를
 * 올려놔서 구글이 404 를 긁고 있었고, `<loc>` 는 www 없는 주소인데 robots.txt 는 www 를 가리켰다.
 *
 * 관리자·글쓰기·로그인·render-slide 는 여기 넣지 않는다(robots.txt 에서도 막는다).
 * 게시판 목록(`/?board=job`)도 넣지 않는다 — 서버 HTML 이 홈과 같아서 정본을 홈으로 합쳤다.
 */
export const revalidate = 3600;

const STATIC_PAGES = [
  { path: "", changeFrequency: "daily", priority: 1.0 }, // 홈 — canonical 과 같은 꼴(끝 슬래시 없음)
  { path: "/bestseller", changeFrequency: "daily", priority: 0.8 },
  { path: "/ai", changeFrequency: "daily", priority: 0.7 },
  { path: "/calendar", changeFrequency: "weekly", priority: 0.6 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
];

export default async function sitemap() {
  const posts = await getSitemapPosts();
  // 홈의 lastmod 는 가장 최근 글 시각 — 목록이 그때 바뀐다
  const newest = posts[0]?.created_at ? new Date(posts[0].created_at) : new Date();

  return [
    ...STATIC_PAGES.map(({ path, changeFrequency, priority }) => ({
      url: `${SITE_URL}${path}`,
      lastModified: path === "" ? newest : new Date(),
      changeFrequency,
      priority,
    })),
    ...posts.map((post) => ({
      url: `${SITE_URL}/post/${post.id}`,
      lastModified: new Date(post.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
  ];
}
