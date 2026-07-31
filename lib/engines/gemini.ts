import { EngineResult, TranslateParams } from "./types";
import { buildTranslationPrompt } from "./prompt";
import { describeCatchError, describeHttpError } from "./errors";

// "gemini-2.0-flash" 계열은 이 키의 무료 티어에서 할당량이 0으로 막혀 있어 사용 불가.
// "gemini-flash-latest"는 현재 사용 가능한 최신 Flash 모델을 가리키는 별칭(alias)이라 장기적으로도 안전하다.
const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 15_000;
// 실측: 반복 문자열(2000회) 입력 시 상한 없으면 응답이 폭주(붕괴)하거나 비정상적으로 길어짐 -> 출력 토큰 상한 필요.
const MAX_OUTPUT_TOKENS = 1024;

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  error?: { message?: string };
}

export async function translateWithGemini({ text, sourceLang, targetLang }: TranslateParams): Promise<EngineResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "GEMINI_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = buildTranslationPrompt(sourceLang, targetLang, text);

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as GeminiResponse;

    if (!res.ok) {
      return { error: describeHttpError(res.status, "Gemini", data.error?.message) };
    }

    // "thinking" 모델은 parts에 사고 과정(thought: true)을 함께 담을 수 있어 실제 답변 파트만 골라낸다.
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const translated = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("")
      .trim();
    if (!translated) {
      return { error: "Gemini 응답에 번역 결과가 없습니다." };
    }

    return { text: translated, model: MODEL };
  } catch (err) {
    return { error: describeCatchError(err, "Gemini") };
  }
}
