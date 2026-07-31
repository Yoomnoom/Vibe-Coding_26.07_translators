import { NextRequest, NextResponse } from "next/server";
import { getTranslations, LanguageCode, SourceLanguageCode } from "@/lib/engines";
import { ENGINE_CONFIG } from "@/lib/engines/config";

export const runtime = "nodejs";

// PRD.md §3/§6.1 — 원본/번역 언어를 사용자가 직접 고를 수 있어야 한다. (8개 언어 지원)
// lib/engines/types.ts의 LanguageCode와 동일한 8개 값을 그대로 나열해 화이트리스트로 쓴다.
const SUPPORTED_LANGS: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "fr", "de", "vi"];
// 원본 언어는 위 8개 + "auto"(자동 감지)까지 허용한다. 번역할 언어(targetLang)는 auto를 허용하지 않는다.
const SUPPORTED_SOURCE_LANGS: SourceLanguageCode[] = [...SUPPORTED_LANGS, "auto"];

const MAX_TEXT_LENGTH = 3000;

// 라우트 검증용 화이트리스트. lib/engines/config.ts(엔진 메타데이터)를 그대로 재사용해
// 실제로 존재하는 엔진 목록과 항상 일치하도록 한다.
const KNOWN_ENGINE_IDS: string[] = ENGINE_CONFIG.map((e) => e.id);

interface TranslateRequestBody {
  text?: string;
  sourceLang?: string;
  targetLang?: string;
  enabledEngines?: string[];
}

function isSupportedLang(value: unknown): value is LanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

function isSupportedSourceLang(value: unknown): value is SourceLanguageCode {
  return typeof value === "string" && (SUPPORTED_SOURCE_LANGS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest) {
  let body: TranslateRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const { text, sourceLang, targetLang, enabledEngines } = body;

  // 1. 빈 텍스트 / 공백만 있는 텍스트 거부
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "번역할 텍스트를 입력하세요." }, { status: 400 });
  }

  const trimmedText = text.trim();

  // 2. 과도하게 긴 입력 거부
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `입력이 너무 깁니다. ${MAX_TEXT_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  // 3. 지원하지 않는 언어 코드 거부 (기존엔 조용히 "ko-en"으로 대체되던 버그)
  // sourceLang은 "auto"(자동 감지)까지 허용하고, targetLang은 반드시 실제 언어여야 한다.
  if (!isSupportedSourceLang(sourceLang) || !isSupportedLang(targetLang)) {
    return NextResponse.json(
      {
        error: `지원하지 않는 언어 코드입니다. sourceLang은 ${SUPPORTED_SOURCE_LANGS.join(
          ", "
        )} 중 하나, targetLang은 ${SUPPORTED_LANGS.join(", ")} 중 하나여야 합니다.`,
      },
      { status: 400 }
    );
  }

  // 4. enabledEngines 자체가 없거나 비어있는 경우
  if (!Array.isArray(enabledEngines) || enabledEngines.length === 0) {
    return NextResponse.json({ error: "활성화된 번역 엔진이 없습니다." }, { status: 400 });
  }

  // 4. 알 수 없는 엔진 id가 섞여 있으면 거부 (기존엔 조용히 빈 결과 {}를 반환하던 버그)
  const unknownEngines = enabledEngines.filter((id) => !KNOWN_ENGINE_IDS.includes(id));
  if (unknownEngines.length > 0) {
    return NextResponse.json(
      { error: `알 수 없는 번역 엔진입니다: ${unknownEngines.join(", ")}` },
      { status: 400 }
    );
  }

  const results = await getTranslations(trimmedText, sourceLang, targetLang, enabledEngines);

  return NextResponse.json({ results });
}
