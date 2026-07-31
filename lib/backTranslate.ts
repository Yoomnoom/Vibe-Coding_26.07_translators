// 역번역 체크(PRD.md §7 ②번) 오케스트레이션 로직.
//
// 설계 목적: 엔진마다 각자 자기 결과를 개별로 역번역하면 최대 5번(선택된 엔진 수만큼) API를 호출하게 된다.
// 대신 번역 결과 전체를 한 번에 "역번역 담당 엔진" 1곳에 몰아서 딱 1번의 호출로 처리한다.
// 우선순위(무료 할당량이 넉넉한 순서, lib/engines/openrouter.ts의 무료 모델 로테이션과 같은 정신):
//   1순위 DeepL  — text 파라미터를 배열로 보내 정말로 "한 번의 API 호출"로 N개 문장을 받는다.
//   2순위 Gemini — 배치 API가 없어 번호 매긴 프롬프트 1회 호출 + 번호 기준 파싱으로 흉내낸다.
//   3순위 Groq   — Gemini와 같은 방식.
// 하나가 실패(에러/한도초과/미지원 언어쌍/파싱 실패)하면 조용히 다음 순위로 넘어가고, 실제로 역번역을
// 수행한 엔진 이름을 결과에 남겨(§ provider) 화면에 "역번역: Gemini (DeepL 실패)"처럼 보여줄 수 있게 한다.

import { translateBatchWithDeepl } from "./engines/deepl";
import { translateBatchWithGemini } from "./engines/gemini";
import { translateBatchWithGroq } from "./engines/groq";
import type { LanguageCode } from "./engines/types";

export interface BackTranslateItem {
  engineId: string;
  text: string;
}

export interface BackTranslateResultItem {
  engineId: string;
  backText?: string;
  error?: string;
  /** 실제로 이 항목을 역번역한 엔진 (실패 사유가 있으면 함께 표기, 예: "Gemini (DeepL 실패)") */
  provider?: string;
}

export interface BackTranslateOutcome {
  results: BackTranslateResultItem[];
  /** 실제로 역번역을 수행한 엔진("DeepL"/"Gemini"/"Groq"). 셋 다 실패했으면 null. */
  provider: string | null;
}

/**
 * 성공한 번역 결과들(items)을 한 번에 역방향(targetLang → sourceLang, 즉 원래 언어로)으로 역번역한다.
 * @param sourceLang 지금 items의 텍스트가 쓰여 있는 언어 (=기본 비교 탭의 targetLang, 역번역 호출의 source)
 * @param targetLang 되돌릴 원래 언어 (=기본 비교 탭의 원본 언어, 역번역 호출의 target)
 */
export async function getBackTranslations(
  items: BackTranslateItem[],
  sourceLang: LanguageCode,
  targetLang: LanguageCode
): Promise<BackTranslateOutcome> {
  if (items.length === 0) {
    return { results: [], provider: null };
  }

  const texts = items.map((item) => item.text);

  const deepl = await translateBatchWithDeepl(texts, sourceLang, targetLang);
  if (deepl.texts) {
    return {
      provider: "DeepL",
      results: items.map((item, i) => ({ engineId: item.engineId, backText: deepl.texts![i], provider: "DeepL" })),
    };
  }
  console.warn("[역번역] DeepL 배치 실패, Gemini로 폴백:", deepl.error);

  const gemini = await translateBatchWithGemini(texts, targetLang);
  if (gemini.texts) {
    return {
      provider: "Gemini",
      results: items.map((item, i) => ({
        engineId: item.engineId,
        backText: gemini.texts![i],
        provider: "Gemini (DeepL 실패)",
      })),
    };
  }
  console.warn("[역번역] Gemini 배치도 실패, Groq로 폴백:", gemini.error);

  const groq = await translateBatchWithGroq(texts, targetLang);
  if (groq.texts) {
    return {
      provider: "Groq",
      results: items.map((item, i) => ({
        engineId: item.engineId,
        backText: groq.texts![i],
        provider: "Groq (DeepL·Gemini 실패)",
      })),
    };
  }
  console.warn("[역번역] Groq 배치도 실패, 전체 역번역 실패 처리:", groq.error);

  return {
    provider: null,
    results: items.map((item) => ({
      engineId: item.engineId,
      error: "역번역에 실패했습니다. (DeepL·Gemini·Groq 모두 실패)",
    })),
  };
}
