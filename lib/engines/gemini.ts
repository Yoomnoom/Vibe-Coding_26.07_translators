import { BatchEngineResult, EngineResult, LanguageCode, TranslateParams } from "./types";
import { buildBatchTranslationPrompt, buildTranslationPrompt, parseNumberedBatchResponse } from "./prompt";
import { describeCatchError, describeHttpError } from "./errors";

// "gemini-2.0-flash" 계열은 이 키의 무료 티어에서 할당량이 0으로 막혀 있어 사용 불가.
// "gemini-flash-latest"는 현재 사용 가능한 최신 Flash 모델을 가리키는 별칭(alias)이라 장기적으로도 안전하다.
const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 15_000;
// 실측: 반복 문자열(2000회) 입력 시 상한 없으면 응답이 폭주(붕괴)하거나 비정상적으로 길어짐 -> 출력 토큰 상한 필요.
const MAX_OUTPUT_TOKENS = 1024;
// 역번역 배치는 문장 여러 개(최대 5개) + 번호 목록 형식이 섞여 단일 문장보다 응답이 길어질 수 있어 여유를 둔다.
const MAX_OUTPUT_TOKENS_BATCH = 2048;

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

/**
 * 이미지 속 텍스트 추출(OCR). "오타 변환기" 옆 별도 유틸리티 탭(app/api/ocr)에서 쓴다.
 * 전용 OCR API(Google Vision 등, 카드 등록 필요) 대신, 이미 무료로 쓰고 있는 Gemini의
 * 멀티모달(이미지 입력) 기능을 그대로 재사용해 새 가입/키 없이 구현한다.
 */
export async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<EngineResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "GEMINI_API_KEY가 설정되지 않았습니다." };
  }

  const prompt =
    "이 이미지 안에 있는 텍스트를 그대로 추출해줘. 번역하거나 요약하지 말고, 이미지에 보이는 원문 그대로만 답해줘. " +
    "설명이나 부가 문구 없이 추출한 텍스트만 답변해. 텍스트가 없으면 빈 문자열로 답해줘.";

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as GeminiResponse;

    if (!res.ok) {
      return { error: describeHttpError(res.status, "Gemini", data.error?.message) };
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const extracted = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("")
      .trim();

    return { text: extracted, model: MODEL };
  } catch (err) {
    return { error: describeCatchError(err, "Gemini") };
  }
}

/**
 * 역번역 배치(lib/backTranslate.ts, PRD.md §7 ②번)에서 DeepL이 실패했을 때 쓰는 2순위 폴백.
 * Gemini에는 DeepL 같은 다중 텍스트 배치 API가 없어, 번호를 매긴 문장 목록 하나를 프롬프트로 보내
 * 한 번의 호출로 N개를 동시에 번역받고 번호 기준으로 파싱한다(호출 수를 아끼는 게 핵심).
 */
export async function translateBatchWithGemini(texts: string[], targetLang: LanguageCode): Promise<BatchEngineResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "GEMINI_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = buildBatchTranslationPrompt(targetLang, texts);

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: MAX_OUTPUT_TOKENS_BATCH },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as GeminiResponse;

    if (!res.ok) {
      return { error: describeHttpError(res.status, "Gemini", data.error?.message) };
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const raw = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("")
      .trim();
    if (!raw) {
      return { error: "Gemini 응답에 번역 결과가 없습니다." };
    }

    const parsed = parseNumberedBatchResponse(raw, texts.length);
    if (!parsed) {
      return { error: "Gemini 배치 응답 형식을 해석하지 못했습니다." };
    }
    return { texts: parsed };
  } catch (err) {
    return { error: describeCatchError(err, "Gemini") };
  }
}
