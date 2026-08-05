import { NextRequest, NextResponse } from "next/server";
import { getBackTranslations } from "@/lib/backTranslate";
import { LanguageCode } from "@/lib/engines/types";
import { SUPPORTED_LANGUAGES } from "@/lib/engines/config";

export const runtime = "nodejs";

// PRD.md §7 "역번역 체크". SUPPORTED_LANGUAGES(lib/engines/config.ts)에서 파생 —
// /api/translate와 동일한 소스를 공유해 언어 목록이 두 곳에서 따로 관리되지 않게 한다.
const SUPPORTED_LANGS: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);
// "결과 비교"(엔진 5개)뿐 아니라 "문맥 슬라이더"(엔진 3개 × 톤 최대 3개 = 9개)도 이 라우트를 쓰므로
// 5로는 부족해 여유를 두고 10으로 올림(2026-08-05).
const MAX_ITEMS = 10;
const MAX_TEXT_LENGTH = 3000;

interface BackTranslateRequestBody {
  items?: { engineId?: string; text?: string }[];
  sourceLang?: string;
  targetLang?: string;
}

function isSupportedLang(value: unknown): value is LanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest) {
  let body: BackTranslateRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const { items, sourceLang, targetLang } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "역번역할 항목이 없습니다." }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `한 번에 최대 ${MAX_ITEMS}개까지 역번역할 수 있습니다.` }, { status: 400 });
  }
  for (const item of items) {
    if (!item || typeof item.engineId !== "string" || typeof item.text !== "string" || !item.text.trim()) {
      return NextResponse.json({ error: "역번역 항목 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (item.text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `입력이 너무 깁니다. ${MAX_TEXT_LENGTH}자 이하로 입력해주세요.` },
        { status: 400 }
      );
    }
  }

  // sourceLang/targetLang은 역번역 호출 자체의 방향(현재 번역문 언어 → 되돌릴 원래 언어)이라
  // 둘 다 auto를 허용하지 않는다 (원본 언어 감지는 /api/translate에서 이미 끝난 상태여야 함).
  if (!isSupportedLang(sourceLang) || !isSupportedLang(targetLang)) {
    return NextResponse.json(
      { error: `지원하지 않는 언어 코드입니다. sourceLang/targetLang은 ${SUPPORTED_LANGS.join(", ")} 중 하나여야 합니다.` },
      { status: 400 }
    );
  }

  const validItems = items as { engineId: string; text: string }[];
  const { results, provider } = await getBackTranslations(validItems, sourceLang, targetLang);

  return NextResponse.json({ backTranslations: results, provider });
}
