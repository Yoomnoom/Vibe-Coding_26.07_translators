// 임시 QA 스크린샷 스크립트 (2차: 08~12). 검증 후 삭제해도 무방.
// scripts/screenshot.mjs(01~07)를 참고/재사용해 이어서 작성함.
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

async function waitForTranslateDone(page) {
  await page.getByRole("button", { name: "번역하기" }).waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  logConsole(page, "main");

  console.log(`[nav] ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  // ---- 08: DeepL 토글 OFF 직후 ----
  const deeplToggle = page.getByRole("button", { name: "DeepL 엔진 끄기" });
  await deeplToggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "08-toggle-off.png"), fullPage: true });
  console.log("saved 08-toggle-off.png");

  // ---- 09: DeepL 꺼진 상태에서 번역 실행 결과 ----
  const textarea = page.getByLabel("번역할 문장 입력");
  await textarea.click();
  await textarea.fill("안녕하세요, 오늘 날씨가 좋네요");
  await page.getByRole("button", { name: "번역하기" }).click();
  console.log("[wait] translating (deepl off)...");
  await waitForTranslateDone(page);
  await page.screenshot({ path: path.join(OUT_DIR, "09-toggle-off-translate.png"), fullPage: true });
  console.log("saved 09-toggle-off-translate.png");

  // ---- 10: 모바일 뷰포트(375x800)에서 번역 결과 ----
  // 상태를 깨끗하게 리셋하기 위해 새로고침(엔진 전부 ON, 입력 비움) 후 진행.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(300);
  const textareaMobile = page.getByLabel("번역할 문장 입력");
  await textareaMobile.click();
  await textareaMobile.fill("안녕하세요, 오늘 날씨가 좋네요");
  await page.getByRole("button", { name: "번역하기" }).click();
  console.log("[wait] translating (mobile)...");
  await waitForTranslateDone(page);
  await page.screenshot({ path: path.join(OUT_DIR, "10-mobile-results.png"), fullPage: true });
  console.log("saved 10-mobile-results.png");

  // ---- 11: 데스크탑으로 복귀 후 노션 저장 성공 ----
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const textareaSave = page.getByLabel("번역할 문장 입력");
  await textareaSave.click();
  await textareaSave.fill("[스크린샷 QA] 안녕하세요, 오늘 날씨가 좋네요");
  await page.getByRole("button", { name: "번역하기" }).click();
  console.log("[wait] translating (for notion save)...");
  await waitForTranslateDone(page);

  // DeepL 카드 선택
  const selectDeepl = page.getByRole("button", { name: "DeepL 번역 선택 (다른 엔진도 함께 선택 가능)" });
  await selectDeepl.click({ timeout: 5000 });
  await page.waitForTimeout(300);

  const saveBtn = page.getByRole("button", { name: /^노션에 저장/ });
  await saveBtn.click();
  console.log("[wait] saving to notion...");
  await page.getByText("노션에 저장됐습니다!").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "11-save-success.png"), fullPage: true });
  console.log("saved 11-save-success.png");

  // ---- 12: 에러 상태 (빈 텍스트로 번역하기 클릭) ----
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "번역하기" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "12-error-state.png"), fullPage: true });
  console.log("saved 12-error-state.png");

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
