import type { LanguageCode, SourceLanguageCode } from "./types";

// 프론트엔드에서도 안전하게 가져다 쓸 수 있는 엔진 메타데이터(아이디/라벨)만 모아둔 파일.
// 실제 API 키를 사용하는 호출 로직은 index.ts(서버 전용)에만 있다.
export const ENGINE_CONFIG = [
  { id: "deepl", label: "DeepL" },
  { id: "mymemory", label: "MyMemory" },
  { id: "gemini", label: "Gemini" },
  { id: "groq", label: "Groq" },
  { id: "openrouter", label: "OpenRouter" },
] as const;

export type EngineId = (typeof ENGINE_CONFIG)[number]["id"];

// 언어 선택 드롭다운에서 쓸 수 있는 지원 언어 8종 (코드 + 네이티브 표기 라벨).
// 프론트엔드(드롭다운 UI)와 엔진 모듈(언어 코드 매핑) 양쪽에서 공유하는 단일 소스.
export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "vi", label: "Tiếng Việt" },
];

// 원본 언어 드롭다운 전용: "자동 감지" + 실제 지원 언어 8종.
// 번역할 언어(targetLang) 드롭다운은 항상 SUPPORTED_LANGUAGES만 쓴다 (auto 불가).
export const SOURCE_LANGUAGE_OPTIONS: { code: SourceLanguageCode; label: string }[] = [
  { code: "auto", label: "자동 감지" },
  ...SUPPORTED_LANGUAGES,
];
