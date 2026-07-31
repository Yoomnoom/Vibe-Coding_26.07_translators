import type { EngineId } from "./engines/config";
import type { LanguageCode, SourceLanguageCode } from "./engines/types";

// 노션이 메인 저장소지만, 새로고침하면 세션 내 기록이 다 날아가는 걸 보완하기 위한
// 가벼운 로컬 히스토리(localStorage). PRD.md §6.4, §15-2 참고.
// 노션 저장이 실제로 성공했을 때만 기록하므로, 여기 있는 항목 = 노션에도 남아있는 항목.
const STORAGE_KEY = "translation-history";
const MAX_ENTRIES = 20;

export interface HistorySelectedResult {
  engineId: EngineId;
  label: string;
  text: string;
}

export interface TranslationHistoryEntry {
  id: string;
  originalText: string;
  sourceLang: SourceLanguageCode;
  targetLang: LanguageCode;
  selectedEngineIds: EngineId[];
  selectedResults: HistorySelectedResult[];
  savedAt: string; // ISO 문자열
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadHistory(): TranslationHistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 저장된 값이 손상됐거나 localStorage를 못 쓰는 환경이어도 앱은 정상 동작해야 한다.
    return [];
  }
}

// 새 항목을 맨 앞에 추가하고 최근 20개까지만 유지한다. 갱신된 전체 목록을 반환한다.
export function addHistoryEntry(entry: Omit<TranslationHistoryEntry, "id">): TranslationHistoryEntry[] {
  if (!isBrowser()) return [];
  const newEntry: TranslationHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const next = [newEntry, ...loadHistory()].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 프라이빗 모드 등으로 저장이 안 되더라도 노션 저장 자체는 이미 끝난 상태라 무시해도 된다.
  }
  return next;
}

/** 저장 기록을 마크다운 텍스트로 직렬화한다 (클립보드 복사/파일 다운로드 공용). */
export function formatHistoryAsMarkdown(entries: TranslationHistoryEntry[]): string {
  return entries
    .map((entry) => {
      const lines = [
        `## ${entry.originalText}`,
        `_${entry.sourceLang} → ${entry.targetLang} · ${new Date(entry.savedAt).toLocaleString("ko-KR")}_`,
        "",
        ...entry.selectedResults.map((r) => `**${r.label}**: ${r.text}`),
      ];
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function clearHistory(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
