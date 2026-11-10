import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { DEFAULT_ACCENT, DEFAULT_STYLE, appearanceScript } from "@/lib/appearance";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

// Nagłówki w stylu plannera (szeryf z kursywą), zob. D-36.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "ContentFlow", template: "%s · ContentFlow" },
  description: "Kalendarz i planer pracy dla twórców i marketingowców.",
  applicationName: "ContentFlow",
  icons: { apple: "/pwa-icon/180" },
  // Po dodaniu do ekranu głównego iPhone'a aplikacja otwiera się bez paska Safari.
  appleWebApp: { capable: true, title: "ContentFlow", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
};

// Motyw, wariant i akcent ustawiamy przed pierwszym malowaniem, żeby nic nie mignęło.

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${geist.variable} ${fraunces.variable} h-full antialiased`}
      data-style={DEFAULT_STYLE}
      data-accent={DEFAULT_ACCENT}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
