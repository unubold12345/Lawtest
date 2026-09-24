import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/set-password", "/history"],
      },
    ],
    sitemap: "https://lexlab.site/sitemap.xml",
  };
}
