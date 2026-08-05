import { LanguageCode, SourceLanguageCode, ToneId } from "./types";

// PRD.md §7 ⑥번 "문맥 슬라이더"에서 쓰는 톤별 프롬프트 지시문.
// 2026-08-05 사용자 피드백: "비즈니스체가 너무 직역이다/어색하다" — 원인은 지시문이 "격식만 최대한 올려라"는
// 식이라 모델이 문법적으로 딱딱한 존댓말/겸양어를 기계적으로 덧씌우기만 하고, 실제 원어민이 그 상황에서
// 자연스럽게 쓸 법한 문장으로 다시 짜는 대신 원문 구조를 그대로 둔 채 격식만 얹는 경향이 있었음.
// → "지나치게 딱딱하지 않게, 실제로 그렇게 말할 법하게"라는 자연스러움 기준을 각 톤 지시문에 명시적으로 추가.
const TONE_INSTRUCTION: Record<ToneId, string> = {
  casual: "친한 친구 사이에서 실제로 편하게 대화하듯 쓰는 반말체로,",
  formal: "웃어른이나 처음 만난 사이에 쓰는 예의 바르면서도 부드러운 존댓말(격식체)로, 지나치게 딱딱하지 않게,",
  business:
    "이메일·제안서에 어울리는 정중한 비즈니스체로, 다만 문법만 격식체로 바꾼 것처럼 어색하거나 과하게 겸양하지 말고 실제 업무 상황에서 원어민이 자연스럽게 쓸 법한 문장으로,",
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
    ? `다음 문장을 ${targetLabel}로, ${TONE_INSTRUCTION[tone]} 자연스럽게 번역해줘. 단어 하나하나를 그대로 옮기는 직역 말고, 그 상황에서 원어민이 실제로 그렇게 말할 법한 자연스러운 문장으로 바꿔서 번역해줘.`
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

// "콩글리시 찾기"의 두 프롬프트(자체 지식 / 검색 근거)가 공유하는 출력 형식 지시문.
const KONGLISH_OUTPUT_FORMAT = [
  `"로마자 표기" 줄에는 해석하지 말고 입력한 한글 발음 그대로를 로마자로만 옮겨줘(예: "네이버"→"Naver", "김치"→"Kimchi") —`,
  `의미를 풀어쓰거나 다른 단어로 바꾸지 말고 발음 그대로의 표기만 적어.`,
  ``,
  `다음 형식으로 한국어로만 답해, 다른 설명이나 인사말은 절대 추가하지 마:`,
  `로마자 표기: <입력한 한글의 발음을 그대로 로마자로만 옮긴 표기>`,
  `영어 표현: <실제 영어 단어/구, 로마자 표기와 다를 때만 의미 있음>`,
  `설명: <1~2문장>`,
  `예문: <영어 예문 1개>`,
].join("\n");

/**
 * "콩글리시 찾기" 탭(오타 변환기 옆 유틸리티, PRD.md §15 참고)에서 쓰는 프롬프트.
 * 한국식으로 굳어진 영어 표현(콩글리시)의 실제 영어 단어/표현을 찾아주고, 다르다면 왜 다른지 설명한다.
 * 네이버 백과사전 검색 결과가 없을 때(혹은 검색 자체가 실패했을 때)의 폴백 — LLM 자체 지식만으로 답한다.
 */
export function buildKonglishPrompt(word: string): string {
  return [
    `다음은 한국에서 흔히 쓰는 말이야: "${word}"`,
    `이 말에 해당하는 실제 영어 단어나 표현이 뭔지 알려줘. 한국식 콩글리시(원래 영어와 다르게 굳어진 표현)라면`,
    `그 사실과 진짜 영어 표현을 명확히 알려주고, 왜 다른지 1~2문장으로 짧게 설명해줘.`,
    `이미 정확한 영어 표현이면 그냥 맞다고 하고 짧은 예문 하나만 보여줘.`,
    `고유명사(브랜드명, 인명, 지명 등)라서 번역할 대상이 아니라면 그 사실을 설명에 적어줘.`,
    ``,
    KONGLISH_OUTPUT_FORMAT,
  ].join("\n");
}

/**
 * "콩글리시 찾기"의 1순위 경로 — 네이버 백과사전 검색 결과(제목+요약)를 근거로 답을 정리하게 한다.
 * LLM 혼자만의 지식보다 근거가 있는 답을 원한다는 요청(2026-08-05)으로 buildKonglishPrompt와 분리.
 */
export function buildKonglishPromptWithContext(word: string, snippets: string[]): string {
  const context = snippets.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return [
    `다음은 한국에서 흔히 쓰는 말이야: "${word}"`,
    `아래는 이 말에 대한 네이버 백과사전 검색 결과야:`,
    ``,
    context,
    ``,
    `위 검색 결과를 근거로, 이 말에 해당하는 실제 영어 단어나 표현이 뭔지 알려줘. 한국식 콩글리시(원래 영어와`,
    `다르게 굳어진 표현)라면 그 사실과 진짜 영어 표현을 명확히 알려주고, 왜 다른지 1~2문장으로 짧게 설명해줘.`,
    `이미 정확한 영어 표현이면 그냥 맞다고 하고 짧은 예문 하나만 보여줘.`,
    `고유명사(브랜드명, 인명, 지명 등)라서 번역할 대상이 아니라면 그 사실을 설명에 적어줘.`,
    `검색 결과가 질문과 관련 없으면 무시하고 네가 아는 지식으로 답해도 돼.`,
    ``,
    KONGLISH_OUTPUT_FORMAT,
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
