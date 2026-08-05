// 번역 엔진 공통 타입 정의 (PRD.md §6.2 공통 인터페이스)

// 지원 언어 8종의 코드. 표시용 메타데이터(네이티브 표기 라벨)는 ./config의 SUPPORTED_LANGUAGES 참고.
export type LanguageCode = "ko" | "en" | "ja" | "zh" | "es" | "fr" | "de" | "vi";

// 원본 언어만 "자동 감지"를 고를 수 있다 (번역할 언어는 항상 명시적으로 골라야 함).
export type SourceLanguageCode = LanguageCode | "auto";

// PRD.md §7 ⑥번 "문맥 슬라이더" — 반말/격식체/비즈니스체 톤. LLM 엔진(Gemini/Groq/OpenRouter)에서만
// 프롬프트로 표현 가능해 tone은 optional로 두고, DeepL/MyMemory는 이 필드를 그냥 무시한다.
export type ToneId = "casual" | "formal" | "business";

export interface TranslateParams {
  text: string;
  sourceLang: SourceLanguageCode;
  targetLang: LanguageCode;
  tone?: ToneId;
}

export interface EngineResult {
  /** 실제로 호출된 모델/엔진 이름. OpenRouter처럼 내부 로테이션이 있는 경우 실제 응답한 모델명이 담긴다. */
  model?: string;
  text?: string;
  error?: string;
}

export interface EngineDefinition {
  id: string;
  label: string;
  translate: (params: TranslateParams) => Promise<EngineResult>;
}

// 역번역 배치 호출(lib/backTranslate.ts)에서 쓰는 결과 타입. 여러 문장을 한 번의 호출로 번역하고
// 순서를 그대로 유지한 texts 배열을 돌려주거나, 실패 시 error만 채운다 (부분 성공은 지원하지 않음 —
// 배치 호출 자체가 실패하면 다음 우선순위 엔진으로 폴백하는 게 목적이라 전부/전무로 충분함).
export interface BatchEngineResult {
  texts?: string[];
  error?: string;
}
