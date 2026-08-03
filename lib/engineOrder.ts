import { ENGINE_CONFIG, EngineId } from "./engines/config";

// 엔진 카드(ENGINE 01~05) 표시 순서를 사용자가 직접 바꿀 수 있게 하되, 새로고침해도
// 유지되도록(=평소엔 고정) localStorage에 저장한다. 노션/API 호출 순서와는 무관 — 화면 표시 순서 전용.
const STORAGE_KEY = "engine-order";

const DEFAULT_ORDER: EngineId[] = ENGINE_CONFIG.map((e) => e.id);

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadEngineOrder(): EngineId[] {
  if (!isBrowser()) return DEFAULT_ORDER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    // 엔진 구성(ENGINE_CONFIG)이 저장된 뒤 바뀌었을 수 있으니, 현재 엔진 id와 정확히 일치할 때만 신뢰한다.
    const isValid =
      parsed.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every((id) => parsed.includes(id));
    return isValid ? (parsed as EngineId[]) : DEFAULT_ORDER;
  } catch {
    return DEFAULT_ORDER;
  }
}

export function saveEngineOrder(order: EngineId[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // 저장 실패해도 이번 세션 내 순서 변경 자체는 정상 동작하므로 무시한다.
  }
}
