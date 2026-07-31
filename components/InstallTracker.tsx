"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

// PWA 설치 횟수를 Vercel Analytics 커스텀 이벤트로 기록한다.
// iOS Safari는 "appinstalled" 이벤트 자체를 지원하지 않아(홈 화면 추가를 감지할 JS API가 없음)
// iOS에서의 설치는 집계되지 않는다 — 안드로이드/데스크톱 크롬·엣지 등에서만 정확함.
export function InstallTracker() {
  useEffect(() => {
    const handleInstalled = () => track("pwa_installed");
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  return null;
}
