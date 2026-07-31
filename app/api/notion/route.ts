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

// 원문(제목)은 길이 보장이 없어 그대로 쓰면 목록에서 스캔하기 어렵다 — 제목은 적당히 줄이고,
// 전체 원문은 페이지 본문(children)에 따로 넣어 정보 손실 없이 목록만 짧게 유지한다.
const TITLE_MAX_LENGTH = 60;
function truncateTitle(value: string) {
  const trimmed = value.trim();
  return trimmed.length > TITLE_MAX_LENGTH ? `${trimmed.slice(0, TITLE_MAX_LENGTH)}…` : trimmed;
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

  // 1. 원문 필수
  if (!originalText?.trim()) {
    return NextResponse.json({ error: "원문은 필수입니다." }, { status: 400 });
  }

  // 2. 최소 1개 이상 선택되어야 함
  if (!Array.isArray(selectedEngineIds) || selectedEngineIds.length === 0) {
    return NextResponse.json({ error: "저장할 번역기를 최소 1개 이상 선택하세요." }, { status: 400 });
  }

  // 3. 알려진 엔진 화이트리스트 검증 (가짜 옵션이 노션에 생성되는 것을 방지)
  const unknownIds = selectedEngineIds.filter((id) => !KNOWN_ENGINE_IDS.includes(id));
  if (unknownIds.length > 0) {
    return NextResponse.json(
      { error: `알 수 없는 번역기입니다: ${unknownIds.join(", ")}` },
      { status: 400 }
    );
  }

  // 4. 동일 원문+언어쌍+선택 엔진 조합으로 10초 이내 중복 저장 요청이 오면
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

  // 5. 속성(property)은 필터/정렬에 쓰는 최소한의 메타데이터만 남긴다 (원문/선택한 번역기/저장 시각).
  //    엔진별 결과 전체는 property 칸(서식 없음, 안 쓴 엔진도 "비어 있음"으로 나열됨)이 아니라
  //    페이지 본문에 제목+문단으로 정리해서 넣는다 — 사용성 피드백(2026-08-01) 반영.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    원문: {
      title: [{ text: { content: truncateTitle(originalText) } }],
    },
    "선택한 번역기": {
      multi_select: selectedEngineIds.map((id) => ({ name: ENGINE_LABELS[id] })),
    },
    "저장 시각": {
      date: { start: new Date().toISOString() },
    },
  };

  // 6. 페이지 본문: 결과가 있는 엔진만 제목(선택됐으면 "✅ 라벨 (선택됨)")+문단으로 나열.
  //    결과 없는(빈 값/에러) 엔진은 아예 항목 자체를 만들지 않는다 — property 방식과 달리
  //    "비어 있음"이 나열되지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "원문" } }] },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: truncate(originalText) } }] },
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "번역 결과 비교" } }] },
    },
  ];
  for (const id of KNOWN_ENGINE_IDS) {
    const value = allResults?.[id]?.text?.trim();
    if (!value) continue;
    const isSelected = selectedEngineIds.includes(id);
    const heading = isSelected ? `✅ ${ENGINE_LABELS[id]} (선택됨)` : ENGINE_LABELS[id];
    children.push(
      {
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ type: "text", text: { content: heading } }] },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: truncate(value) } }] },
      }
    );
  }

  try {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
      children,
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
