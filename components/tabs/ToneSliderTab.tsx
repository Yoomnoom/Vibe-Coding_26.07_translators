"use client";

import { useEffect, useRef, useState } from "react";
import {
  ENGINE_CONFIG,
  EngineId,
  SOURCE_LANGUAGE_OPTIONS,
  SUPPORTED_LANGUAGES,
  TONE_OPTIONS,
  TONE_SUPPORTED_ENGINE_IDS,
} from "@/lib/engines/config";
import type { LanguageCode, SourceLanguageCode, ToneId } from "@/lib/engines/types";
import type { CardState } from "@/components/EngineCard";

// 톤별로 다른 결과가 나오는 건 LLM 3종(TONE_SUPPORTED_ENGINE_IDS)뿐이라, 결과는 엔진별로
// "선택된 톤 → 결과" 맵을 갖는다.
export type ToneCardStateMap = Record<EngineId, Partial<Record<ToneId, CardState>>>;

interface ToneSliderTabProps {
  sourceLang: SourceLanguageCode;
  detectedSourceLang: LanguageCode | null;
  targetLang: LanguageCode;
  onSourceLangChange: (lang: SourceLanguageCode) => void;
  onTargetLangChange: (lang: LanguageCode) => void;
  onSwapLangs: () => void;

  inputText: string;
  onInputTextChange: (text: string) => void;
  /** 여러 톤을 동시에 선택해 결과를 나란히 비교할 수 있다. */
  selectedTones: ToneId[];
  onToggleTone: (tone: ToneId) => void;
  onTranslate: () => void;
  onClearTranslation: () => void;
  isTranslating: boolean;
  translateError: string | null;

  /** "결과 비교"와 켜기끄기/순서 상태를 공유하지만, 톤을 반영할 수 있는 LLM 3종만 이 탭에 표시한다. */
  enabled: Record<EngineId, boolean>;
  onToggleEnabled: (id: EngineId) => void;
  cardStates: ToneCardStateMap;
  engineOrder: EngineId[];
  isEngineOrderLocked: boolean;
  onToggleEngineOrderLocked: () => void;
  onReorderEngine: (fromIndex: number, toIndex: number) => void;

  /** 성공한(status === "done") 결과가 1개 이상 있는지 — "전체 결과 역번역으로 검증" 버튼 표시 조건 */
  hasDoneTranslation: boolean;
  /** "② 역번역 체크" 탭으로 전환하면서 그 시점 성공한 결과들로 역번역 요청을 트리거하는 콜백 */
  onGoToBackTranslate: () => void;
}

