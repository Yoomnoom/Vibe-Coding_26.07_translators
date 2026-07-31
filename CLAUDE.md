# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 현재 상태

MVP + 이후 요구사항(언어 선택, 다중 선택, 특색 탭, OCR 등) 전부 구현 완료, QA·아키텍처·프론트엔드 리뷰 3라운드 전부 이상 없음 확인됨 (2026-08-01 시점). Next.js(App Router, TypeScript, Tailwind) 프로젝트로 DeepL/MyMemory/Gemini/Groq/OpenRouter 5개 번역 엔진 실제 연동 + 노션 저장까지 동작 확인함.

최상위 탭은 **번역기들 / 오타 변환기 / 이미지 텍스트 추출 / 최근 기록** 4개(`app/page.tsx`의 `TABS`, 서로 독립적인 유틸리티). PRD.md에서 관용적으로 "기본 비교"라고 부르는 것은 이 중 **"번역기들"** 탭을 가리킨다 — ①~⑥ 특색 아이디어는 전부 이 탭의 번역 결과를 재사용하는 하위 기능이라 `BASIC_SUB_TABS`(기본값 "결과 비교")로 그 안에 들어가 있다.

- `PRD.md` — 번역 비교 앱의 제품 요구사항 문서. 목표, 기능 범위, 기술 스택, 성공 기준, §15 "완료된 작업 이력"(주제별 정리 + 맨 끝 "남은 백로그")까지 정리되어 있음. 새 작업 시작 전 먼저 읽을 것.
- `번역비교앱_제작프롬프트모음.docx` — PRD를 바탕으로 바이브코딩 도구(Claude, Cursor 등)에 바로 붙여넣을 수 있게 정리한 단계별 제작 프롬프트 원본. PRD.md는 이 문서 내용을 역산해 구조화한 것.
- `lib/engines/` — 번역 엔진별 모듈(`deepl.ts`, `mymemory.ts`, `gemini.ts`, `groq.ts`, `openrouter.ts`) + 공통 타입(`types.ts`), LLM 공용 프롬프트(`prompt.ts`), 클라이언트에서도 안전한 메타데이터·8개 언어 목록(`config.ts`), 공통 에러 메시지 변환(`errors.ts`), 레지스트리(`index.ts`). 모든 엔진 fetch에 15초 타임아웃, LLM 3종(Gemini/Groq/OpenRouter)은 `max_tokens`/`maxOutputTokens: 1024` 적용됨.
- `app/api/translate/route.ts` — 활성화된 엔진만 병렬 호출하는 API Route. 언어코드/엔진id 화이트리스트 검증, 빈 텍스트/3000자 초과 거부(400).
- `app/api/notion/route.ts` — 선택한 번역(다중 선택 가능) + 엔진별 결과를 노션 데이터베이스에 저장하는 API Route. `selectedEngineIds`를 화이트리스트로 검증 후 Multi-select에 저장. 속성(property)은 원문(제목, 60자로 자름·`truncateTitle`)/선택한 번역기/저장 시각 3개뿐이고, 전체 원문 + 결과 있는 엔진들의 번역 결과(선택된 건 ✅ 표시)는 페이지 본문(`children` 블록, heading+paragraph)에 정리해서 넣음(2026-08-01 재설계 — 속성 방식은 안 쓴 엔진도 "비어 있음"으로 나열돼 가독성이 나빴음).
- `app/page.tsx`, `components/EngineCard.tsx` — 비교 화면 UI. 언어 선택 드롭다운(8개 언어 + 스왑 버튼), 엔진 카드 다중 선택, 저장 성공 시 노션 페이지 바로가기 링크 포함. 원문은 번역 요청 시점 값(`translatedText` 상태)으로 고정되어 저장 시점 입력창 값과 무관함.
- `app/api/back-translate/route.ts`, `lib/backTranslate.ts`, `components/tabs/BackTranslationTab.tsx` (2026-08-01) — PRD.md §7 ②번 "역번역 체크" 실제 구현. 성공한 번역 결과 전체(최대 5개)를 배치로 묶어 "역번역 담당 엔진" 1곳에만 딱 1번 호출(DeepL의 `text` 배열 파라미터 → 실패 시 Gemini 번호매김 배치 프롬프트 → 실패 시 Groq 같은 방식, `lib/engines/deepl.ts`/`gemini.ts`/`groq.ts`의 `translateBatchWith*` 함수). 자동 점수(의미 보존율 %) 계산은 하지 않고 원문/번역/역번역 3단만 나란히 보여줌 — 이전에 배틀 뷰의 어절 겹침 로직을 재사용했던 구버전(`BackTranslateCheckTab.tsx`, 삭제됨)은 어순만 달라도 점수가 낮게 나오는 문제로 폐기함. "번역기들" 탭의 "전체 결과 역번역으로 검증 →" 버튼(성공한 결과 1개 이상이면 표시)을 눌러야만 탭 전환 + API 호출이 일어남(자동 실행 없음).
- `app/api/ocr/route.ts`, `lib/ocr.ts`, `components/tabs/OcrTab.tsx` (2026-08-01) — "오타 변환기" 옆의 독립 유틸리티 탭(이미지 텍스트 추출). 새 OCR 서비스 대신 Gemini의 이미지 입력을 1순위로 재사용(`extractTextFromImage`, `lib/engines/gemini.ts`), 실패 시 OpenRouter로 폴백(`extractTextWithOpenRouter`, `lib/engines/openrouter.ts`)한다. OCR용 OpenRouter 모델(`OCR_FREE_MODELS`: `nemotron-nano-12b-v2-vl` → `nemotron-3-nano-omni-30b-a3b-reasoning`)은 번역용 `FREE_MODELS`와 겹치지 않는 별도 모델로 일부러 분리함 — 무료 사용량을 번역/OCR이 나눠 쓰지 않게 하기 위함. Ctrl+V 붙여넣기/파일 선택 → 추출된 텍스트를 "번역기들" 입력창으로 보내는 흐름.
- Claude 엔진은 미구현 상태 (`ENGINE_CONFIG`에 없음). `app/api/notion/route.ts`의 라벨 매핑에는 자리만 마련돼 있음.
- `app/page.tsx`의 탭 구조(위 "현재 상태" 참고, 2026-08-01 재편): `activeTab`/`TABS`가 최상위 4탭, `activeSubTab`/`BASIC_SUB_TABS`가 "번역기들" 안의 하위 탭(결과 비교(기본값)/②역번역 체크/①배틀 뷰/③~⑥ placeholder)이다. 새 하위 기능을 추가하면 `TABS`가 아니라 `BASIC_SUB_TABS`와 `COMING_SOON_CONTENT`에 등록할 것.

