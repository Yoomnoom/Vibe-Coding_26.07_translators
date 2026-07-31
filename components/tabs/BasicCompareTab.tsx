"use client";

import { ENGINE_CONFIG, EngineId, SUPPORTED_LANGUAGES } from "@/lib/engines/config";
import type { LanguageCode } from "@/lib/engines/types";
import { EngineCard, CardState } from "@/components/EngineCard";
import type { TranslationHistoryEntry } from "@/lib/history";

export type SaveState = "idle" | "saving" | "success" | "error";

interface BasicCompareTabProps {
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  onSourceLangChange: (lang: LanguageCode) => void;
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
}

const PREVIEW_LENGTH = 40;

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

// 기존 app/page.tsx에 있던 "기본 비교" 화면 전체를 그대로 옮긴 컴포넌트.
// 상태는 app/page.tsx(최상위)에서 유지하고, 이 컴포넌트는 props로 받아 렌더링만 담당한다
// — 탭을 옮겨도 입력/번역 결과가 사라지지 않도록 하기 위함 (PRD.md §7).
export function BasicCompareTab({
  sourceLang,
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
}: BasicCompareTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500 dark:text-zinc-400">원본 언어</span>
            <select
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value as LanguageCode)}
              aria-label="원본 언어 (번역할 문장이 작성된 언어)"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onSwapLangs}
            aria-label="원본 언어와 번역 언어 서로 바꾸기"
            title="원본 언어와 번역 언어 서로 바꾸기"
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ⇄
          </button>
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500 dark:text-zinc-400">번역할 언어</span>
            <select
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value as LanguageCode)}
              aria-label="번역할 언어 (결과를 받고 싶은 언어)"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <textarea
          value={inputText}
          onChange={(e) => onInputTextChange(e.target.value)}
          placeholder="번역할 문장을 입력하세요. 예: 안녕하세요, 오늘 날씨가 좋네요"
          aria-label="번역할 문장 입력"
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTranslate}
            disabled={isTranslating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTranslating ? "번역 중..." : "번역하기"}
          </button>
          {translateError && <p className="text-sm text-red-600 dark:text-red-400">{translateError}</p>}
        </div>
      </section>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        마음에 드는 번역 결과를 카드에서{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">여러 개 동시에</strong> 선택할 수 있어요.
        선택한 카드는 파란 테두리와 체크 표시로 구분됩니다.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENGINE_CONFIG.map((engine) => (
          <EngineCard
            key={engine.id}
            label={engine.label}
            enabled={enabled[engine.id]}
            state={enabled[engine.id] ? cardStates[engine.id] : { status: "off" }}
            isSelected={selectedEngineIds.has(engine.id)}
            onToggleEnabled={() => onToggleEnabled(engine.id)}
            onSelect={() => onSelect(engine.id)}
          />
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onSaveToNotion}
          disabled={!canSave || saveState === "saving"}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saveState === "saving"
            ? "저장 중..."
            : `노션에 저장${selectedEngineIds.size > 0 ? ` (${selectedEngineIds.size}개 선택됨)` : ""}`}
        </button>
        {!canSave && saveDisabledReason && <p className="text-sm text-zinc-400">{saveDisabledReason}</p>}
        {saveMessage && (
          <p className={`text-sm ${saveState === "success" ? "text-green-600" : "text-red-600"}`}>
            {saveMessage}
            {saveState === "success" && savedPageUrl && (
              <>
                {" "}
                <a
                  href={savedPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
                >
                  노션에서 열기 →
                </a>
              </>
            )}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            최근 저장 기록{history.length > 0 ? ` (${history.length}개, 최근 20개까지)` : ""}
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              기록 전체 삭제
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 저장한 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((entry) => {
              const preview =
                entry.originalText.length > PREVIEW_LENGTH
                  ? `${entry.originalText.slice(0, PREVIEW_LENGTH)}…`
                  : entry.originalText;
              const engineLabels = entry.selectedResults.map((r) => r.label).join(", ");
              return (
                <li key={entry.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm text-zinc-700 marker:content-none dark:text-zinc-300">
                      <span className="font-medium">{preview}</span>
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {entry.sourceLang}→{entry.targetLang} · {engineLabels || "선택 없음"}
                      </span>
                      <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                        {formatSavedAt(entry.savedAt)}
                      </span>
                    </summary>
                    <div className="flex flex-col gap-2 border-t border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                      <div>
                        <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">원문</span>
                        <p className="text-zinc-700 dark:text-zinc-300">{entry.originalText}</p>
                      </div>
                      {entry.selectedResults.map((r) => (
                        <div key={r.engineId}>
                          <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{r.label}</span>
                          <p className="text-zinc-700 dark:text-zinc-300">{r.text}</p>
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
    </div>
  );
}
