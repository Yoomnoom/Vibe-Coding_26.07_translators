// 텍스트를 파일로 다운로드하는 공용 유틸 (히스토리/OCR 등 여러 탭에서 재사용).
export function downloadTextFile(content: string, filename: string, mimeType = "text/markdown") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
