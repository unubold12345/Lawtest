import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lexlab — Хуульчийн мэргэжлийн шалгалтын сорилго",
    short_name: "Lexlab",
    description: "Хуульчийн мэргэжлийн шалгалтын сорилго — үндсэн ангилал, дэд ангилал, шалгалт ба сургалт.",
    start_url: "/",
    display: "standalone",
    background_color: "#07070c",
    theme_color: "#07070c",
    lang: "mn",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