// PRD.md §7 ⑥번 "문맥 슬라이더".
// 처음엔 톤을 하나만 골라 재번역하는 단일 선택이었으나, "체크한 항목을 다 보고 싶다, 하나만 보이니
// 비교하기 불편하다"는 피드백으로 **톤 다중 선택**으로 바꿈 — 선택한 톤마다 결과를 한 카드 안에
// 나란히 쌓아서 보여준다(반말/격식체/비즈니스체 동시 비교 가능). DeepL/MyMemory는 프롬프트로 톤을
// 지시할 수 없는 고정 API라 tone을 무시하고 항상 같은 결과를 내므로, 그 결과를 선택된 톤 전부에
// 복제해 넣어(app/page.tsx) 카드 렌더링 쪽에서 특별 취급하지 않아도 되게 했다.
export function ToneSliderTab({
  sourceLang,
  detectedSourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLangs,
  inputText,
  onInputTextChange,
  selectedTones,
  onToggleTone,
  onTranslate,
  onClearTranslation,
  isTranslating,
  translateError,
  enabled,
  onToggleEnabled,
  cardStates,
  engineOrder,
  isEngineOrderLocked,
  onToggleEngineOrderLocked,
  onReorderEngine,
  hasDoneTranslation,
  onGoToBackTranslate,
}: ToneSliderTabProps) {
  // DeepL/MyMemory는 톤을 반영할 수 없는 고정 API라 이 탭에서는 아예 안 보여준다
  // ("지원 안 되는 걸 뭐하러 두냐"는 피드백, 2026-08-05).
  const visibleEngineOrder = engineOrder.filter((id) => TONE_SUPPORTED_ENGINE_IDS.includes(id));
  const allEngineEnabled = visibleEngineOrder.every((id) => enabled[id]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleToggleAll = () => {
    const target = !allEngineEnabled;
    for (const id of visibleEngineOrder) {
      if (enabled[id] !== target) onToggleEnabled(id);
    }
  };

  // BasicCompareTab과 동일한 방식: scrollHeight를 실측해 최소 5줄~최대 10줄 사이로 입력창 높이를 맞춘다.
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = inputTextareaRef.current;
    if (!el) return;
    el.rows = 1;
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const lines = Math.ceil((el.scrollHeight - verticalPadding) / lineHeight);
    el.rows = Math.min(10, Math.max(5, lines));
  }, [inputText]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs leading-relaxed text-foreground/60">
          문장을 붙여넣고 <strong className="text-accent">반말 ↔ 격식체 ↔ 비즈니스체</strong> 톤을 골라 번역해보세요.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onClearTranslation}
            title="입력과 번역 결과 지우기"
            aria-label="입력과 번역 결과 지우기"
            className="rounded-sm border border-line px-2.5 py-2 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent"
          >
            🧹 지우기
          </button>
          <button
            type="button"
            onClick={handleToggleAll}
            title={allEngineEnabled ? "모든 번역 엔진 끄기" : "모든 번역 엔진 켜기"}
            aria-label={allEngineEnabled ? "모든 번역 엔진 끄기" : "모든 번역 엔진 켜기"}
            role="switch"
            aria-checked={allEngineEnabled}
            className={`flex items-center gap-2 rounded-sm border border-line px-2.5 py-2 font-mono text-xs text-foreground/50 transition-colors hover:border-accent hover:text-accent ${
              allEngineEnabled ? "text-accent" : ""
            }`}
          >
            전체
            <span
              className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                allEngineEnabled ? "bg-accent" : "bg-foreground/20"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-paper-card shadow transition-transform ${
                  allEngineEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </div>
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
            ref={inputTextareaRef}
            value={inputText}
            onChange={(e) => onInputTextChange(e.target.value)}
            placeholder="번역할 문장을 입력하세요. 예: 오늘 시간 되면 같이 밥 먹을래?"
            aria-label="번역할 문장 입력"
            rows={5}
            className="w-full resize-none rounded-sm border border-line bg-paper-card p-3 font-serif text-sm text-foreground outline-none focus:border-accent"
          />

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="label-tag">톤 선택 (여러 개 동시 선택 가능)</p>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((option) => {
                const isSelected = selectedTones.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onToggleTone(option.id)}
                    aria-pressed={isSelected}
                    className={`flex-1 rounded-sm border px-3 py-2 font-mono text-xs tracking-wide transition-colors ${
                      isSelected
                        ? "border-accent bg-accent text-paper-card"
                        : "border-line bg-transparent text-foreground/60 hover:border-accent hover:text-accent"
                    }`}
                  >
                    {isSelected ? "✓ " : ""}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

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
        </section>

        <section className="flex flex-col gap-4 self-start">
          {visibleEngineOrder.map((engineId, visibleIndex) => {
            const engine = ENGINE_CONFIG.find((e) => e.id === engineId);
            if (!engine) return null;
            const isEnabled = enabled[engine.id];
            // 드래그 순서 변경은 "결과 비교"와 공유하는 전체 engineOrder(5개) 기준 인덱스로 해야 하지만,
            // 화면에 보이는 번호(ENGINE 0X)는 이 탭에 실제로 보이는 3개만 기준으로 다시 매긴다.
            const actualIndex = engineOrder.indexOf(engineId);

            return (
              <div
                key={engine.id}
                draggable={!isEngineOrderLocked}
                onDragStart={() => setDraggedIndex(actualIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedIndex !== null) onReorderEngine(draggedIndex, actualIndex);
                  setDraggedIndex(null);
                }}
                className={`blueprint-panel flex flex-col gap-3 p-4 transition-colors ${
                  draggedIndex === actualIndex ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!isEngineOrderLocked && (
                      <span
                        className="cursor-grab select-none text-foreground/40 active:cursor-grabbing"
                        aria-hidden="true"
                        title="드래그해서 순서 변경"
                      >
                        ⠿
                      </span>
                    )}
                    <span className="label-tag">ENGINE {String(visibleIndex + 1).padStart(2, "0")}</span>
                    <span className="font-serif font-semibold text-foreground">{engine.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleEnabled(engine.id)}
                    aria-pressed={isEnabled}
                    aria-label={`${engine.label} 엔진 ${isEnabled ? "끄기" : "켜기"}`}
                    title={isEnabled ? `${engine.label} 끄기 (호출하지 않음)` : `${engine.label} 켜기 (호출 대상에 포함)`}
                    className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                      isEnabled ? "border-accent bg-accent" : "border-line bg-transparent"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow transition-transform ${
                        isEnabled ? "translate-x-[18px] bg-paper-card" : "translate-x-0 bg-line"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {!isEnabled && <p className="font-mono text-xs text-foreground/40">꺼짐 — 호출하지 않음</p>}
                  {isEnabled && selectedTones.length === 0 && (
                    <p className="font-mono text-xs text-foreground/40">위에서 톤을 하나 이상 선택하세요.</p>
                  )}
                  {isEnabled &&
                    // 클릭한 순서가 아니라 TONE_OPTIONS의 고정 순서(반말→격식체→비즈니스체)대로 보여준다.
                    TONE_OPTIONS.filter((option) => selectedTones.includes(option.id)).map(({ id: toneId, label: toneLabel }) => {
                      const state = cardStates[engine.id]?.[toneId];
                      return (
                        <div key={toneId} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                          <p className="label-tag mb-1 text-foreground/40">{toneLabel}</p>
                          <div className="min-h-[3rem] font-serif text-sm leading-relaxed text-foreground/80">
                            {(!state || state.status === "idle") && (
                              <p className="font-mono text-xs text-foreground/40">번역 대기 중</p>
                            )}
                            {state?.status === "loading" && (
                              <div className="flex animate-pulse flex-col gap-2">
                                <div className="h-3 w-5/6 rounded bg-line/50" />
                                <div className="h-3 w-4/6 rounded bg-line/50" />
                              </div>
                            )}
                            {state?.status === "error" && (
                              <p className="font-mono text-xs text-red-700">오류: {state.error}</p>
                            )}
                            {state?.status === "done" && <p className="whitespace-pre-wrap">{state.text}</p>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onToggleEngineOrderLocked}
            title={isEngineOrderLocked ? "순서 고정 해제 (드래그로 순서 변경 가능)" : "순서 고정하기"}
            aria-pressed={!isEngineOrderLocked}
            className="flex w-fit items-center gap-1.5 self-end rounded-sm border border-line px-2.5 py-1.5 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent"
          >
            {isEngineOrderLocked ? "📌 순서 고정됨" : "🔓 순서 변경 중 (드래그해서 옮기세요)"}
          </button>
        </section>
      </div>
    </div>
  );
}
