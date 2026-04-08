export default function robots() {
  const baseUrl = "https://bookwiki.co.kr";
  
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/mypage",
          "/write",
          "/reset-password",
          "/login",
        ],
      },
      {
        userAgent: "Yeti",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/mypage",
          "/write",
          "/reset-password",
          "/login",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
