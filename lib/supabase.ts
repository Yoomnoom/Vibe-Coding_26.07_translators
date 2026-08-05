import { createClient } from "@supabase/supabase-js";

// 방문자 수 카운터(app/api/visit)와 API 사용량 가드(lib/engines/naver.ts)가 공유하는
// Supabase 클라이언트 생성 로직. 서버 전용(SUPABASE_SERVICE_ROLE_KEY) — 클라이언트에 노출하지 않는다.
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function todayInKst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
