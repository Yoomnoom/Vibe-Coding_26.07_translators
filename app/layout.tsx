import type { Metadata, Viewport } from "next";
import { Do_Hyeon, IBM_Plex_Mono, Noto_Serif_KR } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallTracker } from "@/components/InstallTracker";
import "./globals.css";

// makingsoftware.com 참조 톤: 픽셀풍 굵은 타이틀(Do Hyeon) + 본문 세리프(Noto Serif KR) + 주석용 모노스페이스(IBM Plex Mono)
const doHyeon = Do_Hyeon({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const notoSerifKr = Noto_Serif_KR({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "번역기들",
  description: "여러 번역 API 결과를 비교하고 노션에 기록하는 개인용 도구",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "번역기들",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b48d9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${doHyeon.variable} ${notoSerifKr.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <InstallTracker />
        <Analytics />
      </body>
    </html>
  );
}
