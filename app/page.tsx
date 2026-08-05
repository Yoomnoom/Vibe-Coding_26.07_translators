"use client";

import { useEffect, useState } from "react";
import { ENGINE_CONFIG, EngineId, TONE_OPTIONS, TONE_SUPPORTED_ENGINE_IDS } from "@/lib/engines/config";
import type { LanguageCode, SourceLanguageCode, ToneId } from "@/lib/engines/types";
import { CardState } from "@/components/EngineCard";
import { BasicCompareTab, type SaveState } from "@/components/tabs/BasicCompareTab";
import { BattleViewTab } from "@/components/tabs/BattleViewTab";
import { BackTranslationTab, type BackTranslateRunState } from "@/components/tabs/BackTranslationTab";
import { ToneSliderTab, type ToneCardStateMap } from "@/components/tabs/ToneSliderTab";
import { TypoConverterTab } from "@/components/tabs/TypoConverterTab";
import { OcrTab } from "@/components/tabs/OcrTab";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { ComingSoonTab } from "@/components/tabs/ComingSoonTab";
import { addHistoryEntry, clearHistory, HistorySelectedResult, loadHistory, TranslationHistoryEntry } from "@/lib/history";
import { loadEngineOrder, saveEngineOrder } from "@/lib/engineOrder";
import { Divider } from "@/components/Divider";
import { VisitCounter } from "@/components/VisitCounter";

type CardStateMap = Record<EngineId, CardState>;

function initialCardStates(): CardStateMap {
  return Object.fromEntries(ENGINE_CONFIG.map((e) => [e.id, { status: "idle" as const }])) as CardStateMap;
}

// 기본값을 꺼짐으로 바꿈(2026-08-05) — 사용자가 필요한 엔진만 직접 켜서 쓰고 싶어 함.
// "결과 비교"/"문맥 슬라이더"가 이 enabled 상태를 공유하므로 두 탭 모두 기본이 꺼짐 상태로 시작한다.
// 아무것도 안 켠 채 "번역하기"를 누르면 handleTranslate/handleTranslateTone이
// "적어도 하나의 번역 엔진을 켜야 합니다." 에러를 띄워 토글을 켜라고 안내한다.
function initialEnabledMap(): Record<EngineId, boolean> {
  return Object.fromEntries(ENGINE_CONFIG.map((e) => [e.id, false])) as Record<EngineId, boolean>;
}

function initialToneCardStates(): ToneCardStateMap {
  return Object.fromEntries(ENGINE_CONFIG.map((e) => [e.id, {}])) as ToneCardStateMap;
}

