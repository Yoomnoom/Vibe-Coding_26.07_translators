import { BatchEngineResult, EngineResult, LanguageCode, SourceLanguageCode, TranslateParams } from "./types";
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

/**
 * 역번역 배치(lib/backTranslate.ts §역번역 체크, PRD.md §7 ②번)에서 쓰는 배치 번역.
 * DeepL API는 `text` 파라미터를 여러 번 넣으면(URLSearchParams.append) 한 번의 요청으로
 * 여러 문장을 번역해 입력 순서 그대로 translations 배열을 돌려준다 — 엔진마다 개별 호출하는 대신
 * 이 한 번의 호출로 최대 5개 문장을 동시에 처리해 API 호출 수를 아낀다.
 * sourceLang/targetLang은 항상 구체적인 언어(자동 감지 아님)만 받는다 — 역번역은 "지금 번역문이
 * 쓰인 언어 → 되돌릴 원래 언어" 방향이 이미 확정된 상태에서 호출되기 때문.
 */
export async function translateBatchWithDeepl(
  texts: string[],
  sourceLang: LanguageCode,
  targetLang: LanguageCode
): Promise<BatchEngineResult> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return { error: "DEEPL_API_KEY가 설정되지 않았습니다." };
  }

  const source = DEEPL_SOURCE_LANG[sourceLang];
  const target = DEEPL_TARGET_LANG[targetLang];
  if (!source || !target) {
    return { error: "DeepL은 이 언어 쌍을 지원하지 않습니다. (예: 베트남어는 DeepL 미지원 언어입니다)" };
  }

  const params = new URLSearchParams();
  params.set("source_lang", source);
  params.set("target_lang", target);
  for (const text of texts) params.append("text", text);

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

    const data = (await res.json()) as { translations?: { text: string }[] };
    const translations = data.translations;
    if (!translations || translations.length !== texts.length) {
      return { error: "DeepL 배치 응답 개수가 요청과 일치하지 않습니다." };
    }
    return { texts: translations.map((t) => t.text) };
  } catch (err) {
    return { error: describeCatchError(err, "DeepL") };
  }
}
