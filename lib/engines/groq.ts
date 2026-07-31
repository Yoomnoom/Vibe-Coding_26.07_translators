import { EngineResult, TranslateParams } from "./types";
import { buildTranslationPrompt } from "./prompt";
import { describeCatchError, describeHttpError } from "./errors";

const MODEL = "llama-3.3-70b-versatile";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 15_000;
// 실측: 반복 문자열(2000회) 입력 시 상한 없으면 출력이 입력의 수 배로 폭주함 -> 출력 토큰 상한 필요.
const MAX_TOKENS = 1024;

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export async function translateWithGroq({ text, sourceLang, targetLang }: TranslateParams): Promise<EngineResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: "GROQ_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = buildTranslationPrompt(sourceLang, targetLang, text);

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
