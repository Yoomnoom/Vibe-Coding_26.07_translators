"use client";

interface ComingSoonTabProps {
  title: string;
  description: string;
}

// ③~⑥번 특색 아이디어 탭 공용 placeholder (PRD.md §7). ①·②번은 이미 실구현으로 대체됨.
// 실제 로직은 아직 없고, 기능 설명 + "준비 중" 안내만 보여준다.
export function ComingSoonTab({ title, description }: ComingSoonTabProps) {
  return (
    <div className="blueprint-panel flex flex-col items-center gap-3 border-dashed p-10 text-center">
      <span className="label-tag rounded-full border border-line px-3 py-1">준비 중</span>
      <h2 className="font-display text-lg text-accent">{title}</h2>
      <p className="max-w-md font-serif text-sm leading-relaxed text-foreground/70">{description}</p>
      <p className="font-mono text-xs text-foreground/40">아직 준비 중입니다. 시간 여유가 있을 때 하나씩 구현할 예정이에요.</p>
    </div>
  );
}
