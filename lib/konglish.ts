// "콩글리시 찾기" 오케스트레이션. "오타 변환기" 옆 유틸리티 탭 — 한국식으로 굳어진 영어 표현(콩글리시)의
// 실제 영어 단어/표현을 찾아준다.
//
// 2026-08-05 재설계: LLM 혼자만의 지식보다 근거 있는 답을 원한다는 요청으로, 네이버 백과사전 검색을
// 1순위 근거로 삼는 구조로 바꿈. Gemini/Groq는 무료 한도가 금방 차서(분당/일일 요청 수 제한이 빡빡함)
// 이 기능에서는 빼고, 상대적으로 여유 있는 OpenRouter 무료 모델 로테이션만 정리(포맷팅) 용도로 쓴다.
//
// 1. 네이버 백과사전 검색 결과가 있으면 → OpenRouter가 그 내용을 근거로 정리
// 2. 백과사전 결과가 없거나 검색 자체가 실패하면 → OpenRouter가 자체 지식으로 답변
// 3. OpenRouter까지 실패하면 → (백과사전 결과가 있었다면) 검색 결과 원문을 그대로 보여주고, 없었다면 에러

import { EncycItem, searchEncyclopedia } from "./engines/naver";
import { completeWithOpenRouter } from "./engines/openrouter";
import { buildKonglishPrompt, buildKonglishPromptWithContext } from "./engines/prompt";

export interface KonglishOutcome {
  text?: string;
  error?: string;
  /** 결과 성격 표시(UI 안내용). 둘 다 실패했으면 null. */
  provider: string | null;
}

// buildKonglishPrompt/buildKonglishPromptWithContext가 요구하는 4개 필드가 실제로 채워졌는지 확인한다.
// 모델이 형식은 따랐지만 값 없이 라벨만 되풀이하는 경우를 "성공"으로 잘못 판단하지 않도록 한다.
const REQUIRED_FIELDS = ["로마자 표기", "영어 표현", "설명", "예문"];
function isCompleteAnswer(text: string): boolean {
  return REQUIRED_FIELDS.every((label) => {
    const match = text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "m"));
    return !!match && match[1].trim().length > 0;
  });
}

function formatRawEncyclopedia(items: EncycItem[]): string {
  return items.map((item, i) => `${i + 1}. ${item.title}\n${item.description}\n${item.link}`).join("\n\n");
}

export async function findRealEnglishWithFallback(word: string): Promise<KonglishOutcome> {
  const encyc = await searchEncyclopedia(word);

  if (encyc) {
    const snippets = encyc.map((item) => `${item.title}: ${item.description}`);
    const prompt = buildKonglishPromptWithContext(word, snippets);
    const or = await completeWithOpenRouter(prompt);
    if (or.text !== undefined && isCompleteAnswer(or.text)) {
      return { text: or.text, provider: "네이버 백과사전 + OpenRouter" };
    }
    console.warn("[콩글리시] OpenRouter 정리 실패/불완전, 백과사전 원문으로 대체:", or.error ?? or.text);
    return { text: formatRawEncyclopedia(encyc), provider: "네이버 백과사전 (원문)" };
  }

  const prompt = buildKonglishPrompt(word);
  const or = await completeWithOpenRouter(prompt);
  if (or.text !== undefined && isCompleteAnswer(or.text)) {
    return { text: or.text, provider: "OpenRouter (자체 지식)" };
  }
  console.warn("[콩글리시] OpenRouter 자체 지식도 실패/불완전:", or.error ?? or.text);

  return { error: "영어 표현을 찾지 못했습니다. 잠시 후 다시 시도해주세요.", provider: null };
}
