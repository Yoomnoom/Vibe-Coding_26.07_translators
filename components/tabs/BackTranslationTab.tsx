"use client";

import { TabEmptyNotice } from "@/components/TabEmptyNotice";

export interface BackTranslateItemView {
  engineId: string;
  label: string;
  /** 기본 비교 탭에서 나온 번역 결과 (역번역 대상 원문) */
  text: string;
}

export interface BackTranslateResultView {
  backText?: string;
  error?: string;
  /** 실제로 역번역을 수행한 엔진, 예: "DeepL" / "Gemini (DeepL 실패)" */
  provider?: string;
}

export type BackTranslateRunState =
  | { status: "idle" }
  | { status: "loading"; items: BackTranslateItemView[] }
  | { status: "done"; items: BackTranslateItemView[]; results: Record<string, BackTranslateResultView> }
  | { status: "error"; error: string; items?: BackTranslateItemView[] };

interface BackTranslationTabProps {
  /** "기본 비교" 탭에서 번역 요청 시점의 원문 (translatedText) */
  originalText: string;
  runState: BackTranslateRunState;
  /** 지금 cardStates 스냅샷으로 다시 역번역을 요청한다 (버튼을 눌러야만 호출됨 — 자동 실행 없음) */
  onRun: () => void;
  onGoToBasicTab: () => void;
}

// PRD.md §7 ②번 "역번역 체크" 실제 구현.
// 예전 배틀 뷰(어절 겹침 기반 "일치율")를 역번역에도 그대로 재사용했던 이전 버전은
// 어순만 달라도 낮은 점수가 나오는 등 나이브한 지표라는 게 실사용으로 확인되어 폐기했다.
// 이번 버전은 자동 점수/배지를 만들지 않고, 원문 → 번역 결과 → 역번역 결과 3단을 나란히 보여줘
// 사람이 직접 눈으로 판단하게 한다. 역번역 자체도 엔진별로 개별 호출하지 않고, 성공한 번역 결과
// 전체를 한 번에 "역번역 담당 엔진" 1곳(DeepL → Gemini → Groq 순 폴백, lib/backTranslate.ts)에
// 몰아서 딱 1번의 API 호출로 처리해 할당량을 아낀다.
export function BackTranslationTab({ originalText, runState, onRun, onGoToBasicTab }: BackTranslationTabProps) {
  if (runState.status === "idle") {
    return (
      <TabEmptyNotice
        text={'\'결과 비교\'에서 번역을 실행한 뒤 "전체 결과 역번역으로 검증 →" 버튼을 눌러주세요.'}
        onGoToBasicTab={onGoToBasicTab}
      />
    );
  }

  if (runState.status === "error" && !runState.items) {
    return (
      <div className="flex flex-col gap-4">
        <div className="blueprint-panel p-4">
          <p className="font-mono text-xs text-red-700">{runState.error}</p>
        </div>
        <button
          type="button"
          onClick={onGoToBasicTab}
          className="self-start rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark"
        >
          결과 비교로 이동
        </button>
      </div>
    );
  }

  const items = runState.items ?? [];
  const isLoading = runState.status === "loading";
  const results = runState.status === "done" ? runState.results : {};

  // 배치 호출이라 provider는 모든 항목이 동일 — 첫 성공 항목에서 하나만 뽑아 상단에 표시한다.
  const providerLabel = Object.values(results).find((r) => r.provider)?.provider ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="blueprint-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="label-tag">원문 → 번역 → 역번역</span>
          {providerLabel && (
            <span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-foreground/60">
              역번역: {providerLabel}
            </span>
          )}
          {runState.status === "error" && (
            <span className="font-mono text-xs text-red-700">역번역 요청 실패: {runState.error}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={isLoading}
          className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "역번역 확인 중..." : "다시 확인"}
        </button>
      </div>

      <p className="font-mono text-xs leading-relaxed text-foreground/60">
        자동으로 계산한 점수는 없습니다. 원문과 역번역 결과를 직접 비교해 의미가 통하는지 눈으로 판단하세요.
      </p>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const result = results[item.engineId];
          return (
            <div key={item.engineId} className="blueprint-panel p-4">
              <p className="label-tag mb-2">{item.label}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="label-tag mb-1 text-foreground/40">원문</p>
                  <p className="font-serif text-sm leading-relaxed text-foreground/80">{originalText}</p>
                </div>
                <div>
                  <p className="label-tag mb-1 text-foreground/40">번역 결과</p>
                  <p className="font-serif text-sm leading-relaxed text-foreground/80">{item.text}</p>
                </div>
                <div>
                  <p className="label-tag mb-1 text-foreground/40">역번역 결과</p>
                  {isLoading && (
                    <div className="flex animate-pulse flex-col gap-2">
                      <div className="h-3 w-5/6 rounded bg-line/50" />
                      <div className="h-3 w-4/6 rounded bg-line/50" />
                    </div>
                  )}
                  {!isLoading && result?.error && <p className="font-mono text-xs text-red-700">오류: {result.error}</p>}
                  {!isLoading && result?.backText && (
                    <p className="font-serif text-sm leading-relaxed text-foreground/80">{result.backText}</p>
                  )}
                  {!isLoading && !result && (
                    <p className="font-mono text-xs text-foreground/40">결과 없음</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
