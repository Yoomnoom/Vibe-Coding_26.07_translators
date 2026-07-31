"use client";

import { useEffect, useRef, useState } from "react";
import { downloadTextFile } from "@/lib/download";

interface OcrTabProps {
  /** 추출한 텍스트를 "번역기들" 탭 입력창에 채우고 그 탭으로 전환하는 콜백. */
  onSendToBasicTab: (text: string) => void;
}

type Status = "idle" | "extracting" | "done" | "error";

function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/png;base64,AAAA..." 형태에서 base64 데이터만 분리한다.
      const commaIndex = result.indexOf(",");
      resolve({ data: result.slice(commaIndex + 1), mimeType: file.type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 마우스로 텍스트를 못 긁어와서 스크린샷/사진으로만 가져올 수 있을 때 쓰는 독립 유틸리티 탭.
// "오타 변환기"처럼 번역 비교와 직접 관련은 없지만 실사용 중 자주 마주치는 상황을 돕는다.
export function OcrTab({ onSendToBasicTab }: OcrTabProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 결과 텍스트박스가 rows 고정 없이 내용 길이에 맞춰 자라도록 한다 (스크롤바 대신 높이 자체가 늘어남).
  // OCR로 막 채워진 직후(사용자가 타이핑하지 않은 시점)에도 반영되도록 onChange가 아니라 값 변화를 감지한다.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [extractedText]);

  const clearImage = () => {
    setStatus("idle");
    setError(null);
    setExtractedText("");
    setProvider(null);
    setPreviewUrl(null);
  };

  const runOcr = async (file: File) => {
    setStatus("extracting");
    setError(null);
    setExtractedText("");
    setProvider(null);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const { data, mimeType } = await fileToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mimeType }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "텍스트 추출 중 오류가 발생했습니다.");
        setStatus("error");
        return;
      }
      setExtractedText(body.text ?? "");
      setProvider(body.provider ?? null);
      setStatus("done");
    } catch (err) {
      console.error("OCR 요청 실패:", err);
      setError("서버와 통신 중 문제가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
      setStatus("error");
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void runOcr(file);
        }
        return;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void runOcr(file);
    e.target.value = ""; // 같은 파일을 다시 선택해도 onChange가 발생하도록
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="blueprint-panel flex flex-col gap-3 p-4">
        <p className="font-mono text-xs leading-relaxed text-foreground/60">
          마우스로 텍스트를 긁을 수 없는 화면을 스크린샷/사진으로 찍었을 때, 그 이미지에서 텍스트를 추출합니다. 이미지 속
          텍스트를 그대로 추출할 뿐 번역은 하지 않아요 — 추출 후 &ldquo;번역기들&rdquo;로 보내서 번역하세요.
        </p>

        <div
          onPaste={handlePaste}
          tabIndex={0}
          role="button"
          aria-label="여기에 이미지를 붙여넣거나(Ctrl+V) 아래 버튼으로 파일을 선택하세요"
          className="relative flex min-h-[8rem] flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-line bg-paper-card p-4 text-center outline-none focus:border-accent"
        >
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={clearImage}
                title="이미지 지우기"
                aria-label="붙여넣은 이미지 지우기"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper-card text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent"
              >
                ✕
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- 사용자가 붙여넣은 임시 이미지 미리보기, 최적화 불필요 */}
              <img src={previewUrl} alt="붙여넣은 이미지 미리보기" className="max-h-40 max-w-full rounded-sm border border-line" />
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-foreground/40">여기를 클릭하고 Ctrl+V로 이미지를 붙여넣으세요</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent"
              >
                이미지 파일 선택
              </button>
            </>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        {status === "extracting" && <p className="font-mono text-xs text-foreground/50">텍스트 추출 중...</p>}
        {status === "error" && error && <p className="font-mono text-xs text-red-700">{error}</p>}

        {status === "done" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="label-tag" htmlFor="ocr-result">
                추출된 텍스트 (필요하면 수정하세요)
              </label>
              {provider && <span className="font-mono text-xs text-foreground/40">추출: {provider}</span>}
            </div>
            <textarea
              ref={textareaRef}
              id="ocr-result"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              rows={1}
              className="w-full resize-none overflow-hidden rounded-sm border border-line bg-paper-card p-3 font-serif text-sm text-foreground outline-none focus:border-accent"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!extractedText}
                className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? "복사됨!" : "텍스트 복사"}
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile(extractedText, "ocr-result.md")}
                disabled={!extractedText}
                className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-foreground/60 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                마크다운 다운로드
              </button>
              <button
                type="button"
                onClick={() => onSendToBasicTab(extractedText)}
                disabled={!extractedText}
                className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                번역기들로 보내서 번역하기 →
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
