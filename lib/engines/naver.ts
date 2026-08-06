import { getSupabaseClient, todayInKst } from "../supabase";

// NCP(Naver Cloud Platform)의 "NAVER API HUB"에서 발급받은 키는 예전 개발자센터(openapi.naver.com)가 아니라
// 이 APIGW 도메인/경로로 호출해야 한다(호출부에서 401 "Not Exist Client ID"로 실제 확인함).
const BASE_URL = "https://naverapihub.apigw.ntruss.com/search/v1";
const TIMEOUT_MS = 10_000;

// 네이버 검색 오픈API 무료 한도(API 종류별 하루 25,000회)의 85%를 넘으면 그 검색을 건너뛴다.
// 과금이 발생하지 않게(무료 한도 안에서만 쓰게) 안전 마진을 두는 게 목적.
const DAILY_LIMIT = 25_000;
const SAFETY_RATIO = 0.85;

export interface NaverSearchItem {
  title: string;
  description: string;
  link: string;
}

interface NaverSearchResponse {
  items?: { title?: string; description?: string; link?: string }[];
  errorMessage?: string;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// Supabase(무료 사용량 카운터, app/api/visit과 같은 테이블 스키마)가 없으면 한도 체크 자체를 건너뛴다 —
// 이 가드는 "과금 방지"가 목적이라 카운터를 못 쓰는 상황에서 검색을 막아버리는 것보다는
// (카운터 없이) 그냥 정상 호출하는 쪽이 기능 가용성 면에서 낫다고 판단.
async function isUnderDailyLimit(apiName: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from("api_usage_counts")
    .select("count")
    .eq("date", todayInKst())
    .eq("api_name", apiName)
    .maybeSingle();

  if (error) return true;
  return (data?.count ?? 0) < DAILY_LIMIT * SAFETY_RATIO;
}

async function recordUsage(apiName: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("increment_api_usage", { p_date: todayInKst(), p_api: apiName });
  if (error) console.warn(`[네이버 검색:${apiName}] 사용량 기록 실패:`, error.message);
}

/**
 * 네이버 검색 오픈API(백과사전/블로그 등) 공통 호출. 실패(키 없음/네트워크 오류/API 에러/일일 한도
 * 85% 초과)하거나 결과가 0건이면 null을 돌려줘 호출부가 다음 우선순위(다른 검색 종류)로 넘어가게 한다.
 */
async function search(path: string, apiName: string, query: string): Promise<NaverSearchItem[] | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (!(await isUnderDailyLimit(apiName))) {
    console.warn(`[네이버 검색:${apiName}] 일일 사용량 85% 초과로 호출 건너뜀`);
    return null;
  }

  try {
    const url = `${BASE_URL}/${path}?query=${encodeURIComponent(query)}&display=3&format=json`;
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await recordUsage(apiName); // 성공/실패와 무관하게 네이버에 실제로 보낸 요청이라 한도에 반영한다.

    const data = (await res.json()) as NaverSearchResponse;
    if (!res.ok || !data.items) {
      console.warn(`[네이버 검색:${apiName}]`, data.errorMessage ?? `HTTP ${res.status}`);
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
    console.warn(`[네이버 검색:${apiName}] 요청 실패:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** "콩글리시 찾기" 탭의 1순위 근거 자료 — 백과사전(사전/백과 출처라 정의가 더 정확함). */
export function searchEncyclopedia(query: string): Promise<NaverSearchItem[] | null> {
  return search("encyc", "naver_encyc", query);
}

/**
 * 백과사전에 결과가 없을 때(콜로퀄/속어 등 백과사전엔 잘 안 올라오는 표현) 쓰는 2순위 폴백.
 * 블로그는 "콩글리시" 관련 글이 많아 백과사전보다 커버리지가 넓다.
 */
export function searchBlog(query: string): Promise<NaverSearchItem[] | null> {
  return search("blog", "naver_blog", query);
}
