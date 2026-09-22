import Image from "next/image";

const SIZES = "(min-width: 1152px) 1104px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 1rem)";

export default function HomeBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl">
      <Image
        src="/home-banner-2026.webp"
        alt="Lexlab — 2026 оны Хуульчийн мэргэжлийн шалгалтын сорилго"
        width={2056}
        height={439}
        preload
        sizes={SIZES}
        className="h-auto w-full"
      />
    </div>
  );
}
