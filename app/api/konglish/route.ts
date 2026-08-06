import { NextRequest, NextResponse } from "next/server";
import { findRealEnglishWithFallback } from "@/lib/konglish";

export const runtime = "nodejs";

// "오타 변환기" 옆의 독립 유틸리티 탭(콩글리시 찾기). 단어/짧은 표현을 대상으로 하는 조회라
// 번역기들의 3000자 한도보다 훨씬 짧게 제한한다.
const MAX_LENGTH = 100;

interface KonglishRequestBody {
  word?: string;
}

export async function POST(req: NextRequest) {
  let body: KonglishRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const word = body.word?.trim();

  if (!word) {
    return NextResponse.json({ error: "찾을 단어나 표현을 입력하세요." }, { status: 400 });
  }
  if (word.length > MAX_LENGTH) {
    return NextResponse.json({ error: `${MAX_LENGTH}자 이하로 입력하세요.` }, { status: 400 });
  }

  const result = await findRealEnglishWithFallback(word);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ text: result.text, provider: result.provider, sourceLink: result.sourceLink });
}