// 최상위 탭 구성. "기본 비교"와, 그와 무관하게 독립적으로 쓰는 유틸리티 탭들(오타 변환기/이미지 텍스트
// 추출/최근 기록)만 여기 둔다. ①~⑥ 특색 아이디어는 전부 "기본 비교" 결과를 기반으로 동작하는 하위
// 기능이라 최상위에서 빼고 "기본 비교" 안의 하위 탭(BASIC_SUB_TABS)으로 옮겼다 (2026-08-01 피드백 반영).
const TABS = [
  { id: "basic", label: "번역기들" },
  { id: "typo", label: "⌨ 오타 변환기" },
  { id: "ocr", label: "📷 이미지 텍스트 추출" },
  { id: "history", label: "🕓 최근 기록" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// "기본 비교" 하위 탭 (PRD.md §7). "결과 비교"가 기본 선택값이고, 나머지 6개는 기본 비교의 번역 결과를
// 그대로 활용하는 특색 아이디어다. ①번(배틀 뷰)·②번(역번역 체크)만 실제 구현, ③~⑥번은 ComingSoonTab
// 공용 placeholder를 재사용한다. 역번역 체크는 우선순위를 높여 배틀 뷰보다 앞에 배치했다.
const BASIC_SUB_TABS = [
  { id: "compare", label: "결과 비교" },
  { id: "backtranslate", label: "역번역 체크" },
  { id: "tone", label: "문맥 슬라이더" },
  { id: "slang", label: "신조어/유행어 감지 배지" },
  { id: "persona", label: "번역기별 캐릭터화" },
  { id: "vote", label: "투표/공유형 결과" },
  { id: "battle", label: "번역 신뢰도 배틀 뷰" },
] as const;

type BasicSubTabId = (typeof BASIC_SUB_TABS)[number]["id"];

const COMING_SOON_CONTENT: Record<
  Exclude<BasicSubTabId, "compare" | "battle" | "backtranslate" | "tone">,
  { title: string; description: string }
> = {
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
};

export default function Home() {
  // 탭을 옮겨도 "기본 비교" 탭의 상태(입력/언어/번역 결과/선택)가 사라지지 않도록
  // 모든 상태를 최상위(page.tsx)에서 유지하고, 각 탭 컴포넌트에는 props로 내려준다 (PRD.md §7).
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  // "기본 비교" 안의 하위 탭(결과 비교/①~⑥). activeTab이 "basic"일 때만 의미가 있다.
  const [activeSubTab, setActiveSubTab] = useState<BasicSubTabId>("compare");

  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState<SourceLanguageCode>("auto");
  const [targetLang, setTargetLang] = useState<LanguageCode>("en");
  const [enabled, setEnabled] = useState<Record<EngineId, boolean>>(initialEnabledMap());
  const [cardStates, setCardStates] = useState<CardStateMap>(initialCardStates());
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [selectedEngineIds, setSelectedEngineIds] = useState<Set<EngineId>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedPageUrl, setSavedPageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<TranslationHistoryEntry[]>([]);
  // sourceLang이 "auto"일 때 실제로 감지된 언어 (표시용). 언어를 직접 고르면 다시 null로 돌아간다.
  const [detectedSourceLang, setDetectedSourceLang] = useState<LanguageCode | null>(null);
  // "② 역번역 체크" 탭 상태. 탭을 옮겨도 결과가 사라지지 않도록(그리고 다시 탭에 들어와도 자동 재호출
  // 하지 않도록) app/page.tsx(최상위)에서 유지한다 — PRD.md §7 ②번, 자동 실행 금지 요구사항 참고.
  const [backTranslateRun, setBackTranslateRun] = useState<BackTranslateRunState>({ status: "idle" });
  // "역번역 체크" 화면의 "원문" 표시용 — "결과 비교"/"문맥 슬라이더" 중 어느 쪽에서 트리거했는지에 따라
  // translatedText/toneInputText 중 해당하는 값을 담아둔다(handleGoToBackTranslate/handleGoToToneBackTranslate).
  const [backTranslateOriginalText, setBackTranslateOriginalText] = useState("");
  // "다시 확인" 버튼(BackTranslationTab)이 어느 탭 기준으로 재요청해야 하는지 기억해둔다.
  const [backTranslateSource, setBackTranslateSource] = useState<"compare" | "tone">("compare");
  // "⑥ 문맥 슬라이더" 탭 상태. "결과 비교"에 연동되지 않는 독립 입력창이라 자체 입력/언어/결과 상태를
  // 따로 둔다 — 엔진 목록·켜기끄기·순서(enabled/engineOrder/isEngineOrderLocked)만 "결과 비교"와 공유한다.
  const [toneInputText, setToneInputText] = useState("");
  const [toneSourceLang, setToneSourceLang] = useState<SourceLanguageCode>("auto");
  const [toneTargetLang, setToneTargetLang] = useState<LanguageCode>("en");
  const [toneDetectedSourceLang, setToneDetectedSourceLang] = useState<LanguageCode | null>(null);
  // 여러 톤을 동시에 선택해 결과를 나란히 비교할 수 있다 — 기본값은 3종 전부 선택.
  const [selectedTones, setSelectedTones] = useState<ToneId[]>(TONE_OPTIONS.map((t) => t.id));
  const [toneCardStates, setToneCardStates] = useState<ToneCardStateMap>(initialToneCardStates());
  const [isTranslatingTone, setIsTranslatingTone] = useState(false);
  const [toneTranslateError, setToneTranslateError] = useState<string | null>(null);
  // 엔진 카드(ENGINE 01~05) 표시 순서. 기본은 고정(잠김)이고, 고정을 해제해야만 마우스로 드래그해
  // 순서를 바꿀 수 있다. 바뀐 순서는 localStorage에 저장돼 새로고침해도 유지된다 (lib/engineOrder.ts).
  const [engineOrder, setEngineOrder] = useState<EngineId[]>(ENGINE_CONFIG.map((e) => e.id));
  const [isEngineOrderLocked, setIsEngineOrderLocked] = useState(true);

  // 새로고침해도 로컬 히스토리/엔진 순서가 유지되도록 마운트 시 localStorage(외부 저장소)에서 불러온다 (PRD.md §6.4).
  // localStorage는 서버에 없는 외부 시스템이라 SSR 시점엔 읽을 수 없어 useEffect로 클라이언트 마운트 후 동기화한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 저장소(localStorage) 최초 동기화, 마운트 시 1회만 실행
    setHistory(loadHistory());
    setEngineOrder(loadEngineOrder());
  }, []);

  const toggleEnabled = (id: EngineId) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const reorderEngine = (fromIndex: number, toIndex: number) => {
    setEngineOrder((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      saveEngineOrder(next);
      return next;
    });
  };

  const setAllEnabled = (value: boolean) => {
    setEnabled(Object.fromEntries(ENGINE_CONFIG.map((e) => [e.id, value])) as Record<EngineId, boolean>);
  };

  const handleSourceLangChange = (lang: SourceLanguageCode) => {
    setSourceLang(lang);
    setDetectedSourceLang(null);
  };

  // "📷 이미지 텍스트 추출" 탭에서 추출한 텍스트를 "기본 비교 > 결과 비교" 입력창으로 보내고 그리로 전환한다.
  const handleSendOcrTextToBasic = (text: string) => {
    setInputText(text);
    setActiveTab("basic");
    setActiveSubTab("compare");
  };

  const handleSwapLangs = () => {
    // sourceLang이 "auto"면 바꿔치기할 실제 언어가 없어(자동 감지는 targetLang이 될 수 없음) 스왑을 건너뛴다.
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  // 새로고침 없이 입력/번역 결과/선택/역번역 상태를 비운다. 언어 선택은 사용자가 일부러 고른 값이라 그대로 둔다.
  // "초기화"라는 표현이 과하다는 피드백으로 "지우기"로 표기 (PRD.md 참고).
  const handleClearTranslation = () => {
    setInputText("");
    setTranslatedText("");
    setCardStates(initialCardStates());
    setSelectedEngineIds(new Set());
    setTranslateError(null);
    setSaveState("idle");
    setSaveMessage(null);
    setSavedPageUrl(null);
    setDetectedSourceLang(null);
    setBackTranslateRun({ status: "idle" });
  };

  // "⑥ 문맥 슬라이더" 탭 전용 — "결과 비교"와 입력/언어 상태를 공유하지 않는 독립 도구라 스왑/지우기도 따로 둔다.
  const handleToneSwapLangs = () => {
    if (toneSourceLang === "auto") return;
    setToneSourceLang(toneTargetLang);
    setToneTargetLang(toneSourceLang);
  };

  const handleClearToneTranslation = () => {
    setToneInputText("");
    setToneCardStates(initialToneCardStates());
    setToneTranslateError(null);
    setToneDetectedSourceLang(null);
  };

  const toggleTone = (t: ToneId) => {
    setSelectedTones((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
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
    setDetectedSourceLang(null);
    // 이전 번역에 대한 역번역 결과가 새 번역 이후에도 남아있으면 헷갈리므로 함께 초기화한다.
    setBackTranslateRun({ status: "idle" });
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
      // sourceLang이 "auto"면 서버(/api/translate)가 내부적으로 MyMemory로 언어를 먼저 감지하고
      // targetLang을 한국어↔영어 기본 페어로 조정한 뒤 번역까지 한 번에 처리해 detectedLang/resolvedTargetLang을 함께 돌려준다.
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

      const detected = data.detectedLang as LanguageCode | null;
      if (detected) setDetectedSourceLang(detected);
      const resolvedTargetLang = data.resolvedTargetLang as LanguageCode;
      if (resolvedTargetLang && resolvedTargetLang !== targetLang) setTargetLang(resolvedTargetLang);

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

  // "⑥ 문맥 슬라이더" 탭 전용 번역 — /api/translate를 그대로 재사용하되 tone만 추가로 실어 보낸다.
  // 톤을 반영할 수 있는 건 LLM 3종(TONE_SUPPORTED_ENGINE_IDS)뿐이라 이 탭에는 그 3개만 보이고,
  // 여러 톤을 동시에 비교할 수 있다. 톤별 요청은 **순차적으로**(Promise.all 병렬이 아니라) 실행한다 —
  // 병렬로 쏘면 같은 순간 Gemini 같은 무료 티어 엔진에 톤 개수만큼(예: 3개) 동시 요청이 몰려서 무료
  // 할당량/동시 요청 제한에 걸리기 더 쉬워짐(2026-08-05 실사용 중 확인: 3톤 동시 선택 시 그 중 하나만
  // "무료 사용량 한도 초과" 에러). 순차 실행하면 총 소요 시간은 늘지만 그런 경합을 크게 줄일 수 있고,
  // 톤 결과가 도착하는 대로 하나씩 채워져 사용자 입장에서 체감 응답성도 나쁘지 않다.
  const handleTranslateTone = async () => {
    const text = toneInputText.trim();
    if (!text) {
      setToneTranslateError("번역할 문장을 입력하세요.");
      return;
    }

    const enabledIds: EngineId[] = TONE_SUPPORTED_ENGINE_IDS.filter((id) => enabled[id]);
    if (enabledIds.length === 0) {
      setToneTranslateError("적어도 하나의 번역 엔진을 켜야 합니다.");
      return;
    }
    if (selectedTones.length === 0) {
      setToneTranslateError("적어도 하나의 톤을 선택해야 합니다.");
      return;
    }

    setToneTranslateError(null);
    setIsTranslatingTone(true);
    setToneDetectedSourceLang(null);

    setToneCardStates(() => {
      const next = initialToneCardStates();
      for (const id of enabledIds) {
        for (const t of selectedTones) next[id][t] = { status: "loading" };
      }
      return next;
    });

    type TranslateApiResult = { text?: string; error?: string; model?: string };
    const toCardState = (r: TranslateApiResult | undefined): CardState => {
      if (!r) return { status: "error", error: "응답 없음" };
      if (r.error) return { status: "error", error: r.error };
      if (r.text) return { status: "done", text: r.text, model: r.model };
      return { status: "error", error: "빈 응답" };
    };

    try {
      let anyOk = false;
      let firstError: string | null = null;

      for (const tone of selectedTones) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            sourceLang: toneSourceLang,
            targetLang: toneTargetLang,
            enabledEngines: enabledIds,
            tone,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          firstError = data?.error ?? "번역 요청 중 오류가 발생했습니다.";
          setToneCardStates((prev) => {
            const next = { ...prev };
            for (const id of enabledIds) {
              next[id] = { ...next[id], [tone]: { status: "error", error: firstError ?? "오류" } };
            }
            return next;
          });
          continue;
        }

        anyOk = true;
        const detected = data.detectedLang as LanguageCode | null;
        if (detected) setToneDetectedSourceLang(detected);
        const resolvedTargetLang = data.resolvedTargetLang as LanguageCode;
        if (resolvedTargetLang && resolvedTargetLang !== toneTargetLang) setToneTargetLang(resolvedTargetLang);

        const results = data.results as Record<string, TranslateApiResult>;
        setToneCardStates((prev) => {
          const next = { ...prev };
          for (const id of enabledIds) {
            next[id] = { ...next[id], [tone]: toCardState(results[id]) };
          }
          return next;
        });
      }

      if (!anyOk && firstError) {
        setToneTranslateError(firstError);
      }
    } catch (err) {
      console.error("문맥 슬라이더 번역 요청 실패:", err);
      setToneTranslateError("서버와 통신 중 문제가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
      setToneCardStates(initialToneCardStates());
    } finally {
      setIsTranslatingTone(false);
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

  // PRD.md §7 ②번 "역번역 체크" 실제 호출. 성공한(status === "done") 결과 전체를 스냅샷으로 찍어
  // /api/back-translate에 딱 한 번 보낸다(엔진별 개별 호출 금지 — lib/backTranslate.ts가 DeepL→Gemini→Groq
  // 순으로 폴백해 1곳에만 몰아서 호출함). "결과 비교"/"문맥 슬라이더" 양쪽에서 재사용하는 공용 함수라
  // 항목 목록과 역번역 방향(fromLang → toLang)을 호출부에서 만들어 넘긴다.
  const runBackTranslateForItems = async (
    items: { engineId: string; label: string; text: string }[],
    fromLang: LanguageCode,
    toLang: LanguageCode
  ) => {
    if (items.length === 0) return;

    setBackTranslateRun({ status: "loading", items });

    try {
      const res = await fetch("/api/back-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ engineId, text }) => ({ engineId, text })),
          sourceLang: fromLang,
          targetLang: toLang,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBackTranslateRun({ status: "error", error: data?.error ?? "역번역 요청 중 오류가 발생했습니다.", items });
        return;
      }

      const backTranslations = data.backTranslations as
        | { engineId: string; backText?: string; error?: string; provider?: string }[]
        | undefined;
      const results: Record<string, { backText?: string; error?: string; provider?: string }> = {};
      for (const r of backTranslations ?? []) {
        results[r.engineId] = { backText: r.backText, error: r.error, provider: r.provider };
      }
      setBackTranslateRun({ status: "done", items, results });
    } catch (err) {
      console.error("역번역 요청 실패:", err);
      setBackTranslateRun({
        status: "error",
        error: "서버와 통신 중 문제가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.",
        items,
      });
    }
  };

  const runBackTranslate = () => {
    const doneEngines = ENGINE_CONFIG.filter((e) => cardStates[e.id]?.status === "done");
    if (doneEngines.length === 0) return;

    const resolvedSourceLang = sourceLang === "auto" ? detectedSourceLang : sourceLang;
    if (!resolvedSourceLang) {
      setBackTranslateRun({
        status: "error",
        error: "원본 언어를 확인할 수 없어 역번역할 수 없습니다. (자동 감지 전이거나 감지에 실패했어요)",
      });
      return;
    }

    const items = doneEngines.map((e) => {
      const state = cardStates[e.id] as { status: "done"; text: string };
      return { engineId: e.id, label: e.label, text: state.text };
    });

    // 역번역 호출 방향: 지금 번역문이 쓰인 언어(targetLang) → 원래 언어(resolvedSourceLang)
    void runBackTranslateForItems(items, targetLang, resolvedSourceLang);
  };

  // "문맥 슬라이더" 탭 전용 — 켜져 있는 엔진 × 선택된 톤 조합 중 성공한 결과 전체를 모아서 역번역한다.
  // 엔진 하나가 톤별로 여러 결과를 낼 수 있어서, engineId를 "gemini-casual"처럼 합성해 구분한다
  // (app/api/back-translate/route.ts는 engineId를 문자열로만 다뤄서 화이트리스트 검증이 없다).
  const runToneBackTranslate = () => {
    const resolvedToneSourceLang = toneSourceLang === "auto" ? toneDetectedSourceLang : toneSourceLang;
    if (!resolvedToneSourceLang) {
      setBackTranslateRun({
        status: "error",
        error: "원본 언어를 확인할 수 없어 역번역할 수 없습니다. (자동 감지 전이거나 감지에 실패했어요)",
      });
      return;
    }

    const items: { engineId: string; label: string; text: string }[] = [];
    for (const engineId of TONE_SUPPORTED_ENGINE_IDS) {
      if (!enabled[engineId]) continue;
      const engineLabel = ENGINE_CONFIG.find((e) => e.id === engineId)?.label ?? engineId;
      for (const toneOption of TONE_OPTIONS) {
        if (!selectedTones.includes(toneOption.id)) continue;
        const state = toneCardStates[engineId]?.[toneOption.id];
        if (state?.status === "done") {
          items.push({
            engineId: `${engineId}-${toneOption.id}`,
            label: `${engineLabel} (${toneOption.label})`,
            text: state.text,
          });
        }
      }
    }

    // 역번역 호출 방향: 지금 번역문이 쓰인 언어(toneTargetLang) → 원래 언어(resolvedToneSourceLang)
    void runBackTranslateForItems(items, toneTargetLang, resolvedToneSourceLang);
  };

  // "결과 비교"/"문맥 슬라이더" 탭의 "전체 결과 역번역으로 검증 →" 버튼 핸들러. 하위 탭 전환 + 역번역
  // 요청을 한 번의 클릭으로 같이 처리한다(자동 실행 금지 — 이 버튼을 눌러야만 /api/back-translate가 호출됨).
  const handleGoToBackTranslate = () => {
    setActiveSubTab("backtranslate");
    setBackTranslateOriginalText(translatedText);
    setBackTranslateSource("compare");
    runBackTranslate();
  };

  const handleGoToToneBackTranslate = () => {
    setActiveSubTab("backtranslate");
    setBackTranslateOriginalText(toneInputText);
    setBackTranslateSource("tone");
    runToneBackTranslate();
  };

  const hasDoneTranslation = Object.values(cardStates).some((s) => s.status === "done");
  const hasDoneToneTranslation = TONE_SUPPORTED_ENGINE_IDS.some(
    (id) => enabled[id] && selectedTones.some((t) => toneCardStates[id]?.[t]?.status === "done")
  );

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
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-4xl tracking-wide text-accent">번역기들</h1>
          <span className="label-tag">v1 · notion archive</span>
        </div>
        <p className="font-mono text-xs leading-relaxed text-foreground/60">
          여러 번역 API를 동시에 호출해 결과를 비교하고, 마음에 드는 번역을 노션에 기록합니다.
        </p>
      </header>

      <Divider />

      <nav role="tablist" aria-label="화면 전환 탭" className="relative z-10 flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-sm border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
              activeTab === tab.id
                ? "-mb-px border-line border-b-accent-soft bg-accent-soft text-accent"
                : "border-transparent text-foreground/50 hover:text-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel" className="-mt-6">
        {activeTab === "basic" && (
          <div className="blueprint-panel rounded-tl-none">
            <nav
              role="tablist"
              aria-label="기본 비교 하위 탭"
              className="flex flex-wrap gap-1 rounded-t-[1px] border-b border-line bg-accent-soft/70 px-3 py-2"
            >
              {BASIC_SUB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSubTab === tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition-colors ${
                    activeSubTab === tab.id
                      ? "bg-accent text-paper-card"
                      : "text-foreground/60 hover:bg-paper-card hover:text-accent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="p-4">
            {activeSubTab === "compare" && (
              <BasicCompareTab
                sourceLang={sourceLang}
                detectedSourceLang={detectedSourceLang}
                targetLang={targetLang}
                onSourceLangChange={handleSourceLangChange}
                onTargetLangChange={setTargetLang}
                onSwapLangs={handleSwapLangs}
                inputText={inputText}
                onInputTextChange={setInputText}
                onTranslate={handleTranslate}
                onClearTranslation={handleClearTranslation}
                isTranslating={isTranslating}
                translateError={translateError}
                enabled={enabled}
                onToggleEnabled={toggleEnabled}
                onSetAllEnabled={setAllEnabled}
                engineOrder={engineOrder}
                isEngineOrderLocked={isEngineOrderLocked}
                onToggleEngineOrderLocked={() => setIsEngineOrderLocked((prev) => !prev)}
                onReorderEngine={reorderEngine}
                cardStates={cardStates}
                selectedEngineIds={selectedEngineIds}
                onSelect={handleSelect}
                onSaveToNotion={handleSaveToNotion}
                canSave={canSave}
                saveState={saveState}
                saveDisabledReason={saveDisabledReason}
                saveMessage={saveMessage}
                savedPageUrl={savedPageUrl}
                hasDoneTranslation={hasDoneTranslation}
                onGoToBackTranslate={handleGoToBackTranslate}
              />
            )}

            {activeSubTab === "backtranslate" && (
              <BackTranslationTab
                originalText={backTranslateOriginalText}
                runState={backTranslateRun}
                onRun={backTranslateSource === "compare" ? runBackTranslate : runToneBackTranslate}
                onGoToBasicTab={() => setActiveSubTab("compare")}
              />
            )}

            {activeSubTab === "battle" && (
              <BattleViewTab
                translatedText={translatedText}
                cardStates={cardStates}
                onGoToBasicTab={() => setActiveSubTab("compare")}
              />
            )}

            {activeSubTab === "tone" && (
              <ToneSliderTab
                sourceLang={toneSourceLang}
                detectedSourceLang={toneDetectedSourceLang}
                targetLang={toneTargetLang}
                onSourceLangChange={(lang) => {
                  setToneSourceLang(lang);
                  setToneDetectedSourceLang(null);
                }}
                onTargetLangChange={setToneTargetLang}
                onSwapLangs={handleToneSwapLangs}
                inputText={toneInputText}
                onInputTextChange={setToneInputText}
                selectedTones={selectedTones}
                onToggleTone={toggleTone}
                onTranslate={handleTranslateTone}
                onClearTranslation={handleClearToneTranslation}
                isTranslating={isTranslatingTone}
                translateError={toneTranslateError}
                enabled={enabled}
                onToggleEnabled={toggleEnabled}
                cardStates={toneCardStates}
                engineOrder={engineOrder}
                isEngineOrderLocked={isEngineOrderLocked}
                onToggleEngineOrderLocked={() => setIsEngineOrderLocked((prev) => !prev)}
                onReorderEngine={reorderEngine}
                hasDoneTranslation={hasDoneToneTranslation}
                onGoToBackTranslate={handleGoToToneBackTranslate}
              />
            )}

            {activeSubTab !== "compare" &&
              activeSubTab !== "backtranslate" &&
              activeSubTab !== "battle" &&
              activeSubTab !== "tone" &&
              (() => {
                const content = COMING_SOON_CONTENT[activeSubTab];
                return <ComingSoonTab title={content.title} description={content.description} />;
              })()}
            </div>
          </div>
        )}

        {activeTab === "typo" && <TypoConverterTab />}

        {activeTab === "ocr" && <OcrTab onSendToBasicTab={handleSendOcrTextToBasic} />}

        {activeTab === "history" && <HistoryTab history={history} onClearHistory={handleClearHistory} />}
      </div>

      <footer className="flex justify-end">
        <VisitCounter />
      </footer>
    </div>
  );
}
