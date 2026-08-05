"use client";

import type { DragEvent } from "react";

export type CardState =
  | { status: "off" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string; model?: string }
  | { status: "error"; error: string };

interface EngineCardProps {
  label: string;
  index: number;
  enabled: boolean;
  state: CardState;
  isSelected: boolean;
  onToggleEnabled: () => void;
  /** 생략하면(문맥 슬라이더처럼 노션 저장 선택 개념이 없는 화면) "이 번역 선택" 버튼 자체를 렌더링하지 않는다. */
  onSelect?: () => void;
  /** 순서 고정이 풀렸을 때만 true — 카드를 마우스로 드래그해 순서를 바꿀 수 있게 한다. */
  isOrderUnlocked: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: () => void;
  isDragging?: boolean;
}

export function EngineCard({
  label,
  index,
  enabled,
  state,
  isSelected,
  onToggleEnabled,
  onSelect,
  isOrderUnlocked,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: EngineCardProps) {
  return (
    <div
      draggable={isOrderUnlocked}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`blueprint-panel flex flex-col gap-3 p-4 transition-colors ${
        isSelected ? "border-accent ring-1 ring-accent bg-accent-soft/40" : ""
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOrderUnlocked && (
            <span
              className="cursor-grab select-none text-foreground/40 active:cursor-grabbing"
              aria-hidden="true"
              title="드래그해서 순서 변경"
            >
              ⠿
            </span>
          )}
          <span className="label-tag">ENGINE {String(index + 1).padStart(2, "0")}</span>
          <span className="font-serif font-semibold text-foreground">{label}</span>
          {isSelected && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-paper-card">
              ✓
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleEnabled}
          aria-pressed={enabled}
          aria-label={`${label} 엔진 ${enabled ? "끄기" : "켜기"}`}
          title={enabled ? `${label} 끄기 (호출하지 않음)` : `${label} 켜기 (호출 대상에 포함)`}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            enabled ? "border-accent bg-accent" : "border-line bg-transparent"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow transition-transform ${
              enabled ? "translate-x-[18px] bg-paper-card" : "translate-x-0 bg-line"
            }`}
          />
        </button>
      </div>

      <div className="min-h-[4.5rem] font-serif text-sm leading-relaxed text-foreground/80">
        {!enabled && <p className="font-mono text-xs text-foreground/40">꺼짐 — 호출하지 않음</p>}
        {enabled && state.status === "idle" && <p className="font-mono text-xs text-foreground/40">번역 대기 중</p>}
        {enabled && state.status === "loading" && (
          <div className="flex animate-pulse flex-col gap-2">
            <div className="h-3 w-5/6 rounded bg-line/50" />
            <div className="h-3 w-4/6 rounded bg-line/50" />
          </div>
        )}
        {enabled && state.status === "error" && <p className="font-mono text-xs text-red-700">오류: {state.error}</p>}
        {enabled && state.status === "done" && (
          <div>
            <p className="whitespace-pre-wrap">{state.text}</p>
            {state.model && <p className="label-tag mt-1">MODEL → {state.model}</p>}
          </div>
        )}
      </div>

      {onSelect && (
        <button
          type="button"
          disabled={!enabled || state.status !== "done"}
          onClick={onSelect}
          aria-pressed={isSelected}
          aria-label={
            isSelected ? `${label} 번역 선택됨, 클릭하면 선택 해제` : `${label} 번역 선택 (다른 엔진도 함께 선택 가능)`
          }
          className={`rounded-sm border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isSelected
              ? "border-accent bg-accent text-paper-card hover:bg-accent-dark"
              : "border-line bg-transparent text-foreground/60 hover:border-accent hover:text-accent"
          }`}
        >
          {isSelected ? "✓ 선택됨 (클릭 시 취소)" : "이 번역 선택 (여러 개 가능)"}
        </button>
      )}
    </div>
  );
}
