"use client";

export type CardState =
  | { status: "off" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string; model?: string }
  | { status: "error"; error: string };

interface EngineCardProps {
  label: string;
  enabled: boolean;
  state: CardState;
  isSelected: boolean;
  onToggleEnabled: () => void;
  onSelect: () => void;
}

export function EngineCard({ label, enabled, state, isSelected, onToggleEnabled, onSelect }: EngineCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
        isSelected
          ? "border-blue-600 ring-2 ring-blue-500/40 bg-blue-50 dark:bg-blue-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
          {isSelected && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
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
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="min-h-[4.5rem] text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {!enabled && <p className="text-zinc-400 dark:text-zinc-600">꺼짐 — 호출하지 않음</p>}
        {enabled && state.status === "idle" && <p className="text-zinc-400">번역 대기 중</p>}
        {enabled && state.status === "loading" && (
          <div className="flex animate-pulse flex-col gap-2">
            <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-4/6 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        )}
        {enabled && state.status === "error" && (
          <p className="text-red-600 dark:text-red-400">오류: {state.error}</p>
        )}
        {enabled && state.status === "done" && (
          <div>
            <p className="whitespace-pre-wrap">{state.text}</p>
            {state.model && (
              <p className="mt-1 text-xs text-zinc-400">모델: {state.model}</p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!enabled || state.status !== "done"}
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={isSelected ? `${label} 번역 선택됨, 클릭하면 선택 해제` : `${label} 번역 선택 (다른 엔진도 함께 선택 가능)`}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isSelected
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        }`}
      >
        {isSelected ? "✓ 선택됨 (클릭 시 취소)" : "이 번역 선택 (여러 개 가능)"}
      </button>
    </div>
  );
}
