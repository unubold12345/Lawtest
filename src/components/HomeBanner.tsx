"use client";

import Image from "next/image";
import { useState } from "react";

const BANNERS = [
  {
    src: "/home-banner-2026.webp",
    alt: "Lexlab — 2026 оны Хуульчийн мэргэжлийн шалгалтын сорилго",
  },
  {
    src: "/home-banner-2026-alt.webp",
    alt: "Lexlab — 2026 оны Хуульчийн мэргэжлийн шалгалтын сорилго (хувилбар 2)",
  },
];

const SIZES = "(min-width: 1152px) 1104px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 1rem)";

export default function HomeBanner() {
  const [index, setIndex] = useState(0);

  const go = (next: number) => setIndex((next + BANNERS.length) % BANNERS.length);

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl">
      <div className="relative aspect-[2056/439] w-full">
        {BANNERS.map((b, i) => (
          <Image
            key={b.src}
            src={b.src}
            alt={b.alt}
            width={2056}
            height={439}
            preload={i === 0}
            sizes={SIZES}
            className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${i === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Өмнөх баннер"
        className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 sm:left-3"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Дараах баннер"
        className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 sm:right-3"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2">
        {BANNERS.map((b, i) => (
          <button
            key={b.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Баннер ${i + 1}`}
            className="group flex h-9 w-6 items-center justify-center"
          >
            <span
              className={`h-2 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-2 bg-white/40 group-hover:bg-white/60"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
