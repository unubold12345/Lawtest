import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card (Facebook/Messenger): dark card + L logo + tagline.
export default function OgImage() {
  let logo = "";
  try {
    logo = fs.readFileSync(path.join(process.cwd(), "public", "logo-dark.png")).toString("base64");
  } catch {}
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          background: "#09090b",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${logo}`} width={220} height={220} alt="" />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>Lexlab</div>
          <div style={{ fontSize: 36, color: "#d4d4d8" }}>Хуульчийн шалгалтын сорилго</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
