// 번역 신뢰도 배틀 뷰(PRD.md §7 ①번) 비교 로직.
// 새 API 호출 없이, "기본 비교" 탭에서 이미 받아온 번역 결과를 어절(공백 기준) 단위로 비교한다.
// 완벽한 문장 정렬 알고리즘은 과설계이므로 인덱스 기반 단순 비교로 충분하다는 PRD 지침을 따름.

export type WordVerdict = "match" | "minority" | "mismatch";

// 어절 판정별 표시 스타일. BattleViewTab/BackTranslateCheckTab이 공유해서 쓴다(복붙 방지).
export const VERDICT_STYLE: Record<WordVerdict, string> = {
  match: "",
  minority: "bg-yellow-200/70 text-yellow-900 underline decoration-yellow-600 decoration-2 underline-offset-2",
  mismatch:
    "bg-red-200/70 text-red-900 font-bold underline decoration-wavy decoration-red-600 decoration-2 underline-offset-2",
};
export const VERDICT_MARK: Record<WordVerdict, string> = { match: "", minority: "▲", mismatch: "✕" };
export const VERDICT_TITLE: Record<WordVerdict, string> = {
  match: "일치",
  minority: "소수 의견",
  mismatch: "불일치",
};

export interface BattleEngineEntry {
  id: string;
  label: string;
  text: string;
}

export interface BattleEngineWords {
  id: string;
  label: string;
  words: string[];
}

export interface BattleViewResult {
  engines: BattleEngineWords[];
  /** 비교 대상으로 삼은 어절 개수 (가장 짧은 엔진의 어절 수) */
  comparedLength: number;
  /** comparedLength 만큼의 어절별 판정 목록 */
  verdicts: WordVerdict[];
  matchCount: number;
  /** 0~100 사이 정수 퍼센트 */
  matchRate: number;
  /** 엔진마다 어절 수가 달라 comparedLength 이후를 비교하지 않은 경우 true */
  truncated: boolean;
}

/** 문장을 공백 기준으로 어절 분리 (빈 문자열 제거) */
function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * 성공한 엔진 결과들을 어절 단위로 비교한다.
 * 같은 인덱스의 어절이 전부 같으면 "match", 과반수만 같으면 "minority", 그 외엔 "mismatch".
 * 호출부에서 entries.length >= 2 를 보장해야 한다.
 */
export function computeBattleView(entries: BattleEngineEntry[]): BattleViewResult {
  const engines: BattleEngineWords[] = entries.map((e) => ({
    id: e.id,
    label: e.label,
    words: splitWords(e.text),
  }));

  const lengths = engines.map((e) => e.words.length);
  const comparedLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);
  const truncated = maxLength > comparedLength;

  const verdicts: WordVerdict[] = [];
  let matchCount = 0;

  for (let i = 0; i < comparedLength; i++) {
    const wordsAtIndex = engines.map((e) => e.words[i]);
    const counts = new Map<string, number>();
    for (const w of wordsAtIndex) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const maxCount = Math.max(...counts.values());
    const total = wordsAtIndex.length;

    let verdict: WordVerdict;
    if (maxCount === total) {
      verdict = "match";
      matchCount++;
    } else if (maxCount > total / 2) {
      verdict = "minority";
    } else {
      verdict = "mismatch";
    }
    verdicts.push(verdict);
  }

  return {
    engines,
    comparedLength,
    verdicts,
    matchCount,
    matchRate: comparedLength === 0 ? 0 : Math.round((matchCount / comparedLength) * 100),
    truncated,
  };
}
