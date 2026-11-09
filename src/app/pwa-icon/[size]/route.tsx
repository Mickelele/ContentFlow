import { ImageResponse } from "next/og";

// Ikona aplikacji (PWA, ekran główny telefonu) rysowana z tego samego znaku co logo w interfejsie.
// /pwa-icon/192, /pwa-icon/512, /pwa-icon/maskable-512 (z marginesem bezpieczeństwa dla Androida).
const SIZES: Record<string, { size: number; inset: number }> = {
  "180": { size: 180, inset: 0 },
  "192": { size: 192, inset: 0 },
  "512": { size: 512, inset: 0 },
  "maskable-512": { size: 512, inset: 0.12 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size: key } = await params;
  const spec = SIZES[key] ?? SIZES["192"];
  const s = spec.size;
  const pad = Math.round(s * spec.inset);
  const mark = s - pad * 2;
  const bar = (w: number, top: number, opacity = 1) => (
    <div
      style={{
        position: "absolute",
        left: mark * 0.22,
        top: mark * top,
        width: mark * w,
        height: mark * 0.13,
        borderRadius: mark * 0.065,
        background: "#fbfaf8",
        opacity,
      }}
    />
  );

  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1917" }}>
        <div style={{ position: "relative", width: mark, height: mark, display: "flex" }}>
          {bar(0.34, 0.27)}
          {bar(0.56, 0.48, 0.7)}
          {bar(0.24, 0.69, 0.45)}
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