### 빌드/린트/테스트 명령

```
npm run dev     # 로컬 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드 (타입 체크 포함)
npm run lint    # ESLint
```

### 알아두어야 할 이슈 (구현 중 발견)

- Gemini: 이 키의 무료 티어에서 `gemini-2.0-flash` 계열 할당량이 0으로 막혀 있어 `gemini-flash-latest`(최신 Flash 모델 별칭)를 사용하도록 구현함. 실패하면 `models?key=...` 엔드포인트로 사용 가능한 모델을 먼저 확인할 것.
- OpenRouter 무료(`:free`) 모델 목록은 자주 바뀐다. 현재 로테이션 목록(`lib/engines/openrouter.ts`의 `FREE_MODELS`)은 `inclusionai/ling-3.0-flash:free`, `nvidia/nemotron-3-nano-30b-a3b:free`, `google/gemma-4-31b-it:free`(각각 124B/30B/30.7B급, 너무 작은 모델은 아님). **2026-07-31 재점검 완료**: `https://openrouter.ai/api/v1/models` 조회 + 3개 모두 직접 chat/completions 호출로 여전히 `:free` 목록에 있고 정상 응답함을 확인, 교체 불필요. 다음에 다시 점검할 때 이 3개 중 하나라도 목록에서 사라지면 같은 방식(`/models` 조회 → `:free` 접미사 + 규모가 너무 작지 않은 모델로 교체)으로 갱신할 것.
- `.env.local`의 `NOTION_DATABASE_ID`가 실제로는 접근 불가능한 값으로 잘못 채워져 있었음 — 실제 사용 가능한 데이터베이스 ID(`NOTION_PARENT_PAGE_ID`와 동일한 값, 워크스페이스 최상위 풀페이지 데이터베이스라 페이지 ID와 데이터베이스 ID가 같음)로 수정함. 노션 저장이 "Could not find database" 오류를 내면 이 값부터 확인할 것.
- DeepL은 베트남어(vi)를 지원하지 않는다(`lib/engines/deepl.ts`의 `DEEPL_SOURCE_LANG`/`DEEPL_TARGET_LANG`에 vi 없음). vi가 낀 언어쌍을 요청하면 DeepL 카드에만 "지원하지 않는 언어쌍" 에러가 뜨고 나머지 엔진은 정상 동작한다 — 버그 아니라 의도된 동작.
- MyMemory는 500자 초과 입력을 사전에 거부한다(`lib/engines/mymemory.ts`의 `MAX_LENGTH`). 500자 이하인데도 서버가 JSON이 아닌 응답(HTML 에러 페이지)을 주는 경우가 있어 `content-type`이 `application/json`이 아니면 원문 대신 안내 메시지로 대체하도록 방어해 둠.
- LLM 엔진(Gemini/Groq/OpenRouter) 응답 폭주 이슈: 반복 문자열 등 특정 입력에서 출력 토큰 상한 없이 호출하면 응답이 비정상적으로 길어짐(실측 OpenRouter 기준 입력의 8배, 114,435자). `max_tokens`/`maxOutputTokens: 1024`로 고정해 둠 — 이 값을 늘릴 때는 노션 rich_text 2000자 제한(`app/api/notion/route.ts`의 `NOTION_TEXT_LIMIT`)과 같이 고려할 것.
- 노션 "선택한 번역기" 속성은 Multi-select다. `app/api/notion/route.ts`의 `ENGINE_LABELS`가 유일한 화이트리스트이므로, 새 엔진을 추가하면 여기에도 라벨을 등록해야 하고 노션 데이터베이스의 Multi-select 옵션도 같은 이름으로 추가해야 한다(안 하면 저장은 되지만 노션 쪽에서 새 옵션이 자동 생성됨).
- 노션 저장의 중복 방지 가드는 10초 윈도우 인메모리 dedupe라 서버 재시작 시 초기화된다 — 개인용 단일 프로세스 도구라 이 정도로 충분하다고 판단함 (`PRD.md` §15 "노션 저장" 참고).

