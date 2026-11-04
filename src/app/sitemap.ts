import type { MetadataRoute } from "next";

const BASE = "https://lexlab.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/exams`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/plans`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/exams/lawyer/2026`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/exams/lawyer/2026/browse`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/exams/lawyer/2026/browse/unanswered`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/exams/lawyer/2026/v2`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/exams/lawyer/2026/calendar`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/plans/lawyer-2026-full`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
