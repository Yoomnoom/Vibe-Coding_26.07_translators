import { EngineDefinition, EngineResult, LanguageCode, SourceLanguageCode, ToneId } from "./types";
import { ENGINE_CONFIG } from "./config";
import { translateWithDeepl } from "./deepl";
import { translateWithMyMemory } from "./mymemory";
import { translateWithGemini } from "./gemini";
import { translateWithGroq } from "./groq";
import { translateWithOpenRouter } from "./openrouter";

const TRANSLATORS: Record<string, EngineDefinition["translate"]> = {
  deepl: translateWithDeepl,
  mymemory: translateWithMyMemory,
  gemini: translateWithGemini,
  groq: translateWithGroq,
  openrouter: translateWithOpenRouter,
};

// 번역 엔진 레지스트리. 새 엔진을 추가하려면 lib/engines/<engine>.ts를 만들고
// config.ts의 ENGINE_CONFIG와 위 TRANSLATORS 맵에 한 줄씩만 추가하면 된다.
// (Claude는 API 키가 비어있어 이번 범위에서는 제외 — PRD.md §5, §10)
const ENGINES: EngineDefinition[] = ENGINE_CONFIG.map((cfg) => ({
  id: cfg.id,
  label: cfg.label,
  translate: TRANSLATORS[cfg.id],
}));

export type { EngineResult, LanguageCode, SourceLanguageCode };

export async function getTranslations(
  text: string,
  sourceLang: SourceLanguageCode,
  targetLang: LanguageCode,
  enabledEngineIds: string[],
  // PRD.md §7 ⑥번 "문맥 슬라이더"용. DeepL/MyMemory는 프롬프트가 없는 고정 API라 이 값을 그냥 무시하고
  // 평소처럼 번역한다 — LLM 3종(Gemini/Groq/OpenRouter)만 실제로 반말/격식체/비즈니스체를 반영한다.
  tone?: ToneId
): Promise<Record<string, EngineResult>> {
  const active = ENGINES.filter((e) => enabledEngineIds.includes(e.id));

  const entries = await Promise.all(
    active.map(async (engine): Promise<[string, EngineResult]> => {
      try {
        const result = await engine.translate({ text, sourceLang, targetLang, tone });
        return [engine.id, result];
      } catch (err) {
        return [
          engine.id,
          { error: err instanceof Error ? err.message : `${engine.label} 호출 중 알 수 없는 오류` },
        ];
      }
    })
  );

  return Object.fromEntries(entries);
}
