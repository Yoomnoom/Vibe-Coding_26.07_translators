"use client";

import { useState } from "react";
import { ENGINE_CONFIG, EngineId, SOURCE_LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } from "@/lib/engines/config";
import type { LanguageCode, SourceLanguageCode } from "@/lib/engines/types";
import { EngineCard, CardState } from "@/components/EngineCard";
import { formatHistoryAsMarkdown, type TranslationHistoryEntry } from "@/lib/history";

export type SaveState = "idle" | "saving" | "success" | "error";

// 바로 눌러볼 수 있는 예문 몇 개 — 빈 입력창 앞에서 뭘 쳐야 할지 고민하지 않게.
const EXAMPLE_SENTENCES = [
  "완전 대박이다",
  "가성비 갑이다",
  "오늘 컨디션 좀 텐션 높다",
  "A bad workman always blames his tools.",
];

interface BasicCompareTabProps {
  sourceLang: SourceLanguageCode;
  /** sourceLang이 "auto"일 때 실제로 감지된 언어. 아직 감지 전이거나 auto가 아니면 null. */
  detectedSourceLang: LanguageCode | null;
  targetLang: LanguageCode;
  onSourceLangChange: (lang: SourceLanguageCode) => void;
  onTargetLangChange: (lang: LanguageCode) => void;
  onSwapLangs: () => void;

  inputText: string;
  onInputTextChange: (text: string) => void;
  onTranslate: () => void;
  isTranslating: boolean;
  translateError: string | null;

  enabled: Record<EngineId, boolean>;
  onToggleEnabled: (id: EngineId) => void;
  cardStates: Record<EngineId, CardState>;

  selectedEngineIds: Set<EngineId>;
  onSelect: (id: EngineId) => void;

  onSaveToNotion: () => void;
  canSave: boolean;
  saveState: SaveState;
  saveDisabledReason: string | null;
  saveMessage: string | null;
  savedPageUrl: string | null;

  history: TranslationHistoryEntry[];
  onClearHistory: () => void;

