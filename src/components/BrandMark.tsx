import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

// Transparent L logos: black mark in light mode, white mark in dark mode.
export default function BrandMark({ size = 24, className = "" }: BrandMarkProps) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`relative block shrink-0 ${className}`}
    >
      <Image
        src="/logo-light.png"
        alt="Lexlab"
        width={size}
        height={size}
        className="h-full w-full dark:hidden"
      />
      <Image
        src="/logo-dark.png"
        alt="Lexlab"
        width={size}
        height={size}
        className="hidden h-full w-full dark:block"
      />
    </span>
  );
}
