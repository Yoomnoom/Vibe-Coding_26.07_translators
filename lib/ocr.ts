// 이미지 텍스트 추출(OCR, PRD.md §15 12번) 오케스트레이션.
//
// 1순위 Gemini — 이미지 인식 정확도가 가장 좋음(실측: 신조어 "adorkable"도 정확히 추출).
// 2순위 OpenRouter — Gemini가 실패(한도초과 등)했을 때만 호출. 번역용 FREE_MODELS와 겹치지 않는
// 별도 무료 비전 모델 로테이션(lib/engines/openrouter.ts의 OCR_FREE_MODELS)을 써서, 번역 기능과
// 무료 사용량을 나눠 쓰지 않게 분리했다.

import { extractTextFromImage } from "./engines/gemini";
import { extractTextWithOpenRouter } from "./engines/openrouter";

export interface OcrOutcome {
  text?: string;
  error?: string;
  /** 실제로 추출을 수행한 엔진("Gemini"/"OpenRouter"). 둘 다 실패했으면 null. */
  provider: string | null;
}

export async function extractTextFromImageWithFallback(imageBase64: string, mimeType: string): Promise<OcrOutcome> {
  const gemini = await extractTextFromImage(imageBase64, mimeType);
  if (gemini.text !== undefined) {
    return { text: gemini.text, provider: "Gemini" };
  }
  console.warn("[OCR] Gemini 실패, OpenRouter로 폴백:", gemini.error);

  const openrouter = await extractTextWithOpenRouter(imageBase64, mimeType);
  if (openrouter.text !== undefined) {
    return { text: openrouter.text, provider: `OpenRouter (Gemini 실패, ${openrouter.model})` };
  }
  console.warn("[OCR] OpenRouter도 실패:", openrouter.error);

  return { error: "이미지에서 텍스트를 추출하지 못했습니다. (Gemini·OpenRouter 모두 실패)", provider: null };
}
