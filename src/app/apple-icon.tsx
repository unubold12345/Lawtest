import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon (iOS): solid dark tile + L logo.
export default function AppleIcon() {
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
          background: "#09090b",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${logo}`} width={140} height={140} alt="" />
        ) : (
          <div style={{ fontSize: 72, fontWeight: 800 }}>L</div>
        )}
      </div>
    ),
    { ...size }
  );
}
