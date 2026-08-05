import { LanguageCode, SourceLanguageCode, ToneId } from "./types";

// PRD.md §7 ⑥번 "문맥 슬라이더"에서 쓰는 톤별 프롬프트 지시문.
const TONE_INSTRUCTION: Record<ToneId, string> = {
  casual: "친한 친구 사이에 쓰는 편한 반말체로,",
  formal: "예의를 갖춘 정중한 존댓말(격식체)로,",
  business: "이메일·보고서에 쓸 법한 공식적인 비즈니스체로,",
};

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

/**
 * AI(LLM) 번역 엔진(Gemini/Groq/OpenRouter)에서 공통으로 쓰는 단순 번역 프롬프트.
 * tone이 주어지면(§7 ⑥ 문맥 슬라이더) 반말/격식체/비즈니스체 지시문을 앞에 덧붙인다 — 생략하면 기존과 동일한 프롬프트.
 */
export function buildTranslationPrompt(
  sourceLang: SourceLanguageCode,
  targetLang: LanguageCode,
  text: string,
  tone?: ToneId
) {
  const targetLabel = TARGET_LABEL_KO[targetLang] ?? targetLang;
  void sourceLang; // 모델이 자동 감지 가능하므로 프롬프트에는 굳이 명시하지 않는다.
  const firstLine = tone
    ? `다음 문장을 ${targetLabel}로, ${TONE_INSTRUCTION[tone]} 자연스럽게 번역해줘.`
    : `다음 문장을 ${targetLabel}로 자연스럽게 번역해줘.`;
  return [
    firstLine,
    `번역된 문장만 출력하고, 따옴표·설명·부연 설명 등 다른 텍스트는 절대 추가하지 마.`,
    ``,
    `문장: ${text}`,
  ].join("\n");
}

/**
 * 역번역 배치(lib/backTranslate.ts)에서 Gemini/Groq에 "N개 문장을 한 번의 호출로" 맡길 때 쓰는 프롬프트.
 * DeepL은 text 파라미터를 배열로 보내 한 번에 여러 문장을 받을 수 있지만, LLM은 그런 배치 API가 없어
 * 번호를 매긴 목록으로 물어보고 번호 기준으로 답을 파싱하는 방식으로 같은 효과(호출 1회)를 낸다.
 */
export function buildBatchTranslationPrompt(targetLang: LanguageCode, texts: string[]): string {
  const targetLabel = TARGET_LABEL_KO[targetLang] ?? targetLang;
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return [
    `아래 ${texts.length}개 문장을 각각 ${targetLabel}로 자연스럽게 번역해줘.`,
    `각 문장의 번호를 그대로 유지해서 "번호. 번역문" 형식으로만 답해줘.`,
    `설명, 원문 반복, 따옴표 등 번역문 외의 텍스트는 절대 추가하지 마. 반드시 ${texts.length}개 전부 답해줘.`,
    ``,
    numbered,
  ].join("\n");
}

/**
 * buildBatchTranslationPrompt로 만든 프롬프트의 응답("1. ...\n2. ...")을 파싱한다.
 * 번호 중 하나라도 못 찾으면(모델이 형식을 안 지켰거나 일부만 답한 경우) null을 돌려줘 호출부가
 * 다음 우선순위 엔진으로 폴백하게 한다 — 부분 결과를 억지로 짜맞추지 않는다.
 */
export function parseNumberedBatchResponse(raw: string, count: number): string[] | null {
  const map = new Map<number, string>();
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(\d+)[.).]\s*(.+)$/);
    if (m) {
      map.set(parseInt(m[1], 10), m[2].trim());
    }
  }

  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    const text = map.get(i);
    if (!text) return null;
    result.push(text);
  }
  return result;
}
