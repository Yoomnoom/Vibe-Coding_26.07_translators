import { EngineResult, LanguageCode, SourceLanguageCode, TranslateParams } from "./types";
import { describeCatchError, describeHttpError } from "./errors";

// MyMemory는 500자를 넘으면 사실상 항상 실패하고(414 등), 실패 시 raw HTML 오류 페이지를 반환하는 경우가 많다.
// 실측: 1000자 이상 입력 시 "MyMemory API 오류 (414): <!DOCTYPE HTML...>" 형태로 원문 HTML이 그대로 노출됨.
const MAX_LENGTH = 500;
const TIMEOUT_MS = 15_000;

// MyMemory가 기대하는 언어 코드. 대부분 ISO 639-1과 동일하지만 중국어는 zh-CN을 사용한다.
// "auto"는 MyMemory의 langpair 자동 감지 키워드인 "autodetect"로 매핑한다 (실제 호출로 동작 확인함).
const MYMEMORY_LANG: Record<SourceLanguageCode, string> = {
  auto: "autodetect",
  ko: "ko",
  en: "en",
  ja: "ja",
  zh: "zh-CN",
  es: "es",
  fr: "fr",
  de: "de",
  vi: "vi",
};

interface MyMemoryResponse {
  responseStatus: number | string;
  responseData?: { translatedText?: string; detectedLanguage?: string };
  responseDetails?: string;
}

// MYMEMORY_LANG의 역방향 매핑("zh-CN" -> "zh" 등). "auto"는 감지 결과로 나올 수 없으니 제외.
const MYMEMORY_LANG_REVERSE: Record<string, LanguageCode> = Object.fromEntries(
  Object.entries(MYMEMORY_LANG)
    .filter(([code]) => code !== "auto")
    .map(([code, myMemoryCode]) => [myMemoryCode.toLowerCase(), code as LanguageCode])
);

/**
 * 실제 번역 없이 언어만 가볍게 감지한다. sourceLang="auto"일 때 5개 엔진을 전부 두 번 호출하지 않도록,
 * MyMemory 무료 API(langpair=autodetect|ko)만 한 번 호출해 detectedLanguage만 뽑아 쓴다.
 * 감지 실패나 지원하지 않는 언어면 null을 반환하고, 호출부는 이를 조용히 무시하면 된다.
 */
export async function detectLanguageViaMyMemory(text: string): Promise<LanguageCode | null> {
  const sample = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text;
  // 감지 대상 target은 반드시 우리가 지원하는 8개 언어(source가 될 수 있는 언어) 밖의 값이어야 한다.
  // target을 예컨대 "ko"로 고정하면, 실제로 감지된 언어도 ko일 때 "PLEASE SELECT TWO DISTINCT LANGUAGES"(403)로
  // 실패하는 걸 실측으로 확인함 — "it"(이탈리아어)은 8개 지원 언어에 없어 이 충돌이 구조적으로 발생하지 않는다.
  const params = new URLSearchParams({ q: sample, langpair: "autodetect|it" });

  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("application/json")) return null;

    const data = (await res.json()) as MyMemoryResponse;
    const detected = data.responseData?.detectedLanguage?.toLowerCase();
    if (!detected) return null;
    return MYMEMORY_LANG_REVERSE[detected] ?? null;
  } catch {
    return null;
  }
}

export async function translateWithMyMemory({ text, sourceLang, targetLang }: TranslateParams): Promise<EngineResult> {
  if (text.length > MAX_LENGTH) {
    return { error: `MyMemory는 ${MAX_LENGTH}자 이하 문장만 지원합니다. (입력 ${text.length}자)` };
  }

  const source = MYMEMORY_LANG[sourceLang];
  const target = MYMEMORY_LANG[targetLang];

  const params = new URLSearchParams({
    q: text,
    langpair: `${source}|${target}`,
    // de: "example@example.com", // 이메일 파라미터를 추가하면 일일 한도가 5,000자 -> 50,000자로 증가함
  });

  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    // 500자 이하인데도 서버가 에러 페이지(HTML)를 반환하는 경우를 방어: JSON이 아니면 원문을 노출하지 않는다.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { error: "MyMemory 서버가 올바르지 않은 응답을 반환했습니다 (문장 길이나 일일 한도를 확인해주세요)." };
    }

    if (!res.ok) {
      return { error: describeHttpError(res.status, "MyMemory") };
    }

    const data = (await res.json()) as MyMemoryResponse;
    const status = Number(data.responseStatus);
    const translated = data.responseData?.translatedText;

    if (status !== 200 || !translated) {
      const detail = data.responseDetails ?? "";
      if (detail) console.error("[MyMemory] 응답 오류:", detail);
      if (/limit|quota/i.test(detail)) {
        return { error: "MyMemory 무료 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요." };
      }
      return { error: "MyMemory에서 번역 결과를 받아오지 못했습니다." };
    }

    return { text: translated };
  } catch (err) {
    return { error: describeCatchError(err, "MyMemory") };
  }
}
