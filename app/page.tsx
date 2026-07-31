"use client";

import { useEffect, useState } from "react";
import { ENGINE_CONFIG, EngineId } from "@/lib/engines/config";
import type { LanguageCode } from "@/lib/engines/types";
import { CardState } from "@/components/EngineCard";
import { BasicCompareTab } from "@/components/tabs/BasicCompareTab";
import { BattleViewTab } from "@/components/tabs/BattleViewTab";
import { ComingSoonTab } from "@/components/tabs/ComingSoonTab";
import { addHistoryEntry, clearHistory, HistorySelectedResult, loadHistory, TranslationHistoryEntry } from "@/lib/history";

type CardStateMap = Record<EngineId, CardState>;

function initialCardStates(): CardStateMap {
  return Object.fromEntries(ENGINE_CONFIG.map((e) => [e.id, { status: "idle" as const }])) as CardStateMap;
}

function initialEnabledMap(): Record<EngineId, boolean> {
  return Object.fromEntries(ENGINE_CONFIG.map((e) => [e.id, true])) as Record<EngineId, boolean>;
}

// 탭 구성 (PRD.md §7). "기본 비교"가 기본 선택값이고, 나머지는 특색 아이디어 탭이다.
// ①번(배틀 뷰)만 실제 구현, ②~⑥번은 ComingSoonTab 공용 placeholder를 재사용한다.
const TABS = [
  { id: "basic", label: "기본 비교" },
  { id: "battle", label: "① 번역 신뢰도 배틀 뷰" },
  { id: "backtranslate", label: "② 역번역 체크" },
  { id: "slang", label: "③ 신조어/유행어 감지 배지" },
  { id: "persona", label: "④ 번역기별 캐릭터화" },
  { id: "vote", label: "⑤ 투표/공유형 결과" },
  { id: "tone", label: "⑥ 문맥 슬라이더" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const COMING_SOON_CONTENT: Record<Exclude<TabId, "basic" | "battle">, { title: string; description: string }> = {
  backtranslate: {
    title: "역번역 체크",
    description: "선택된 번역을 원언어로 역번역해 의미 보존율을 비교합니다.",
  },
  slang: {
    title: "신조어/유행어 감지 배지",
    description: "입력 문장의 신조어·밈 표현을 AI로 감지하고, 엔진별 반영 여부를 비교합니다.",
  },
  persona: {
    title: "번역기별 캐릭터화",
    description: "각 엔진에 페르소나를 부여해 캐릭터 말투로 코멘트를 붙여줍니다.",
  },
  vote: {
    title: "투표/공유형 결과",
    description: "선택 결과를 공유 링크로 내보내고 방문자 투표 통계를 보여줍니다. (Phase 2 성격, realtime DB 필요)",
  },
  tone: {
    title: "문맥 슬라이더",
    description: "반말 ↔ 격식체 ↔ 비즈니스체 톤 슬라이더로 재번역 결과를 비교합니다.",
  },
};

export default function Home() {
  // 탭을 옮겨도 "기본 비교" 탭의 상태(입력/언어/번역 결과/선택)가 사라지지 않도록
  // 모든 상태를 최상위(page.tsx)에서 유지하고, 각 탭 컴포넌트에는 props로 내려준다 (PRD.md §7).
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState<LanguageCode>("ko");
  const [targetLang, setTargetLang] = useState<LanguageCode>("en");
  const [enabled, setEnabled] = useState<Record<EngineId, boolean>>(initialEnabledMap());
  const [cardStates, setCardStates] = useState<CardStateMap>(initialCardStates());
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [selectedEngineIds, setSelectedEngineIds] = useState<Set<EngineId>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedPageUrl, setSavedPageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<TranslationHistoryEntry[]>([]);

  // 새로고침해도 로컬 히스토리가 유지되도록 마운트 시 localStorage(외부 저장소)에서 불러온다 (PRD.md §6.4).
  // localStorage는 서버에 없는 외부 시스템이라 SSR 시점엔 읽을 수 없어 useEffect로 클라이언트 마운트 후 동기화한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 저장소(localStorage) 최초 동기화, 마운트 시 1회만 실행
    setHistory(loadHistory());
  }, []);

  const toggleEnabled = (id: EngineId) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSwapLangs = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleTranslate = async () => {
    const text = inputText.trim();
    if (!text) {
      setTranslateError("번역할 문장을 입력하세요.");
      return;
    }

    const enabledIds = ENGINE_CONFIG.filter((e) => enabled[e.id]).map((e) => e.id);
    if (enabledIds.length === 0) {
      setTranslateError("적어도 하나의 번역 엔진을 켜야 합니다.");
      return;
    }

    setTranslateError(null);
    setSelectedEngineIds(new Set());
    setSaveState("idle");
    setSaveMessage(null);
    setSavedPageUrl(null);
    setIsTranslating(true);
    // 번역 요청 시점의 원문을 고정 — 이후 inputText를 수정해도 노션 저장 시 이 값이 사용된다.
    setTranslatedText(text);

    setCardStates(() => {
      const next = initialCardStates();
      for (const id of enabledIds) {
        next[id] = { status: "loading" };
      }
      return next;
    });

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceLang, targetLang, enabledEngines: enabledIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTranslateError(data?.error ?? "번역 요청 중 오류가 발생했습니다.");
        setCardStates(initialCardStates());
        return;
      }

      const results = data.results as Record<string, { text?: string; error?: string; model?: string }>;

      setCardStates((prev) => {
        const next = { ...prev };
        for (const id of enabledIds) {
          const r = results[id];
          if (!r) {
            next[id] = { status: "error", error: "응답 없음" };
          } else if (r.error) {
            next[id] = { status: "error", error: r.error };
          } else if (r.text) {
            next[id] = { status: "done", text: r.text, model: r.model };
          } else {
            next[id] = { status: "error", error: "빈 응답" };
          }
        }
        return next;
      });
    } catch (err) {
      console.error("번역 요청 실패:", err);
      setTranslateError("서버와 통신 중 문제가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
      setCardStates(initialCardStates());
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSelect = (id: EngineId) => {
    setSelectedEngineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaveState("idle");
    setSaveMessage(null);
    setSavedPageUrl(null);
  };

  const handleSaveToNotion = async () => {
    if (selectedEngineIds.size === 0) {
      setSaveState("error");
      setSaveMessage("저장할 번역 결과를 최소 1개 이상 선택하세요.");
      return;
    }

    const allResults: Record<string, { text?: string; error?: string; model?: string }> = {};
    for (const engine of ENGINE_CONFIG) {
      const state = cardStates[engine.id];
      if (state.status === "done") {
        allResults[engine.id] = { text: state.text, model: state.model };
      } else if (state.status === "error") {
        allResults[engine.id] = { error: state.error };
      }
    }

    setSaveState("saving");
    setSaveMessage(null);
    setSavedPageUrl(null);

    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: translatedText,
          sourceLang,
          targetLang,
          selectedEngineIds: Array.from(selectedEngineIds),
          allResults,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveState("error");
        setSaveMessage(`저장 실패: ${data?.error ?? "노션 저장 중 오류가 발생했습니다."}`);
        return;
      }

      setSaveState("success");
      setSaveMessage("노션에 저장됐습니다!");
      setSavedPageUrl(typeof data?.url === "string" ? data.url : null);

      // 노션 저장이 실제로 성공했을 때만 로컬 히스토리에도 남긴다.
      const selectedResults: HistorySelectedResult[] = [];
      for (const e of ENGINE_CONFIG) {
        if (!selectedEngineIds.has(e.id)) continue;
        const result = allResults[e.id];
        if (result?.text) {
          selectedResults.push({ engineId: e.id, label: e.label, text: result.text });
        }
      }

      const updated = addHistoryEntry({
        originalText: translatedText,
        sourceLang,
        targetLang,
        selectedEngineIds: Array.from(selectedEngineIds),
        selectedResults,
        savedAt: new Date().toISOString(),
      });
      setHistory(updated);
    } catch (err) {
      console.error("노션 저장 요청 실패:", err);
      setSaveState("error");
      setSaveMessage("저장 실패: 서버와 통신 중 문제가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
    }
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const hasSelection = selectedEngineIds.size > 0;
  const allSelectedAreDone = Array.from(selectedEngineIds).every((id) => cardStates[id]?.status === "done");
  const canSave = hasSelection && allSelectedAreDone;
  const saveDisabledReason = !hasSelection
    ? "먼저 번역 결과를 하나 이상 선택하세요."
    : !allSelectedAreDone
      ? "선택한 항목 중 아직 완료되지 않은 번역이 있어요. 완료된 번역만 저장할 수 있습니다."
      : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">번역 비교 &amp; 노션 아카이빙</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          여러 번역 API를 동시에 호출해 결과를 비교하고, 마음에 드는 번역을 노션에 기록합니다.
        </p>
      </header>

      <nav
        role="tablist"
        aria-label="화면 전환 탭"
        className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {activeTab === "basic" && (
          <BasicCompareTab
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceLangChange={setSourceLang}
            onTargetLangChange={setTargetLang}
            onSwapLangs={handleSwapLangs}
            inputText={inputText}
            onInputTextChange={setInputText}
            onTranslate={handleTranslate}
            isTranslating={isTranslating}
            translateError={translateError}
            enabled={enabled}
            onToggleEnabled={toggleEnabled}
            cardStates={cardStates}
            selectedEngineIds={selectedEngineIds}
            onSelect={handleSelect}
            onSaveToNotion={handleSaveToNotion}
            canSave={canSave}
            saveState={saveState}
            saveDisabledReason={saveDisabledReason}
            saveMessage={saveMessage}
            savedPageUrl={savedPageUrl}
            history={history}
            onClearHistory={handleClearHistory}
          />
        )}

        {activeTab === "battle" && <BattleViewTab translatedText={translatedText} cardStates={cardStates} />}

        {activeTab !== "basic" &&
          activeTab !== "battle" &&
          (() => {
            const content = COMING_SOON_CONTENT[activeTab];
            return <ComingSoonTab title={content.title} description={content.description} />;
          })()}
      </div>
    </div>
  );
}
