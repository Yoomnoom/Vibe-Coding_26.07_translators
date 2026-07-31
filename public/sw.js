// 최소 서비스 워커: 앱 셸(/)만 오프라인 폴백용으로 캐시하고, 번역/OCR/노션 등
// API 요청과 정적 자원은 그대로 네트워크로 흘려보낸다 (결과가 실시간 API 응답이라
// 캐싱하면 오래된 값을 보여줄 위험이 큼 — PRD.md "앱의 진짜 목적" 참고).
const SHELL_CACHE = "shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add("/")));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/").then((res) => res ?? Response.error()))
  );
});
