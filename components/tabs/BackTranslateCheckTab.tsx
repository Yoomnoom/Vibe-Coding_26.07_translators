"use client";

import { useState } from "react";
import { ENGINE_CONFIG, EngineId } from "@/lib/engines/config";
import type { CardState } from "@/components/EngineCard";
import type { LanguageCode } from "@/lib/engines/types";
import { TabEmptyNotice } from "@/components/TabEmptyNotice";
import { computeBattleView, VERDICT_MARK, VERDICT_STYLE, VERDICT_TITLE, type WordVerdict } from "@/lib/battleView";

interface BackTranslateCheckTabProps {
  /** "기본 비교" 탭에서 번역 요청 시점의 원문 (translatedText) */
  originalText: string;
  /** 역번역 대상 언어. sourceLang이 "auto"였다면 감지된 언어, 감지 전이면 null (역번역 불가) */
  resolvedSourceLang: LanguageCode | null;
  /** 현재 번역 결과들이 담긴 언어 (역번역 호출의 sourceLang이 됨) */
  targetLang: LanguageCode;
  selectedEngineIds: Set<EngineId>;
  cardStates: Record<EngineId, CardState>;
  /** "기본 비교" 탭으로 바로 이동시키는 콜백 — 준비 안 된 상태일 때 안내 문구만 보여주지 않고 실제로 이동할 수 있게 함 */
  onGoToBasicTab: () => void;
}

type BackTranslateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; backText: string; matchRate: number; verdicts: WordVerdict[]; words: string[] }
  | { status: "error"; error: string };

// PRD.md §7 ②번 "역번역 체크" 실제 구현.
// 선택된 번역 결과를 원언어로 다시 번역(같은 엔진으로 역방향 1회 호출)한 뒤,
// 새 API 호출 없이 이미 있는 어절 비교 로직(lib/battleView.ts)을 원문 vs 역번역문 2-way 비교에 재사용해
// 의미 보존율(%)을 계산한다.
export function BackTranslateCheckTab({
  originalText,
  resolvedSourceLang,
  targetLang,
  selectedEngineIds,
  cardStates,
  onGoToBasicTab,
}: BackTranslateCheckTabProps) {
  const [results, setResults] = useState<Record<string, BackTranslateState>>({});
  const [isRunning, setIsRunning] = useState(false);

  if (!originalText) {
    return <TabEmptyNotice text="먼저 '기본 비교' 탭에서 번역을 실행해주세요." onGoToBasicTab={onGoToBasicTab} />;
  }

  const selectedDoneEngines = ENGINE_CONFIG.filter(
    (e) => selectedEngineIds.has(e.id) && cardStates[e.id]?.status === "done"
  );

  if (selectedDoneEngines.length === 0) {
    return (
      <TabEmptyNotice
        text={
          '\'기본 비교\' 탭에서 카드 하단의 "이 번역 선택" 버튼을 눌러 역번역을 확인할 결과를 먼저 골라주세요.'
        }
        onGoToBasicTab={onGoToBasicTab}
      />
    );
  }

  if (!resolvedSourceLang) {
    return (
      <TabEmptyNotice
        text="원본 언어를 확인할 수 없어 역번역할 수 없습니다. (자동 감지 전이거나 감지에 실패했어요)"
        onGoToBasicTab={onGoToBasicTab}
      />
    );
  }

  const handleRun = async () => {
    setIsRunning(true);
    setResults(() =>
      Object.fromEntries(selectedDoneEngines.map((e) => [e.id, { status: "loading" as const }]))
    );

    await Promise.all(
      selectedDoneEngines.map(async (engine) => {
        const state = cardStates[engine.id];
        if (state.status !== "done") return;

        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: state.text,
              sourceLang: targetLang,
              targetLang: resolvedSourceLang,
              enabledEngines: [engine.id],
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            setResults((prev) => ({
              ...prev,
              [engine.id]: { status: "error", error: data?.error ?? "역번역 요청 중 오류가 발생했습니다." },
            }));
            return;
          }

          const result = data.results?.[engine.id] as { text?: string; error?: string } | undefined;
          if (!result?.text) {
            setResults((prev) => ({
              ...prev,
              [engine.id]: { status: "error", error: result?.error ?? "역번역 결과가 없습니다." },
            }));
            return;
          }

          const compared = computeBattleView([
            { id: "original", label: "원문", text: originalText },
            { id: "backtranslated", label: "역번역", text: result.text },
          ]);
          const backtranslated = compared.engines.find((e) => e.id === "backtranslated");

          setResults((prev) => ({
            ...prev,
            [engine.id]: {
              status: "done",
              backText: result.text as string,
              matchRate: compared.matchRate,
              verdicts: compared.verdicts,
              words: backtranslated?.words ?? [],
            },
          }));
        } catch (err) {
          console.error("역번역 요청 실패:", err);
          setResults((prev) => ({
            ...prev,
            [engine.id]: { status: "error", error: "서버와 통신 중 문제가 발생했습니다." },
          }));
        }
      })
    );

    setIsRunning(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="blueprint-panel flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning}
          className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? "역번역 확인 중..." : "역번역 확인"}
        </button>
        <span className="font-mono text-xs text-foreground/50">
          선택된 {selectedDoneEngines.length}개 번역을 원문 언어로 다시 번역해 의미 보존율을 계산합니다.
        </span>
      </div>

      <div className="blueprint-panel p-4">
        <p className="label-tag mb-2">원문</p>
        <p className="font-serif text-sm leading-relaxed text-foreground/80">{originalText}</p>
      </div>

      <div className="flex flex-col gap-3">
        {selectedDoneEngines.map((engine) => {
          const state = results[engine.id] ?? { status: "idle" as const };
          return (
            <div key={engine.id} className="blueprint-panel p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="label-tag">{engine.label}</p>
                {state.status === "done" && (
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                      state.matchRate >= 70
                        ? "bg-emerald-100 text-emerald-800"
                        : state.matchRate >= 40
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    의미 보존율 {state.matchRate}%
                  </span>
                )}
              </div>

              {state.status === "idle" && (
                <p className="font-mono text-xs text-foreground/40">"역번역 확인" 버튼을 눌러 확인하세요.</p>
              )}
              {state.status === "loading" && (
                <div className="flex animate-pulse flex-col gap-2">
                  <div className="h-3 w-5/6 rounded bg-line/50" />
                  <div className="h-3 w-4/6 rounded bg-line/50" />
                </div>
              )}
              {state.status === "error" && <p className="font-mono text-xs text-red-700">오류: {state.error}</p>}
              {state.status === "done" && (
                <p className="font-serif text-sm leading-relaxed text-foreground/80">
                  {state.words.map((word, i) => {
                    const verdict = state.verdicts[i];
                    return (
                      <span key={i}>
                        <span
                          title={verdict ? VERDICT_TITLE[verdict] : "구조가 달라 비교하지 않음"}
                          className={`rounded px-0.5 ${verdict ? VERDICT_STYLE[verdict] : "italic text-foreground/30"}`}
                        >
                          {verdict && VERDICT_MARK[verdict] && (
                            <span aria-hidden className="mr-0.5 text-[0.7em]">
                              {VERDICT_MARK[verdict]}
                            </span>
                          )}
                          {word}
                        </span>{" "}
                      </span>
                    );
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
