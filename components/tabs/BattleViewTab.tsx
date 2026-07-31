"use client";

import { ENGINE_CONFIG, EngineId } from "@/lib/engines/config";
import type { CardState } from "@/components/EngineCard";
import { TabEmptyNotice } from "@/components/TabEmptyNotice";
import { computeBattleView, VERDICT_MARK, VERDICT_STYLE, VERDICT_TITLE } from "@/lib/battleView";

interface BattleViewTabProps {
  /** "기본 비교" 탭에서 번역을 한 번이라도 실행했는지 판단하는 값 (번역 요청 시점 원문) */
  translatedText: string;
  cardStates: Record<EngineId, CardState>;
  /** "기본 비교" 탭으로 바로 이동시키는 콜백 */
  onGoToBasicTab: () => void;
}

// PRD.md §7 ①번 "번역 신뢰도 배틀 뷰" 실제 구현.
// 새 API 호출 없이 "기본 비교" 탭에서 이미 받아온 번역 결과를 어절 단위로 비교해
// 일치/소수 의견/완전 불일치 구간을 하이라이트로 보여준다.
export function BattleViewTab({ translatedText, cardStates, onGoToBasicTab }: BattleViewTabProps) {
  if (!translatedText) {
    return <TabEmptyNotice text="먼저 '기본 비교' 탭에서 번역을 실행해주세요." onGoToBasicTab={onGoToBasicTab} />;
  }

  const successfulEntries = ENGINE_CONFIG.filter((engine) => cardStates[engine.id]?.status === "done").map(
    (engine) => {
      const state = cardStates[engine.id] as { status: "done"; text: string; model?: string };
      return { id: engine.id, label: engine.label, text: state.text };
    }
  );

  if (successfulEntries.length < 2) {
    return (
      <TabEmptyNotice
        text={`비교할 결과가 2개 이상 필요합니다. (현재 성공한 번역 결과 ${successfulEntries.length}개)`}
        onGoToBasicTab={onGoToBasicTab}
      />
    );
  }

  const result = computeBattleView(successfulEntries);

  return (
    <div className="flex flex-col gap-4">
      <div className="blueprint-panel flex flex-wrap items-center gap-3 p-4">
        <span
          className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${
            result.matchRate >= 70
              ? "bg-emerald-100 text-emerald-800"
              : result.matchRate >= 40
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          일치율 {result.matchRate}%
        </span>
        <span className="font-mono text-xs text-foreground/50">
          {result.matchCount} / {result.comparedLength} 어절 일치 (성공한 엔진 {successfulEntries.length}개 비교)
        </span>
        <div className="flex items-center gap-3 font-mono text-xs text-foreground/40">
          <span>
            <span className="rounded bg-yellow-200/70 px-1 underline decoration-yellow-600">▲</span>{" "}
            소수 의견
          </span>
          <span>
            <span className="rounded bg-red-200/70 px-1 font-bold underline decoration-wavy decoration-red-600">
              ✕
            </span>{" "}
            완전 불일치
          </span>
        </div>
      </div>

      {result.truncated && (
        <p className="font-mono text-xs text-foreground/40">
          엔진마다 어절 수가 달라 {result.comparedLength}번째 어절 이후로는 구조가 달라 비교하지 않았습니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {result.engines.map((engine) => (
          <div key={engine.id} className="blueprint-panel p-4">
            <p className="label-tag mb-2">{engine.label}</p>
            <p className="font-serif text-sm leading-relaxed text-foreground/80">
              {engine.words.map((word, i) => {
                const compared = i < result.comparedLength;
                const verdict = compared ? result.verdicts[i] : null;
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
          </div>
        ))}
      </div>
    </div>
  );
}
