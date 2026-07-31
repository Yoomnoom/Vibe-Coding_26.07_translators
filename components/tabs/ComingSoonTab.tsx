"use client";

interface ComingSoonTabProps {
  title: string;
  description: string;
}

// ②~⑥번 특색 아이디어 탭 공용 placeholder (PRD.md §7).
// 실제 로직은 아직 없고, 기능 설명 + "준비 중" 안내만 보여준다.
export function ComingSoonTab({ title, description }: ComingSoonTabProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        준비 중
      </span>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-600">아직 준비 중입니다. 시간 여유가 있을 때 하나씩 구현할 예정이에요.</p>
    </div>
  );
}
