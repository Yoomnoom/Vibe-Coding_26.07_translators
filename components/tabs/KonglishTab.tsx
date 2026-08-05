"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

// "오타 변환기" 옆 독립 유틸리티 탭. "키친 영어로 뭐야?" 같은, 한국식으로 굳어진 영어 표현(콩글리시)의
// 실제 영어 단어/표현을 네이버·구글 대신 여기서 바로 찾을 수 있게 한다.
export function KonglishTab() {
  const [word, setWord] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!word.trim()) {
      setError("찾을 단어나 표현을 입력하세요.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    setAnswer("");
    setProvider(null);

    try {
      const res = await fetch("/api/konglish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "조회 중 오류가 발생했습니다.");
        setStatus("error");
        return;
      }
      setAnswer(body.text ?? "");
      setProvider(body.provider ?? null);
      setStatus("done");
    } catch (err) {
      console.error("콩글리시 조회 요청 실패:", err);
      setError("서버와 통신 중 문제가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="blueprint-panel flex flex-col gap-3 p-4">
        <p className="font-mono text-xs leading-relaxed text-foreground/60">
          &ldquo;키친&rdquo;, &ldquo;원피스&rdquo;처럼 한국식으로 굳어진 영어 표현(콩글리시)의 실제 영어 단어/표현을
          찾아줍니다. 이미 정확한 표현이면 그대로 확인해줘요.
        </p>

        <label className="label-tag" htmlFor="konglish-input">
          찾을 단어나 표현
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="konglish-input"
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="예: 원피스, 핸드폰, 콘센트"
            className="min-w-0 flex-1 rounded-sm border border-line bg-paper-card p-3 font-serif text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={status === "loading"}
            className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "loading" ? "찾는 중..." : "찾기"}
          </button>
          {status === "done" && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-sm border border-line px-3 py-2 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent"
            >
              {copied ? "복사됨!" : "결과 복사"}
            </button>
          )}
        </div>

        {status === "error" && error && <p className="font-mono text-xs text-red-700">{error}</p>}

        {status === "done" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-tag">결과</span>
              {provider && <span className="font-mono text-xs text-foreground/40">조회: {provider}</span>}
            </div>
            <div className="min-h-[3.5rem] rounded-sm border border-line bg-paper-card p-3 font-serif text-sm leading-relaxed text-foreground/80">
              {answer.split("\n").map((line, i) => {
                const match = line.match(/^(영어 표현\s*:\s*)(.+)$/);
                return (
                  <p key={i} className="whitespace-pre-wrap">
                    {match ? (
                      <>
                        {match[1]}
                        <strong>{match[2]}</strong>
                      </>
                    ) : (
                      line || " "
                    )}
                  </p>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
