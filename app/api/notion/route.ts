import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

// 노션 중복 저장 방지 가드 (PRD §15-1)
// 개인용 로컬 도구(단일 프로세스, 단일 사용자)라 DB/캐시 라이브러리 없이
// 모듈 스코프 Map으로 최근 저장 요청을 잠깐 기억해두는 정도로 충분하다.
// 서버 재시작 시 초기화되는 건 의도된 동작.
const DUPLICATE_WINDOW_MS = 10_000;
const recentSaves = new Map<string, { timestamp: number; result: { success: true; pageId: string; url?: string } }>();

function buildDedupeKey(body: NotionSaveBody): string {
  const raw = [
    body.originalText ?? "",
    body.sourceLang ?? "",
    body.targetLang ?? "",
    [...(body.selectedEngineIds ?? [])].sort().join(","),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

function pruneExpired(now: number) {
  for (const [key, entry] of recentSaves) {
    if (now - entry.timestamp > DUPLICATE_WINDOW_MS) {
      recentSaves.delete(key);
    }
  }
}

// 노션 "선택한 번역기"(Multi-select) 속성에 등록된 옵션과 정확히 일치해야 한다.
// id(프론트/백엔드 내부 식별자) -> label(노션 옵션명) 매핑을 유일한 화이트리스트로 두고,
// 검증(엔진 id 화이트리스트)과 저장(라벨 표시) 양쪽에서 동일하게 재사용한다.
// 지금은 검증 없이 그대로 Select 속성에 저장되어 프로덕션 노션 DB에
// "NotARealEngine" 같은 가짜 옵션이 실제로 생성되는 버그가 있었다 — 반드시 화이트리스트로 막는다.
const ENGINE_LABELS: Record<string, string> = {
  deepl: "DeepL",
  mymemory: "MyMemory",
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  claude: "Claude",
};
const KNOWN_ENGINE_IDS = Object.keys(ENGINE_LABELS);

// 노션 rich_text 속성은 단일 텍스트 블록에 최대 2000자 제한이 있다.
const NOTION_TEXT_LIMIT = 2000;
function truncate(value: string) {
  return value.length > NOTION_TEXT_LIMIT ? value.slice(0, NOTION_TEXT_LIMIT) : value;
}

interface EngineResultPayload {
  text?: string;
  error?: string;
}

interface NotionSaveBody {
  originalText?: string;
  sourceLang?: string;
  targetLang?: string;
  /** 이번에 새로 다중 선택으로 바뀐 필드. 노션 "선택한 번역기"(Multi-select)에 저장될 엔진 id 목록 */
  selectedEngineIds?: string[];
  /** 저장 시점에 호출됐던 모든 엔진의 결과. key는 엔진 id(deepl/mymemory/gemini/groq/openrouter/claude) */
  allResults?: Record<string, EngineResultPayload>;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return NextResponse.json({ error: "NOTION_API_KEY 또는 NOTION_DATABASE_ID가 설정되지 않았습니다." }, { status: 500 });
  }

  let body: NotionSaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const { originalText, selectedEngineIds, allResults } = body;

  if (!originalText?.trim()) {
    return NextResponse.json({ error: "원문은 필수입니다." }, { status: 400 });
  }

  // 5. 최소 1개 이상 선택되어야 함
  if (!Array.isArray(selectedEngineIds) || selectedEngineIds.length === 0) {
    return NextResponse.json({ error: "저장할 번역기를 최소 1개 이상 선택하세요." }, { status: 400 });
  }

  // 1. 알려진 엔진 화이트리스트 검증 (가짜 옵션이 노션에 생성되는 것을 방지)
  const unknownIds = selectedEngineIds.filter((id) => !KNOWN_ENGINE_IDS.includes(id));
  if (unknownIds.length > 0) {
    return NextResponse.json(
      { error: `알 수 없는 번역기입니다: ${unknownIds.join(", ")}` },
      { status: 400 }
    );
  }

  // 6. 동일 원문+언어쌍+선택 엔진 조합으로 10초 이내 중복 저장 요청이 오면
  //    새로 노션에 쓰지 않고 직전 결과를 그대로 반환한다.
  const now = Date.now();
  pruneExpired(now);
  const dedupeKey = buildDedupeKey(body);
  const previous = recentSaves.get(dedupeKey);
  if (previous && now - previous.timestamp <= DUPLICATE_WINDOW_MS) {
    return NextResponse.json({
      ...previous.result,
      duplicate: true,
      message: "방금 저장한 동일 내용입니다. 새로 저장하지 않았습니다.",
    });
  }

  const notion = new Client({ auth: apiKey });

  // 3. "선택한 번역 결과"는 선택된 엔진들의 결과를 사람이 읽기 좋게 모아 텍스트로 정리
  const selectedText = selectedEngineIds
    .map((id) => {
      const text = allResults?.[id]?.text?.trim();
      return `${ENGINE_LABELS[id]}: ${text && text.length > 0 ? text : "(결과 없음)"}`;
    })
    .join("\n\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    원문: {
      title: [{ text: { content: truncate(originalText) } }],
    },
    // 2. Multi-select로 스키마 변경 완료 — 여러 엔진을 동시에 저장
    "선택한 번역기": {
      multi_select: selectedEngineIds.map((id) => ({ name: ENGINE_LABELS[id] })),
    },
    "선택한 번역 결과": {
      rich_text: [{ text: { content: truncate(selectedText) } }],
    },
    "저장 시각": {
      date: { start: new Date().toISOString() },
    },
  };

  // 4. allResults에 있는 각 엔진의 결과는 기존처럼 엔진별 컬럼에 채우고, 없는 엔진은 빈 값으로 둔다.
  for (const id of KNOWN_ENGINE_IDS) {
    const value = allResults?.[id]?.text;
    if (value && value.trim()) {
      properties[`${ENGINE_LABELS[id]} 결과`] = {
        rich_text: [{ text: { content: truncate(value) } }],
      };
    }
  }

  try {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    const url = "url" in page ? (page as { url?: string }).url : undefined;
    const result = { success: true as const, pageId: page.id, url };
    recentSaves.set(dedupeKey, { timestamp: now, result });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "노션 저장 중 알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
