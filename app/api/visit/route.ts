import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const runtime = "nodejs";

// 무료 API 사용량과 직결되는 트래픽 규모를 확인하기 위한 최소한의 일별 방문자 수 카운터.
// 별도 DB 없이 이미 연동된 노션(NOTION_API_KEY)에 날짜별 1행("날짜"/"방문수")으로 기록한다.
// ponytail: 동시 방문 시 read-then-write라 카운트가 드물게 씹힐 수 있음(원자적 증가 아님) —
// 개인 도구 규모의 트래픽에선 무해한 단순화. 늘어나면 Notion 대신 진짜 카운터 스토어로 옮길 것.

function todayInKst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function getClient() {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_VISIT_DB_ID;
  const dataSourceId = process.env.NOTION_VISIT_DATA_SOURCE_ID;
  if (!apiKey || !databaseId || !dataSourceId) return null;
  return { notion: new Client({ auth: apiKey }), databaseId, dataSourceId };
}

async function findTodayPage(notion: Client, dataSourceId: string, date: string) {
  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: { property: "날짜", title: { equals: date } },
  });
  return res.results[0] ?? null;
}

function readCount(page: { properties?: Record<string, { number?: number | null }> }): number {
  return page.properties?.["방문수"]?.number ?? 0;
}

export async function GET() {
  const client = getClient();
  if (!client) return NextResponse.json({ count: null });

  try {
    const date = todayInKst();
    const page = await findTodayPage(client.notion, client.dataSourceId, date);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ count: page ? readCount(page as any) : 0 });
  } catch {
    return NextResponse.json({ count: null });
  }
}

export async function POST() {
  const client = getClient();
  if (!client) return NextResponse.json({ count: null });

  try {
    const date = todayInKst();
    const existing = await findTodayPage(client.notion, client.dataSourceId, date);
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = readCount(existing as any) + 1;
      await client.notion.pages.update({
        page_id: existing.id,
        properties: { 방문수: { number: next } },
      });
      return NextResponse.json({ count: next });
    }
    await client.notion.pages.create({
      parent: { database_id: client.databaseId },
      properties: {
        날짜: { title: [{ text: { content: date } }] },
        방문수: { number: 1 },
      },
    });
    return NextResponse.json({ count: 1 });
  } catch {
    return NextResponse.json({ count: null });
  }
}
