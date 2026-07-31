import { chromium } from "playwright";

const errors = [];
const pageErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => {
  pageErrors.push(String(err));
});

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

const textarea = page.locator("textarea").first();
await textarea.fill("[회귀QA-UI플로우] 오늘 회의는 몇 시에 시작하나요?");

const translateBtn = page.locator('button:has-text("번역하기")').first();
await translateBtn.click();

// wait for results to appear (up to 20s)
await page.waitForTimeout(20000);

const selectButtons = page.locator('button[aria-label*="번역 선택"]');
const selectCount = await selectButtons.count();
console.log("SELECT_BUTTONS_FOUND", selectCount);

for (let i = 0; i < selectCount; i++) {
  const label = await selectButtons.nth(i).getAttribute("aria-label");
  const disabled = await selectButtons.nth(i).isDisabled();
  console.log(`SELECT_BTN[${i}] label="${label}" disabled=${disabled}`);
}

let clicked = 0;
for (let i = 0; i < selectCount && clicked < 2; i++) {
  const disabled = await selectButtons.nth(i).isDisabled();
  if (!disabled) {
    await selectButtons.nth(i).click();
    await page.waitForTimeout(200);
    clicked++;
  }
}
console.log("CLICKED_SELECT_COUNT", clicked);

const pressedStates = [];
for (let i = 0; i < selectCount; i++) {
  pressedStates.push(await selectButtons.nth(i).getAttribute("aria-pressed"));
}
console.log("ARIA_PRESSED_STATES", JSON.stringify(pressedStates));

const saveBtn = page.locator('button:has-text("노션에 저장")').first();
const saveBtnCount = await saveBtn.count();
console.log("SAVE_BUTTON_FOUND", saveBtnCount);
if (saveBtnCount > 0) {
  console.log("SAVE_BUTTON_DISABLED", await saveBtn.isDisabled());
  console.log("SAVE_BUTTON_TEXT", await saveBtn.textContent());
}

console.log("CONSOLE_ERRORS_COUNT", errors.length);
console.log("PAGE_ERRORS_COUNT", pageErrors.length);
if (errors.length) console.log("CONSOLE_ERRORS", JSON.stringify(errors, null, 2));
if (pageErrors.length) console.log("PAGE_ERRORS", JSON.stringify(pageErrors, null, 2));

await page.screenshot({ path: "C:/Users/Yoom/AppData/Local/Temp/claude/e--ai-------Yoom---25-------/e140e25d-3e24-4e30-b4a8-6010ec06716c/scratchpad/qa_flow.png", fullPage: true });

await browser.close();
