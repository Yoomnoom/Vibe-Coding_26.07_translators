// "콩글리시 찾기" 오케스트레이션. "오타 변환기" 옆 유틸리티 탭 — 한국식으로 굳어진 영어 표현(콩글리시)의
// 실제 영어 단어/표현을 찾아준다. 1순위 Gemini, 실패 시(한도초과 등) 2순위 Groq로 폴백한다.

import { findRealEnglish } from "./engines/gemini";
import { findRealEnglishWithGroq } from "./engines/groq";

export interface KonglishOutcome {
  text?: string;
  error?: string;
  /** 실제로 조회를 수행한 엔진("Gemini"/"Groq"). 둘 다 실패했으면 null. */
  provider: string | null;
}

export async function findRealEnglishWithFallback(word: string): Promise<KonglishOutcome> {
  const gemini = await findRealEnglish(word);
  if (gemini.text !== undefined) {
    return { text: gemini.text, provider: "Gemini" };
  }
  console.warn("[콩글리시] Gemini 실패, Groq로 폴백:", gemini.error);

  const groq = await findRealEnglishWithGroq(word);
  if (groq.text !== undefined) {
    return { text: groq.text, provider: "Groq (Gemini 실패)" };
  }
  console.warn("[콩글리시] Groq도 실패:", groq.error);

  return { error: "영어 표현을 찾지 못했습니다. (Gemini·Groq 모두 실패)", provider: null };
}
