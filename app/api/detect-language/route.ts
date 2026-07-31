import { NextRequest, NextResponse } from "next/server";
import { detectLanguageViaMyMemory } from "@/lib/engines/mymemory";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 3000;

interface DetectRequestBody {
  text?: string;
}

// sourceLang="auto"일 때, 5개 번역 엔진을 전부 호출하기 전에 언어만 먼저 가볍게 감지하기 위한 전용 엔드포인트.
// (감지 결과에 맞춰 targetLang을 정한 뒤 실제 번역을 한 번만 호출하려는 목적 — app/page.tsx 참고)
export async function POST(req: NextRequest) {
  let body: DetectRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const { text } = body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "감지할 텍스트를 입력하세요." }, { status: 400 });
  }

  const trimmedText = text.trim();
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `입력이 너무 깁니다. ${MAX_TEXT_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  const detectedLang = await detectLanguageViaMyMemory(trimmedText);
  return NextResponse.json({ detectedLang });
}
