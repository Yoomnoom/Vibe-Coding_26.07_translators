"use client";

import { useState } from "react";
import type { SourceLanguageCode } from "@/lib/engines/types";
import { formatHistoryAsMarkdown, type TranslationHistoryEntry } from "@/lib/history";
import { downloadTextFile } from "@/lib/download";

interface HistoryTabProps {
  history: TranslationHistoryEntry[];
  onClearHistory: () => void;
}

const PREVIEW_LENGTH = 40;

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function formatSourceLang(code: SourceLanguageCode): string {
  return code === "auto" ? "자동" : code;
}

// "번역기들" 탭 안에 있던 히스토리 섹션을 별도 탭으로 분리 (2026-08-01).
// 번역 비교 화면에 자리를 차지할 이유가 없다는 피드백 반영. 지금은 ⑥ 문맥 슬라이더 옆에 임시로 배치, 위치는 추후 변경 예정.
export function HistoryTab({ history, onClearHistory }: HistoryTabProps) {
  const [copied, setCopied] = useState(false);
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatHistoryAsMarkdown(history));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    downloadTextFile(formatHistoryAsMarkdown(history), "translation-history.md");
  };

  const handleCopyEntry = async (e: React.MouseEvent, entry: TranslationHistoryEntry) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(formatHistoryAsMarkdown([entry]));
    setCopiedEntryId(entry.id);
    setTimeout(() => setCopiedEntryId((id) => (id === entry.id ? null : id)), 1500);
  };

  const handleDownloadEntry = (e: React.MouseEvent, entry: TranslationHistoryEntry) => {
    e.preventDefault();
    e.stopPropagation();
    const preview = entry.originalText.slice(0, 20).trim().replace(/[\\/:*?"<>|]/g, "");
    downloadTextFile(formatHistoryAsMarkdown([entry]), `${preview || "translation"}.md`);
  };

  return (
    <section className="blueprint-panel flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-tag">
          최근 저장 기록{history.length > 0 ? ` (${history.length}개, 최근 20개까지)` : ""}
        </h2>
        {history.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-sm border border-line px-2.5 py-1 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
            >
              {copied ? "복사됨!" : "클립보드 복사"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-sm border border-line px-2.5 py-1 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
            >
              마크다운 다운로드
            </button>
            <button
              type="button"
              onClick={onClearHistory}
              className="rounded-sm border border-line px-2.5 py-1 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
            >
              기록 전체 삭제
            </button>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <p className="font-mono text-xs text-foreground/40">아직 저장한 기록이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((entry) => {
            const preview =
              entry.originalText.length > PREVIEW_LENGTH
                ? `${entry.originalText.slice(0, PREVIEW_LENGTH)}…`
                : entry.originalText;
            const engineLabels = entry.selectedResults.map((r) => r.label).join(", ");
            return (
              <li key={entry.id} className="rounded-sm border border-line">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 font-serif text-sm text-foreground/80 marker:content-none">
                    <span className="font-medium">{preview}</span>
                    <span className="font-mono text-xs text-foreground/40">
                      {formatSourceLang(entry.sourceLang)}→{entry.targetLang} · {engineLabels || "선택 없음"}
                    </span>
                    <span className="ml-auto font-mono text-xs text-foreground/40">
                      {formatSavedAt(entry.savedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyEntry(e, entry)}
                      title={copiedEntryId === entry.id ? "복사됨!" : "이 기록 클립보드 복사"}
                      aria-label="이 기록 클립보드 복사"
                      className="rounded-sm border border-line px-1.5 py-1 text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
                    >
                      {copiedEntryId === entry.id ? "✓" : "📋"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDownloadEntry(e, entry)}
                      title="이 기록 마크다운 다운로드"
                      aria-label="이 기록 마크다운 다운로드"
                      className="rounded-sm border border-line px-1.5 py-1 text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
                    >
                      ⬇
                    </button>
                  </summary>
                  <div className="flex flex-col gap-2 border-t border-line px-3 py-2 text-sm">
                    <div>
                      <span className="label-tag">원문</span>
                      <p className="font-serif text-foreground/80">{entry.originalText}</p>
                    </div>
                    {entry.selectedResults.map((r) => (
                      <div key={r.engineId}>
                        <span className="label-tag">{r.label}</span>
                        <p className="font-serif text-foreground/80">{r.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
