"use client";

import { ENGINE_CONFIG, EngineId, SOURCE_LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } from "@/lib/engines/config";
import type { LanguageCode, SourceLanguageCode } from "@/lib/engines/types";
import { EngineCard, CardState } from "@/components/EngineCard";

export type SaveState = "idle" | "saving" | "success" | "error";

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
  /** 입력/번역 결과/선택/역번역 상태를 새로고침 없이 비운다. */
  onClearTranslation: () => void;
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

  /** 성공한(status === "done") 번역 결과가 1개 이상 있는지 — "전체 결과 역번역으로 검증" 버튼 표시 조건 */
  hasDoneTranslation: boolean;
  /** "② 역번역 체크" 탭으로 전환하면서 그 시점 성공한 결과들로 역번역 요청을 트리거하는 콜백 */
  onGoToBackTranslate: () => void;
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
  onClearTranslation,
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
  hasDoneTranslation,
  onGoToBackTranslate,
}: BasicCompareTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs leading-relaxed text-foreground/60">
          마음에 드는 번역 결과를 카드에서 <strong className="text-accent">여러 개 동시에</strong> 선택할 수 있어요. 선택한
          카드는 파란 테두리와 체크 표시로 구분됩니다.
        </p>
        <button
          type="button"
          onClick={onClearTranslation}
          title="입력과 번역 결과 지우기"
          aria-label="입력과 번역 결과 지우기"
          className="shrink-0 rounded-sm border border-line px-2.5 py-2 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
        >
          🧹 지우기
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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

        {sourceLang === "auto" && detectedSourceLang && (
          <span className="label-tag self-start rounded-full border border-line px-2 py-1 font-mono text-xs">
            감지됨 → {SUPPORTED_LANGUAGES.find((l) => l.code === detectedSourceLang)?.label ?? detectedSourceLang}
          </span>
        )}

        <textarea
          value={inputText}
          onChange={(e) => onInputTextChange(e.target.value)}
          placeholder="번역할 문장을 입력하세요. 예: 안녕하세요, 오늘 날씨가 좋네요"
          aria-label="번역할 문장 입력"
          rows={3}
          className="w-full resize-none rounded-sm border border-line bg-paper-card p-3 font-serif text-sm text-foreground outline-none focus:border-accent"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onTranslate}
            disabled={isTranslating}
            className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTranslating ? "번역 중..." : "번역하기"}
          </button>
          {hasDoneTranslation && (
            <button
              type="button"
              onClick={onGoToBackTranslate}
              title="성공한 번역 결과를 원문 언어로 되돌려 의미가 통하는지 확인"
              className="rounded-sm border border-line px-3 py-2 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent"
            >
              전체 결과 역번역으로 검증 →
            </button>
          )}
          {translateError && <p className="font-mono text-xs text-red-700">{translateError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={onSaveToNotion}
            disabled={!canSave || saveState === "saving"}
            className="rounded-sm border border-accent bg-accent-dark px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveState === "saving"
              ? "저장 중..."
              : `노션저장${selectedEngineIds.size > 0 ? ` (${selectedEngineIds.size}개 선택됨)` : ""}`}
          </button>
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
