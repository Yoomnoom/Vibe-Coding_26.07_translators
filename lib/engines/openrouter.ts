import { EngineResult, TranslateParams } from "./types";
import { buildTranslationPrompt } from "./prompt";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 15_000;
// 실측: 반복 문자열(2000회) 입력에 상한 없이 호출했더니 입력의 8배(114,435자)를 반환함 -> 출력 토큰 상한 필요.
const MAX_TOKENS = 1024;

// 무료(:free) 모델 로테이션 목록. 순서대로 시도하다가 429/오류가 나면 다음 모델로 자동 전환한다.
// OpenRouter의 무료 모델 라인업은 수시로 바뀌므로(단종/이름 변경 등), 주기적으로
// https://openrouter.ai/api/v1/models 에서 ":free" 접미사 모델 목록을 확인해 갱신하는 것을 권장한다.
const FREE_MODELS = [
  "inclusionai/ling-3.0-flash:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-4-31b-it:free",
];

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export async function translateWithOpenRouter({ text, sourceLang, targetLang }: TranslateParams): Promise<EngineResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { error: "OPENROUTER_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = buildTranslationPrompt(sourceLang, targetLang, text);
  const attempts: string[] = [];

  for (const model of FREE_MODELS) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // OpenRouter 권장 헤더 (순위 산정용, 없어도 동작함). 헤더 값은 ByteString이어야 하므로 ASCII만 사용.
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Translation Comparator",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: MAX_TOKENS,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status === 429) {
        attempts.push(`${model}: 429 한도 초과`);
        continue;
      }

      const data = (await res.json()) as OpenRouterResponse;

      if (!res.ok) {
        attempts.push(`${model}: ${res.status} ${data.error?.message ?? ""}`.trim());
        continue;
      }

      const translated = data.choices?.[0]?.message?.content?.trim();
      if (!translated) {
        attempts.push(`${model}: 빈 응답`);
        continue;
      }

      return { text: translated, model };
    } catch (err) {
      attempts.push(`${model}: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  }

  // 시도한 모델별 상세 실패 사유(모델명, 원본 에러 메시지 등)는 서버 콘솔에만 남기고,
  // 사용자에게는 기술적인 세부사항을 노출하지 않는다.
  console.error("[OpenRouter] 모든 무료 모델 호출 실패:", attempts.join(" | "));
  const hadTimeout = attempts.some((a) => /timeout|abort/i.test(a));
  if (hadTimeout) {
    return { error: "OpenRouter 응답이 너무 늦어 요청을 취소했습니다. 잠시 후 다시 시도해주세요." };
  }
  return {
    error: "OpenRouter 무료 모델을 모두 시도했지만 응답을 받지 못했습니다 (무료 사용량 한도 초과 가능). 잠시 후 다시 시도해주세요.",
  };
}
