"use client";

import { ENGINE_CONFIG, EngineId } from "@/lib/engines/config";
import type { CardState } from "@/components/EngineCard";
import { computeBattleView, type WordVerdict } from "@/lib/battleView";

interface BattleViewTabProps {
  /** "기본 비교" 탭에서 번역을 한 번이라도 실행했는지 판단하는 값 (번역 요청 시점 원문) */
  translatedText: string;
  cardStates: Record<EngineId, CardState>;
}

const VERDICT_STYLE: Record<WordVerdict, string> = {
  match: "",
  minority:
    "bg-yellow-200/70 text-yellow-900 underline decoration-yellow-600 decoration-2 underline-offset-2 dark:bg-yellow-900/50 dark:text-yellow-200",
  mismatch:
    "bg-red-200/70 text-red-900 font-bold underline decoration-wavy decoration-red-600 decoration-2 underline-offset-2 dark:bg-red-900/50 dark:text-red-200",
};

const VERDICT_MARK: Record<WordVerdict, string> = {
  match: "",
  minority: "▲",
  mismatch: "✕",
};

const VERDICT_TITLE: Record<WordVerdict, string> = {
  match: "일치",
  minority: "소수 의견 — 일부 엔진만 다름",
  mismatch: "완전 불일치",
};

function EmptyNotice({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      {text}
    </div>
  );
}

// PRD.md §7 ①번 "번역 신뢰도 배틀 뷰" 실제 구현.
// 새 API 호출 없이 "기본 비교" 탭에서 이미 받아온 번역 결과를 어절 단위로 비교해
// 일치/소수 의견/완전 불일치 구간을 하이라이트로 보여준다.
export function BattleViewTab({ translatedText, cardStates }: BattleViewTabProps) {
  if (!translatedText) {
    return <EmptyNotice text="먼저 '기본 비교' 탭에서 번역을 실행해주세요." />;
  }

  const successfulEntries = ENGINE_CONFIG.filter((engine) => cardStates[engine.id]?.status === "done").map(
    (engine) => {
      const state = cardStates[engine.id] as { status: "done"; text: string; model?: string };
      return { id: engine.id, label: engine.label, text: state.text };
    }
  );

  if (successfulEntries.length < 2) {
    return (
      <EmptyNotice
        text={`비교할 결과가 2개 이상 필요합니다. (현재 성공한 번역 결과 ${successfulEntries.length}개)`}
      />
    );
  }

  const result = computeBattleView(successfulEntries);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            result.matchRate >= 70
              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
              : result.matchRate >= 40
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
                : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
          }`}
        >
          일치율 {result.matchRate}%
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {result.matchCount} / {result.comparedLength} 어절 일치 (성공한 엔진 {successfulEntries.length}개 비교)
        </span>
        <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>
            <span className="rounded bg-yellow-200/70 px-1 underline decoration-yellow-600 dark:bg-yellow-900/50">
              ▲
            </span>{" "}
            소수 의견
          </span>
          <span>
            <span className="rounded bg-red-200/70 px-1 font-bold underline decoration-wavy decoration-red-600 dark:bg-red-900/50">
              ✕
            </span>{" "}
            완전 불일치
          </span>
        </div>
      </div>

      {result.truncated && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          엔진마다 어절 수가 달라 {result.comparedLength}번째 어절 이후로는 구조가 달라 비교하지 않았습니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {result.engines.map((engine) => (
          <div
            key={engine.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{engine.label}</p>
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {engine.words.map((word, i) => {
                const compared = i < result.comparedLength;
                const verdict = compared ? result.verdicts[i] : null;
                return (
                  <span key={i}>
                    <span
                      title={verdict ? VERDICT_TITLE[verdict] : "구조가 달라 비교하지 않음"}
                      className={`rounded px-0.5 ${
                        verdict ? VERDICT_STYLE[verdict] : "italic text-zinc-400 dark:text-zinc-600"
                      }`}
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
          </div>
        ))}
      </div>
    </div>
  );
}
