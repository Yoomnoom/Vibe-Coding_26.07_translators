// 여러 엔진 모듈(deepl/mymemory/gemini/groq/openrouter)에서 공통으로 쓰는
// "사용자 친화적 에러 메시지" 변환 헬퍼.
//
// 왜 필요한가: fetch 실패/타임아웃/HTTP 에러를 그대로 노출하면
// - AbortSignal.timeout()이 던지는 예외 메시지가 영어 기술 문구("The operation was
//   aborted due to timeout")로 카드에 그대로 표시되고
// - 업스트림 API가 반환한 원문 응답 본문(JSON/HTML)이 그대로 노출되어
// 사용자가 원인을 이해하기 어렵다. 여기서 한 번 한국어 안내 문구로 감싸고,
// 진단에 필요한 원본 상세는 서버 콘솔에만 남긴다.

/** fetch 자체가 실패했을 때(catch 블록)의 예외를 사용자 친화적 문구로 변환한다. */
export function describeCatchError(err: unknown, engineLabel: string): string {
  const isTimeout =
    (err instanceof DOMException && err.name === "TimeoutError") ||
    (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
  if (isTimeout) {
    return `${engineLabel} 응답이 너무 늦어 요청을 취소했습니다. 잠시 후 다시 시도해주세요.`;
  }

  if (err instanceof TypeError) {
    // fetch 자체가 실패(네트워크 단절, DNS 실패 등)했을 때 공통적으로 TypeError가 발생한다.
    console.error(`[${engineLabel}] 네트워크 오류:`, err);
    return `${engineLabel} 서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.`;
  }

  console.error(`[${engineLabel}] 알 수 없는 오류:`, err);
  return `${engineLabel} 호출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
}

/**
 * fetch 응답이 !res.ok일 때 사용. rawDetail(응답 본문/에러 메시지)은 서버 콘솔에만 남기고
 * 사용자에게는 상태 코드에 맞는 일반화된 한국어 문구만 보여준다.
 */
export function describeHttpError(status: number, engineLabel: string, rawDetail?: string): string {
  if (rawDetail) {
    console.error(`[${engineLabel}] HTTP ${status}:`, rawDetail.slice(0, 500));
  }

  // DeepL의 456은 "월 무료 한도 초과"를 의미하는 DeepL 고유 상태 코드.
  if (status === 456) {
    return `${engineLabel} 무료 사용량 한도를 초과했습니다. 다음 달까지 기다리거나 다른 엔진을 사용해주세요.`;
  }
  if (status === 429) {
    return `${engineLabel}의 무료 사용량 한도를 초과했을 수 있습니다. 잠시 후 다시 시도해주세요.`;
  }
  if (status === 401 || status === 403) {
    return `${engineLabel} 인증에 실패했습니다. API 키 설정을 확인해주세요.`;
  }
  if (status >= 500) {
    return `${engineLabel} 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
  }
  return `${engineLabel} 요청이 실패했습니다 (오류 코드 ${status}). 잠시 후 다시 시도해주세요.`;
}
