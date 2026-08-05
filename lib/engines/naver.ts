// NCP(Naver Cloud Platform)의 "NAVER API HUB"에서 발급받은 키는 예전 개발자센터(openapi.naver.com)가 아니라
// 이 APIGW 도메인/경로로 호출해야 한다(호출부에서 401 "Not Exist Client ID"로 실제 확인함).
const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/encyc";
const TIMEOUT_MS = 10_000;

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

/**
 * "콩글리시 찾기" 탭(PRD.md §15 참고)의 근거 자료용 네이버 백과사전 검색.
 * 실패(키 없음/네트워크 오류/API 에러)하거나 결과가 0건이면 null을 돌려줘 호출부가
 * LLM 자체 지식 폴백으로 넘어가게 한다.
 */
export async function searchEncyclopedia(query: string): Promise<EncycItem[] | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=3&format=json`;
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

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
