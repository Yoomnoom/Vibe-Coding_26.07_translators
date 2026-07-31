// 특색 아이디어 탭(배틀 뷰/역번역 체크)이 아직 준비 안 된 상태일 때 공통으로 쓰는 안내 패널.
// "기본 비교" 탭으로 바로 이동할 수 있는 버튼까지 포함한다.
export function TabEmptyNotice({ text, onGoToBasicTab }: { text: string; onGoToBasicTab: () => void }) {
  return (
    <div className="blueprint-panel flex flex-col items-center gap-3 border-dashed p-8 text-center font-mono text-xs text-foreground/50">
      <p>{text}</p>
      <button
        type="button"
        onClick={onGoToBasicTab}
        className="rounded-sm border border-accent bg-accent px-4 py-2 font-mono text-xs tracking-wide text-paper-card transition-colors hover:bg-accent-dark"
      >
        기본 비교 탭으로 이동
      </button>
    </div>
  );
}