  /** 선택된 번역이 있을 때 "역번역 체크" 탭으로 바로 이동시키는 콜백 */
  onGoToBackTranslate: () => void;
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

// 기존 app/page.tsx에 있던 "기본 비교" 화면 전체를 그대로 옮긴 컴포넌트.
// 상태는 app/page.tsx(최상위)에서 유지하고, 이 컴포넌트는 props로 받아 렌더링만 담당한다
// — 탭을 옮겨도 입력/번역 결과가 사라지지 않도록 하기 위함 (PRD.md §7).
export function BasicCompareTab({
  sourceLang,
  detectedSourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLangs,
  inputText,
  onInputTextChange,
  onTranslate,
  isTranslating,
  translateError,
  enabled,
  onToggleEnabled,
  cardStates,
  selectedEngineIds,
  onSelect,
  onSaveToNotion,
  canSave,
  saveState,
  saveDisabledReason,
  saveMessage,
  savedPageUrl,
  history,
  onClearHistory,
  onGoToBackTranslate,
}: BasicCompareTabProps) {
  const [historyCopied, setHistoryCopied] = useState(false);

  const handleCopyHistory = async () => {
    await navigator.clipboard.writeText(formatHistoryAsMarkdown(history));
    setHistoryCopied(true);
    setTimeout(() => setHistoryCopied(false), 1500);
  };

  const handleDownloadHistory = () => {
    const blob = new Blob([formatHistoryAsMarkdown(history)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translation-history.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="blueprint-panel flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={onSaveToNotion}
          disabled={!canSave || saveState === "saving"}
          className="rounded-sm border border-accent bg-accent-dark px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveState === "saving"
            ? "저장 중..."
            : `노션에 저장${selectedEngineIds.size > 0 ? ` (${selectedEngineIds.size}개 선택됨)` : ""}`}
        </button>
        {selectedEngineIds.size > 0 && (
          <button
            type="button"
            onClick={onGoToBackTranslate}
            className="font-mono text-xs text-accent underline underline-offset-2 hover:text-accent-dark"
          >
            → 역번역 체크에서 의미 보존율 확인
          </button>
        )}
        {!canSave && saveDisabledReason && <p className="font-mono text-xs text-foreground/40">{saveDisabledReason}</p>}
        {saveMessage && (
          <p className={`font-mono text-xs ${saveState === "success" ? "text-emerald-700" : "text-red-700"}`}>
            {saveMessage}
            {saveState === "success" && savedPageUrl && (
              <>
                {" "}
                <a
                  href={savedPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-emerald-900"
                >
                  노션에서 열기 →
                </a>
              </>
            )}
          </p>
        )}
      </section>

      <section className="blueprint-panel flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="label-tag">
            최근 저장 기록{history.length > 0 ? ` (${history.length}개, 최근 20개까지)` : ""}
          </h2>
          {history.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyHistory}
                className="rounded-sm border border-line px-2.5 py-1 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
              >
                {historyCopied ? "복사됨!" : "클립보드 복사"}
              </button>
              <button
                type="button"
                onClick={handleDownloadHistory}
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

      <p className="font-mono text-xs leading-relaxed text-foreground/60">
        마음에 드는 번역 결과를 카드에서 <strong className="text-accent">여러 개 동시에</strong> 선택할 수 있어요. 선택한
        카드는 파란 테두리와 체크 표시로 구분됩니다.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <section className="blueprint-panel flex flex-col gap-3 self-start p-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <label className="flex items-center gap-1.5">
            <span className="label-tag">원본</span>
            <select
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value as SourceLanguageCode)}
              aria-label="원본 언어 (번역할 문장이 작성된 언어, 자동 감지 가능)"
              className="rounded-sm border border-line bg-paper-card px-2 py-1.5 text-foreground outline-none focus:border-accent"
            >
              {SOURCE_LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          {sourceLang === "auto" && detectedSourceLang && (
            <span className="label-tag rounded-full border border-line px-2 py-1">
              감지됨 → {SUPPORTED_LANGUAGES.find((l) => l.code === detectedSourceLang)?.label ?? detectedSourceLang}
            </span>
          )}
          <button
            type="button"
            onClick={onSwapLangs}
            disabled={sourceLang === "auto"}
            aria-label="원본 언어와 번역 언어 서로 바꾸기"
            title={
              sourceLang === "auto"
                ? "원본 언어가 자동 감지일 때는 바꿀 수 없어요"
                : "원본 언어와 번역 언어 서로 바꾸기"
            }
            className="rounded-sm border border-line px-2 py-1.5 text-accent transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line disabled:hover:bg-transparent"
          >
            ⇄
          </button>
          <label className="flex items-center gap-1.5">
            <span className="label-tag">번역할 언어</span>
            <select
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value as LanguageCode)}
              aria-label="번역할 언어 (결과를 받고 싶은 언어)"
              className="rounded-sm border border-line bg-paper-card px-2 py-1.5 text-foreground outline-none focus:border-accent"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="label-tag self-center">예문으로 체험:</span>
          {EXAMPLE_SENTENCES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onInputTextChange(example)}
              className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent"
            >
              {example}
            </button>
          ))}
        </div>

        <textarea
          value={inputText}
          onChange={(e) => onInputTextChange(e.target.value)}
          placeholder="번역할 문장을 입력하세요. 예: 안녕하세요, 오늘 날씨가 좋네요"
          aria-label="번역할 문장 입력"
          rows={3}
          className="w-full resize-none rounded-sm border border-line bg-paper-card p-3 font-serif text-sm text-foreground outline-none focus:border-accent"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTranslate}
            disabled={isTranslating}
            className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTranslating ? "번역 중..." : "번역하기"}
          </button>
          {translateError && <p className="font-mono text-xs text-red-700">{translateError}</p>}
        </div>
      </section>

      <section className="flex flex-col gap-4 self-start">
        {ENGINE_CONFIG.map((engine, index) => (
          <EngineCard
            key={engine.id}
            label={engine.label}
            index={index}
            enabled={enabled[engine.id]}
            state={enabled[engine.id] ? cardStates[engine.id] : { status: "off" }}
            isSelected={selectedEngineIds.has(engine.id)}
            onToggleEnabled={() => onToggleEnabled(engine.id)}
            onSelect={() => onSelect(engine.id)}
          />
        ))}
      </section>
      </div>

    </div>
  );
}
