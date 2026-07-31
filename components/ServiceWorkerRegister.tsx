"use client";

import { useEffect } from "react";

// PWA 서비스 워커 등록. 렌더링에 영향 없는 부수효과라 별도 클라이언트 컴포넌트로 분리해
// 나머지 레이아웃은 서버 컴포넌트로 유지한다.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("서비스 워커 등록 실패:", err);
      });
    }
  }, []);

  return null;
}
