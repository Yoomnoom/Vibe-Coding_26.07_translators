import { EngineResult, LanguageCode, TranslateParams } from "./types";
import { describeCatchError, describeHttpError } from "./errors";

// MyMemory는 500자를 넘으면 사실상 항상 실패하고(414 등), 실패 시 raw HTML 오류 페이지를 반환하는 경우가 많다.
// 실측: 1000자 이상 입력 시 "MyMemory API 오류 (414): <!DOCTYPE HTML...>" 형태로 원문 HTML이 그대로 노출됨.
const MAX_LENGTH = 500;
const TIMEOUT_MS = 15_000;

// MyMemory가 기대하는 언어 코드. 대부분 ISO 639-1과 동일하지만 중국어는 zh-CN을 사용한다.
const MYMEMORY_LANG: Record<LanguageCode, string> = {
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
  responseData?: { translatedText?: string };
  responseDetails?: string;
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
