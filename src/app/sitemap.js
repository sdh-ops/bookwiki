export default function sitemap() {
  const baseUrl = "https://bookwiki.co.kr";
  
  // Define main routes
  const routes = [
    "",
    "/bestseller",
    "/post",
    "/calendar",
    "/terms",
    "/privacy",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.8,
  }));

  return routes;
}
