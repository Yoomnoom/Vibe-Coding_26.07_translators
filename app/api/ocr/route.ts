import { NextRequest, NextResponse } from "next/server";
import { extractTextFromImageWithFallback } from "@/lib/ocr";

export const runtime = "nodejs";

// "오타 변환기" 옆의 독립 유틸리티 탭(이미지 텍스트 추출). 마우스로 텍스트를 못 긁어와서
// 스크린샷/사진으로만 가져올 수 있을 때, 그 이미지에서 텍스트를 추출해준다.
// 전용 OCR 서비스(카드 등록 필요) 대신 이미 무료로 쓰는 Gemini의 이미지 입력 기능을 재사용한다.
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
// base64는 원본 대비 약 1.37배 커진다 — 원본 이미지 기준 대략 8MB 한도.
const MAX_BASE64_LENGTH = 11_000_000;

interface OcrRequestBody {
  image?: string;
  mimeType?: string;
}

export async function POST(req: NextRequest) {
  let body: OcrRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const { image, mimeType } = body;

  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "이미지 데이터가 없습니다." }, { status: 400 });
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `지원하지 않는 이미지 형식입니다. (${ALLOWED_MIME_TYPES.join(", ")}만 지원)` },
      { status: 400 }
    );
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "이미지 용량이 너무 큽니다. 더 작은 이미지로 시도해주세요." }, { status: 400 });
  }

  const result = await extractTextFromImageWithFallback(image, mimeType);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (!result.text) {
    return NextResponse.json({ error: "이미지에서 텍스트를 찾지 못했습니다." }, { status: 422 });
  }

  return NextResponse.json({ text: result.text, provider: result.provider });
}
