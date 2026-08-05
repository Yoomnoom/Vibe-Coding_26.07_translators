import { BatchEngineResult, EngineResult, LanguageCode, TranslateParams } from "./types";
import { buildBatchTranslationPrompt, buildTranslationPrompt, parseNumberedBatchResponse } from "./prompt";
import { describeCatchError, describeHttpError } from "./errors";

const MODEL = "llama-3.3-70b-versatile";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 15_000;
// 실측: 반복 문자열(2000회) 입력 시 상한 없으면 출력이 입력의 수 배로 폭주함 -> 출력 토큰 상한은 필요.
// 다만 1024는 너무 낮아서 입력 3000자 한도 근처의 정상적인 번역도 문장 중간에 잘리는 버그가 있었음(2026-08-05 확인).
// (4096으로 처음 올렸을 때도 Gemini 쪽에서 경계 사례가 실측돼 8192로 재조정, Groq에도 동일하게 적용.)
const MAX_TOKENS = 8192;
// 역번역 배치는 문장 여러 개(최대 5개) + 번호 목록 형식이 섞여 단일 문장보다 응답이 길어질 수 있어 여유를 둔다.
const MAX_TOKENS_BATCH = 16384;

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export async function translateWithGroq({ text, sourceLang, targetLang, tone }: TranslateParams): Promise<EngineResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: "GROQ_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = buildTranslationPrompt(sourceLang, targetLang, text, tone);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as GroqResponse;

    if (!res.ok) {
      return { error: describeHttpError(res.status, "Groq", data.error?.message) };
    }

    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) {
      return { error: "Groq 응답에 번역 결과가 없습니다." };
    }

    return { text: translated, model: MODEL };
  } catch (err) {
    return { error: describeCatchError(err, "Groq") };
  }
}

/**
 * 역번역 배치(lib/backTranslate.ts, PRD.md §7 ②번)에서 DeepL·Gemini가 모두 실패했을 때 쓰는 3순위 폴백.
 * Gemini 배치와 같은 방식(번호 매긴 목록 프롬프트 1회 호출 + 번호 기준 파싱)으로 처리한다.
 */
export async function translateBatchWithGroq(texts: string[], targetLang: LanguageCode): Promise<BatchEngineResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: "GROQ_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = buildBatchTranslationPrompt(targetLang, texts);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: MAX_TOKENS_BATCH,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as GroqResponse;

    if (!res.ok) {
      return { error: describeHttpError(res.status, "Groq", data.error?.message) };
    }

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { error: "Groq 응답에 번역 결과가 없습니다." };
    }

    const parsed = parseNumberedBatchResponse(raw, texts.length);
    if (!parsed) {
      return { error: "Groq 배치 응답 형식을 해석하지 못했습니다." };
    }
    return { texts: parsed };
  } catch (err) {
    return { error: describeCatchError(err, "Groq") };
  }
}