## 작업 시 참고할 것

**앱의 진짜 목적**은 예쁜 화면이 아니라 ① 여러 실제 번역 API의 품질을 비교하고 ② 최종 선택한 번역을 노션에 기록하는 것이다 (2026-07-30 제작 인터뷰에서 확정, `PRD.md` 변경 이력 참고). Mock/시뮬레이션 결과로 대충 채우지 말고 실제 API 연동을 우선한다.

- 새 기능을 구현하기 전에 반드시 `PRD.md`를 먼저 읽는다. 특히 §15 "완료된 작업 이력" 맨 끝 "남은 백로그"에 다음 라운드 후보가 정리돼 있다.
- 번역 엔진은 현재 5개(DeepL/MyMemory/Gemini/Groq/OpenRouter) 연동 완료, Claude가 다음 후보로 남아있다. 엔진 목록은 `lib/engines/config.ts`(`ENGINE_CONFIG`)로 관리하고, 각 엔진은 켜기/끄기 토글로 호출 여부를 제어한다. 공통 인터페이스: `getTranslations(text, sourceLang, targetLang, enabledEngineIds)` (`PRD.md` §6.2, `lib/engines/index.ts`).
- API 키는 절대 프론트엔드에 노출하지 않는다. Next.js API Route(서버 사이드)에서만 사용하고 `.env.local`에 보관한다.
- 노션 저장은 **수동 버튼 클릭으로만** 발생해야 한다 (자동 저장 금지). 저장 항목은 **다중 선택된 번역기들**이며, 그 순간 호출됐던 모든 엔진의 결과도 함께 백업되지만 **속성이 아니라 페이지 본문**에 정리해서 넣는다(`PRD.md` §6.3, §8). 단일 선택으로 되돌리지 말 것.
- 언어는 ko/en 고정이 아니라 8개 언어(ko/en/ja/zh/es/fr/de/vi) 중 자유 선택이다(`PRD.md` §6.1, `lib/engines/config.ts`의 `SUPPORTED_LANGUAGES`). 새 언어를 추가할 때는 엔진별 언어 코드 매핑(특히 DeepL의 미지원 언어)도 같이 챙길 것.
- API 키(DeepL/Gemini/Groq/OpenRouter/Notion)는 모두 발급·연동 완료 상태다 (`PRD.md` §10). Google/파파고/MS Translator/Claude만 아직 미도입.
- Part 2의 특색 아이디어(`PRD.md` §7)는 이번 목적과 직접 관련이 적어 우선순위가 낮다. ①번역 신뢰도 배틀 뷰·②역번역 체크는 이미 구현 완료됐고, ③~⑥은 시간 여유가 있을 때만 선택해서 얹는다.

## 프로젝트 문서 관리

- 새 기능 구현을 시작/종료할 때는 `PRD.md`를 갱신하고, 세션 인수인계가 필요하면 `HANDOVER.md`를 새로 만들어 누적 기록한다 (관련 규칙: `Yoom_project-docs` 스킬).
- 문서는 한국어로 작성한다.
