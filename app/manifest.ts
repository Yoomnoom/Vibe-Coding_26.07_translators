import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "번역 비교 앱",
    short_name: "번역비교",
    description: "여러 번역 API 결과를 비교하고 노션에 기록하는 개인용 도구",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf6",
    theme_color: "#2b48d9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
