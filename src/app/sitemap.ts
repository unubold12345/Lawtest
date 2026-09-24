import type { MetadataRoute } from "next";

const BASE = "https://lexlab.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/browse`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/browse/unanswered`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/calendar`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/plan`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
