import { NextResponse } from "next/server";
import { getSupabaseClient, todayInKst } from "@/lib/supabase";

export const runtime = "nodejs";

// 무료 API 사용량과 직결되는 트래픽 규모를 확인하기 위한 최소한의 일별 방문자 수 카운터.
// Supabase(Postgres)에 저장 — increment_visit RPC(schema.sql 참고)가 upsert+증가를 단일 SQL 문으로
// 처리해 동시 방문에도 카운트가 씹히지 않는다(원자적 증가, Notion 버전의 read-then-write 한계를 해결).

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ count: null });

  const { data, error } = await supabase
    .from("visit_counts")
    .select("count")
    .eq("date", todayInKst())
    .maybeSingle();

  if (error) return NextResponse.json({ count: null });
  return NextResponse.json({ count: data?.count ?? 0 });
}

export async function POST() {
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ count: null });

  const { data, error } = await supabase.rpc("increment_visit", { p_date: todayInKst() });
  if (error) return NextResponse.json({ count: null });
  return NextResponse.json({ count: data });
}
