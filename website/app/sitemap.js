// Static sitemap fed to robots.txt + crawlers. Update on every public route
// addition. Legal pages are explicitly listed so search engines discover
// them (Apple / Google store review also fetches the URLs we declare, but
// they don't need to be indexed).
const SITE = "https://vtulogistics.com";

export default function sitemap() {
  const now = new Date();
  return [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
