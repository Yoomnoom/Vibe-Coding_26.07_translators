import { EngineResult, LanguageCode, SourceLanguageCode, TranslateParams } from "./types";
import { describeCatchError, describeHttpError } from "./errors";

// DeepL 공식 지원 언어 코드 매핑. 베트남어(vi)는 DeepL이 지원하지 않아 의도적으로 뺐다.
// (source_lang은 지역 변형이 없지만, target_lang의 EN은 EN-US/EN-GB 중 하나를 명시해야 한다.)
const DEEPL_SOURCE_LANG: Partial<Record<SourceLanguageCode, string>> = {
  ko: "KO",
  en: "EN",
  ja: "JA",
  zh: "ZH",
  es: "ES",
  fr: "FR",
  de: "DE",
};

const DEEPL_TARGET_LANG: Partial<Record<LanguageCode, string>> = {
  ko: "KO",
  en: "EN-US",
  ja: "JA",
  zh: "ZH",
  es: "ES",
  fr: "FR",
  de: "DE",
};

const TIMEOUT_MS = 15_000;

// DEEPL_API_KEY가 ":fx"로 끝나는 무료 플랜 키이므로 무료 엔드포인트를 사용한다.
const DEEPL_ENDPOINT = "https://api-free.deepl.com/v2/translate";

export async function translateWithDeepl({ text, sourceLang, targetLang }: TranslateParams): Promise<EngineResult> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return { error: "DEEPL_API_KEY가 설정되지 않았습니다." };
  }

  // sourceLang이 "auto"면 source_lang 파라미터 자체를 보내지 않는다 — DeepL이 네이티브로 자동 감지한다.
  const isAutoDetect = sourceLang === "auto";
  const source = isAutoDetect ? undefined : DEEPL_SOURCE_LANG[sourceLang];
  const target = DEEPL_TARGET_LANG[targetLang];
  if ((!isAutoDetect && !source) || !target) {
    return { error: "DeepL은 이 언어 쌍을 지원하지 않습니다. (예: 베트남어는 DeepL 미지원 언어입니다)" };
  }

  const params = new URLSearchParams({ text, target_lang: target });
  if (source) params.set("source_lang", source);

  try {
    const res = await fetch(DEEPL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: describeHttpError(res.status, "DeepL", body) };
    }

    const data = (await res.json()) as {
      translations?: { text: string }[];
    };
    const translated = data.translations?.[0]?.text;
    if (!translated) {
      return { error: "DeepL 응답에 번역 결과가 없습니다." };
    }
    return { text: translated };
  } catch (err) {
    return { error: describeCatchError(err, "DeepL") };
  }
}
