// makingsoftware.com의 ❋❋❋ 별표 행 구분선 모티프. 섹션 사이 시각적 쉼표 역할.
export function Divider() {
  return (
    <div aria-hidden className="divider-asterisk">
      {Array.from({ length: 100 }, () => "✳").join(" ")}
    </div>
  );
}
