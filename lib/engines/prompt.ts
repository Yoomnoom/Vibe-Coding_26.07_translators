import { LanguageCode, SourceLanguageCode } from "./types";

// LLM 프롬프트에 자연스러운 한국어 문장으로 넣기 위한 대상 언어 표시명.
// (SUPPORTED_LANGUAGES의 라벨은 드롭다운 UI용 네이티브 표기라 프롬프트 문장에는 어색해서 별도로 둔다.)
const TARGET_LABEL_KO: Record<LanguageCode, string> = {
  ko: "한국어",
  en: "영어",
  ja: "일본어",
  zh: "중국어",
  es: "스페인어",
  fr: "프랑스어",
  de: "독일어",
  vi: "베트남어",
};

/** AI(LLM) 번역 엔진(Gemini/Groq/OpenRouter)에서 공통으로 쓰는 단순 번역 프롬프트 */
export function buildTranslationPrompt(sourceLang: SourceLanguageCode, targetLang: LanguageCode, text: string) {
  const targetLabel = TARGET_LABEL_KO[targetLang] ?? targetLang;
  void sourceLang; // 모델이 자동 감지 가능하므로 프롬프트에는 굳이 명시하지 않는다.
  return [
    `다음 문장을 ${targetLabel}로 자연스럽게 번역해줘.`,
    `번역된 문장만 출력하고, 따옴표·설명·부연 설명 등 다른 텍스트는 절대 추가하지 마.`,
    ``,
    `문장: ${text}`,
  ].join("\n");
}
