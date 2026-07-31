"use client";

import { useMemo, useState } from "react";
import { convertTypo, TypoDirection } from "@/lib/typoConverter";

const DIRECTIONS: { value: TypoDirection; label: string; placeholder: string }[] = [
  { value: "en2ko", label: "영어로 잘못 친 한글 → 한글", placeholder: "예: dkssudgktpdy" },
  { value: "ko2en", label: "한글로 잘못 친 영어 → 영어", placeholder: "예: 안녕하세요" },
];

// github.com/Yoomnoom/Coding_26.07_typoConverter 이식 — 서버 API 없이 동작하는 순수 클라이언트 변환기.
export function TypoConverterTab() {
  const [direction, setDirection] = useState<TypoDirection>("en2ko");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const converted = useMemo(() => (input ? convertTypo(input, direction) : ""), [input, direction]);
  const placeholder = DIRECTIONS.find((d) => d.value === direction)?.placeholder ?? "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(converted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="blueprint-panel flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs">
          {DIRECTIONS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-foreground/70">
              <input
                type="radio"
                name="typo-direction"
                value={d.value}
                checked={direction === d.value}
                onChange={() => setDirection(d.value)}
                className="accent-[var(--accent)]"
              />
              {d.label}
            </label>
          ))}
        </div>

        <label className="label-tag" htmlFor="typo-input">
          텍스트를 붙여넣으세요
        </label>
        <textarea
          id="typo-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          aria-label="변환할 텍스트 입력"
          rows={3}
          className="w-full resize-none rounded-sm border border-line bg-paper-card p-3 font-serif text-sm text-foreground outline-none focus:border-accent"
        />

        <div className="min-h-[3.5rem] rounded-sm border border-line bg-paper-card p-3 font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
          {converted || <span className="font-mono text-xs text-foreground/40">여기에 변환 결과가 표시돼요.</span>}
        </div>

        {converted && (
          <button
            type="button"
            onClick={handleCopy}
            className="self-start rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark"
          >
            {copied ? "복사됨!" : "결과 복사"}
          </button>
        )}

        <p className="font-mono text-xs leading-relaxed text-foreground/40">
          ⚠ 영어 단어(예: pandas)와 오타난 한글이 띄어쓰기 없이 붙어있으면 영어 단어까지 한글 자모로 잘못 변환될 수
          있어요. 이런 경우는 단어 사이에 공백을 넣어주면 더 정확하게 변환됩니다.
        </p>
      </section>
    </div>
  );
}
