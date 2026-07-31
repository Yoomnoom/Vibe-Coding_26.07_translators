// 임시 QA 스크린샷 스크립트. 검증 후 삭제해도 무방.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", ".qa-screenshots");
const BASE_URL = process.env.QA_BASE_URL || "http://localhost:3000";

const consoleMessages = [];
const pageErrors = [];

function logConsole(page, tag) {
  page.on("console", (msg) => {
    consoleMessages.push({ tag, type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ tag, message: err.message, stack: err.stack });
  });
  page.on("requestfailed", (req) => {
    consoleMessages.push({
      tag,
      type: "requestfailed",
      text: `${req.method()} ${req.url()} - ${req.failure()?.errorText}`,
    });
  });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  logConsole(page, "main");

  console.log(`[nav] ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // 01: 초기 상태
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "01-basic-empty.png"), fullPage: true });
  console.log("saved 01-basic-empty.png");

  // 02: 입력만 한 상태
  const textarea = page.getByLabel("번역할 문장 입력");
  await textarea.click();
  await textarea.fill("안녕하세요, 오늘 날씨가 좋네요");
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, "02-basic-input.png"), fullPage: true });
  console.log("saved 02-basic-input.png");

  // 03: 번역하기 클릭 후 5개 엔진 결과 대기
  const translateBtn = page.getByRole("button", { name: "번역하기" });
  await translateBtn.click();
  console.log("[wait] translating...");
  // 버튼이 "번역 중..."에서 다시 "번역하기"로 돌아올 때까지 대기 (최대 60초)
  await page
    .getByRole("button", { name: "번역하기" })
    .waitFor({ state: "visible", timeout: 60000 });
  // 로딩 스피너가 모두 사라질 시간을 좀 더 확보
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "03-basic-results.png"), fullPage: true });
  console.log("saved 03-basic-results.png");

  // 04: 카드 2개 선택
  // EngineCard 내부 "이 번역 선택 (여러 개 가능)" 버튼의 aria-label로 정확히 타겟팅.
  const engineLabels = ["DeepL", "MyMemory", "Gemini", "Groq", "OpenRouter"];
  let selectedCount = 0;
  for (const label of engineLabels) {
    if (selectedCount >= 2) break;
    try {
      const selectBtn = page.getByRole("button", {
        name: `${label} 번역 선택 (다른 엔진도 함께 선택 가능)`,
      });
      await selectBtn.click({ timeout: 3000 });
      selectedCount++;
      console.log(`[select] clicked select-button for: ${label}`);
    } catch (e) {
      console.log(`[select] failed to click ${label}: ${e.message}`);
    }
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "04-basic-selected.png"), fullPage: true });
  console.log("saved 04-basic-selected.png");

  // 05: 배틀 뷰 탭
  await page.getByRole("tab", { name: "① 번역 신뢰도 배틀 뷰" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "05-battle-tab.png"), fullPage: true });
  console.log("saved 05-battle-tab.png");

  // 06: 준비중 탭 (역번역 체크)
  await page.getByRole("tab", { name: "② 역번역 체크" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "06-comingsoon-tab.png"), fullPage: true });
  console.log("saved 06-comingsoon-tab.png");

  // 07: 언어 드롭다운 열기 (기본 비교 탭으로 돌아가서)
  await page.getByRole("tab", { name: "기본 비교" }).click();
  await page.waitForTimeout(300);
  const sourceSelect = page.getByLabel("원본 언어 (번역할 문장이 작성된 언어)");
  await sourceSelect.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "07-language-dropdown.png"), fullPage: true });
  console.log("saved 07-language-dropdown.png");

  await browser.close();

  console.log("\n=== CONSOLE MESSAGES ===");
  if (consoleMessages.length === 0) {
    console.log("(none)");
  } else {
    for (const m of consoleMessages) {
      console.log(`[${m.tag}] ${m.type}: ${m.text}`);
    }
  }

  console.log("\n=== PAGE ERRORS ===");
  if (pageErrors.length === 0) {
    console.log("(none)");
  } else {
    for (const e of pageErrors) {
      console.log(`[${e.tag}] ${e.message}\n${e.stack}`);
    }
  }
}

main().catch((err) => {
  console.error("SCRIPT FAILED:", err);
  process.exit(1);
});
