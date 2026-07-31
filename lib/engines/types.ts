// 번역 엔진 공통 타입 정의 (PRD.md §6.2 공통 인터페이스)

// 지원 언어 8종의 코드. 표시용 메타데이터(네이티브 표기 라벨)는 ./config의 SUPPORTED_LANGUAGES 참고.
export type LanguageCode = "ko" | "en" | "ja" | "zh" | "es" | "fr" | "de" | "vi";

export interface TranslateParams {
  text: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
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
