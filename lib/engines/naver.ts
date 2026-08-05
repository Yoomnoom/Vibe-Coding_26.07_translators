import { getSupabaseClient, todayInKst } from "../supabase";

// NCP(Naver Cloud Platform)의 "NAVER API HUB"에서 발급받은 키는 예전 개발자센터(openapi.naver.com)가 아니라
// 이 APIGW 도메인/경로로 호출해야 한다(호출부에서 401 "Not Exist Client ID"로 실제 확인함).
const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/encyc";
const TIMEOUT_MS = 10_000;
const API_NAME = "naver_encyc";

// 네이버 검색 오픈API 무료 한도(하루 25,000회)의 85%를 넘으면 호출을 멈추고 LLM 자체 지식 폴백으로 넘긴다.
// 과금이 발생하지 않게(무료 한도 안에서만 쓰게) 안전 마진을 두는 게 목적 — 정확히 100%까지 쓰다가
// 한도 리셋 시점 오차 등으로 실제 한도를 넘기는 상황을 피한다.
const DAILY_LIMIT = 25_000;
const SAFETY_RATIO = 0.85;

export interface EncycItem {
  title: string;
  description: string;
  link: string;
}

interface NaverEncycResponse {
  items?: { title?: string; description?: string; link?: string }[];
  errorMessage?: string;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// Supabase(무료 사용량 카운터, app/api/visit과 같은 테이블 스키마)가 없으면 한도 체크 자체를 건너뛴다 —
// 이 가드는 "과금 방지"가 목적이라 카운터를 못 쓰는 상황에서 검색을 막아버리는 것보다는
// (카운터 없이) 그냥 정상 호출하는 쪽이 기능 가용성 면에서 낫다고 판단.
async function isUnderDailyLimit(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from("api_usage_counts")
    .select("count")
    .eq("date", todayInKst())
    .eq("api_name", API_NAME)
    .maybeSingle();

  if (error) return true;
  return (data?.count ?? 0) < DAILY_LIMIT * SAFETY_RATIO;
}

async function recordUsage(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("increment_api_usage", { p_date: todayInKst(), p_api: API_NAME });
  if (error) console.warn("[네이버 백과사전] 사용량 기록 실패:", error.message);
}

/**
 * "콩글리시 찾기" 탭(PRD.md §15 참고)의 근거 자료용 네이버 백과사전 검색.
 * 실패(키 없음/네트워크 오류/API 에러/일일 한도 85% 초과)하거나 결과가 0건이면 null을 돌려줘
 * 호출부가 LLM 자체 지식 폴백으로 넘어가게 한다.
 */
export async function searchEncyclopedia(query: string): Promise<EncycItem[] | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (!(await isUnderDailyLimit())) {
    console.warn("[네이버 백과사전] 일일 사용량 85% 초과로 호출 건너뜀 (LLM 자체 지식으로 폴백)");
    return null;
  }

  try {
    const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=3&format=json`;
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await recordUsage(); // 성공/실패와 무관하게 네이버에 실제로 보낸 요청이라 한도에 반영한다.

    const data = (await res.json()) as NaverEncycResponse;
    if (!res.ok || !data.items) {
      console.warn("[네이버 백과사전]", data.errorMessage ?? `HTTP ${res.status}`);
      return null;
    }

    const items = data.items
      .filter((item) => item.title && item.description && item.description !== "_empty_")
      .map((item) => ({
        title: stripHtml(item.title!),
        description: stripHtml(item.description!),
        link: item.link ?? "",
      }));

    return items.length > 0 ? items : null;
  } catch (err) {
    console.warn("[네이버 백과사전] 요청 실패:", err instanceof Error ? err.message : err);
    return null;
  }
}
