// "콩글리시 찾기" 오케스트레이션. "오타 변환기" 옆 유틸리티 탭 — 한국식으로 굳어진 영어 표현(콩글리시)의
// 실제 영어 단어/표현을 찾아준다.
//
// 2026-08-06 최종 구조 — 검색 결과를 그대로 나열하는 방식은 "아주 잘못된 형태"라는 피드백으로 폐기하고,
// 항상 로마자 표기/영어 표현/설명/예문 형식으로 정리된 답을 보여주는 쪽으로 확정함:
// 1. 네이버 백과사전 검색 → 결과 있으면 근거로 삼음
// 2. 백과사전에 없으면 네이버 블로그 검색 → 결과 있으면 근거로 삼음
// 3. (근거가 있든 없든) OpenRouter 무료 모델이 항상 같은 형식으로 정리해서 답변
// 4. OpenRouter까지 실패하면 에러(형식이 깨진 결과를 보여주는 것보다 낫다고 판단)

import { NaverSearchItem, searchBlog, searchEncyclopedia } from "./engines/naver";
import { completeWithOpenRouter } from "./engines/openrouter";
import { buildKonglishPrompt, buildKonglishPromptWithContext } from "./engines/prompt";

export interface KonglishOutcome {
  text?: string;
  error?: string;
  /** 결과 성격 표시(UI 안내용). 둘 다 실패했으면 null. */
  provider: string | null;
  /** 근거로 쓴 네이버 검색 결과 중 1번 항목의 링크("백과사전 바로가기"용). 근거가 없었으면 undefined. */
  sourceLink?: string;
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

async function findGroundingResults(word: string): Promise<{ items: NaverSearchItem[]; provider: string } | null> {
  const encyc = await searchEncyclopedia(word);
  if (encyc) return { items: encyc, provider: "네이버 백과사전" };

  const blog = await searchBlog(word);
  if (blog) return { items: blog, provider: "네이버 블로그" };

  return null;
}

export async function findRealEnglishWithFallback(word: string): Promise<KonglishOutcome> {
  const grounding = await findGroundingResults(word);

  if (grounding) {
    const snippets = grounding.items.map((item) => `${item.title}: ${item.description}`);
    const prompt = buildKonglishPromptWithContext(word, snippets);
    const or = await completeWithOpenRouter(prompt);
    if (or.text !== undefined && isCompleteAnswer(or.text)) {
      return { text: or.text, provider: `${grounding.provider} + OpenRouter`, sourceLink: grounding.items[0].link };
    }
    console.warn("[콩글리시] OpenRouter 정리 실패/불완전:", or.error ?? or.text);
  }

  const prompt = buildKonglishPrompt(word);
  const or = await completeWithOpenRouter(prompt);
  if (or.text !== undefined && isCompleteAnswer(or.text)) {
    return { text: or.text, provider: "OpenRouter (자체 지식)" };
  }
  console.warn("[콩글리시] OpenRouter 자체 지식도 실패/불완전:", or.error ?? or.text);

  return { error: "영어 표현을 찾지 못했습니다. 잠시 후 다시 시도해주세요.", provider: null };
}
