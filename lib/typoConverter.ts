// 한글 오타 변환기 (github.com/Yoomnoom/Coding_26.07_typoConverter 이식).
// 영어 자판 상태로 잘못 입력된 한글(또는 반대로 한글 자판 상태로 잘못 입력된 영어)을 정상으로 변환한다.
// 서버 API 없이 동작하는 순수 함수 모음이라 클라이언트 컴포넌트에서 그대로 가져다 쓴다.

// ── 두벌식 자판 매핑 (영문 키 -> 한글 자모) ──────────────────────────
const QWERTY_TO_JAMO: Record<string, string> = {
  q: "ㅂ", Q: "ㅃ", w: "ㅈ", W: "ㅉ", e: "ㄷ", E: "ㄸ", r: "ㄱ", R: "ㄲ",
  t: "ㅅ", T: "ㅆ", y: "ㅛ", Y: "ㅛ", u: "ㅕ", U: "ㅕ", i: "ㅑ", I: "ㅑ",
  o: "ㅐ", O: "ㅒ", p: "ㅔ", P: "ㅖ", a: "ㅁ", A: "ㅁ", s: "ㄴ", S: "ㄴ",
  d: "ㅇ", D: "ㅇ", f: "ㄹ", F: "ㄹ", g: "ㅎ", G: "ㅎ", h: "ㅗ", H: "ㅗ",
  j: "ㅓ", J: "ㅓ", k: "ㅏ", K: "ㅏ", l: "ㅣ", L: "ㅣ", z: "ㅋ", Z: "ㅋ",
  x: "ㅌ", X: "ㅌ", c: "ㅊ", C: "ㅊ", v: "ㅍ", V: "ㅍ", b: "ㅠ", B: "ㅠ",
  n: "ㅜ", N: "ㅜ", m: "ㅡ", M: "ㅡ",
};

const CHO_LIST = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG_LIST = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG_LIST = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

const JUNG_COMBOS: Record<string, string> = {
  "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ",
  "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ",
  "ㅡㅣ": "ㅢ",
};
const JONG_COMBOS: Record<string, string> = {
  "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ",
  "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ",
  "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ",
  "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ",
};
const NOT_JONG = new Set(["ㄸ", "ㅃ", "ㅉ"]);

function textToJamo(text: string): string[] {
  return Array.from(text).map((ch) => QWERTY_TO_JAMO[ch] ?? ch);
}

// ── 자음/모음만 있는 한글 자모 구간을 영어로 되돌리기 ──────────────────
const REV_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(QWERTY_TO_JAMO)) {
  if (!(v in REV_MAP) || (k === k.toLowerCase() && REV_MAP[v] !== REV_MAP[v].toLowerCase())) {
    REV_MAP[v] = k;
  }
}
const WHITELIST = new Set([
  "ㅇㅋ", "ㅇㅇ", "ㄴㄴ", "ㄱㅅ", "ㅊㅋ", "ㅅㄱ", "ㄷㄷ",
  "ㅂㅂ", "ㄲㄴ", "ㅇㅈ", "ㄹㅇ", "ㄱㅁ", "ㅊㅊ", "ㅁㄹ", "ㅈㅅ",
]);
const MARK = "";

const KNOWN_EXTENSIONS = new Set([
  "csv", "png", "jpg", "jpeg", "gif", "svg", "bmp", "webp",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "rtf", "hwp",
  "py", "js", "ts", "jsx", "tsx", "html", "htm", "css", "json", "xml", "yml", "yaml",
  "zip", "rar", "tar", "gz",
  "mp3", "mp4", "wav", "mov", "avi", "mkv",
  "sql", "db", "log", "env", "sh", "bat", "exe", "dll",
  "java", "cpp", "go", "rs", "rb", "kt", "swift", "php",
  "ipynb", "vue", "apk", "ttf", "woff",
]);

function protectExtensions(text: string, restore: string[]): string {
  return text.replace(/(\.)([A-Za-z]{1,5})(?![A-Za-z])/g, (match, dot, ext) => {
    if (KNOWN_EXTENSIONS.has(ext.toLowerCase())) {
      const idx = restore.length;
      restore.push(ext);
      return dot + MARK + idx + MARK;
    }
    return match;
  });
}

function minimalPeriod(s: string): string {
  const n = s.length;
  for (let p = 1; p <= n; p++) {
    if (n % p === 0) {
      const candidate = s.slice(0, p).repeat(n / p);
      if (candidate === s) return s.slice(0, p);
    }
  }
  return s;
}

function fixReversedJamo(text: string, restore: string[]): string {
  const chars = Array.from(text);
  const n = chars.length;
  let i = 0;
  const out: string[] = [];
  while (i < n) {
    const ch = chars[i];
    if (CHO_LIST.includes(ch) || JUNG_LIST.includes(ch)) {
      let j = i;
      const run: string[] = [];
      while (j < n && (CHO_LIST.includes(chars[j]) || JUNG_LIST.includes(chars[j]))) {
        run.push(chars[j]);
        j++;
      }
      const runStr = run.join("");
      const hasVowel = run.some((c) => JUNG_LIST.includes(c));
      const period = minimalPeriod(runStr);
      const isRepeatedSingle = new Set(run).size === 1 && run.length >= 2;
      const protected_ =
        period.length < runStr.length || isRepeatedSingle || WHITELIST.has(period) || WHITELIST.has(runStr);
      if (!hasVowel && !protected_) {
        const english = run.map((c) => REV_MAP[c] ?? c).join("");
        out.push(MARK + restore.length + MARK);
        restore.push(english);
      } else {
        out.push(...run);
      }
      i = j;
    } else {
      out.push(ch);
      i++;
    }
  }
  return out.join("");
}

function unmask(text: string, restore: string[]): string {
  return text.replace(new RegExp(MARK + "(\\d+)" + MARK, "g"), (_, idx) => restore[Number(idx)]);
}

function assemble(jamos: string[]): string {
  const result: string[] = [];
  let cho: string | null = null;
  let jung: string | null = null;
  let jong: string | null = null;

  function flush() {
    if (cho && jung) {
      const ci = CHO_LIST.indexOf(cho);
      const ji = JUNG_LIST.indexOf(jung);
      const ki = jong ? JONG_LIST.indexOf(jong) : 0;
      result.push(String.fromCodePoint(0xac00 + (ci * 21 + ji) * 28 + ki));
    } else if (cho) {
      result.push(cho);
    } else if (jung) {
      result.push(jung);
    }
    cho = jung = jong = null;
  }

  const n = jamos.length;
  let i = 0;
  while (i < n) {
    const ch = jamos[i];
    const isCons = CHO_LIST.includes(ch);
    const isVowel = JUNG_LIST.includes(ch);

    if (!isCons && !isVowel) {
      flush();
      result.push(ch);
      i++;
      continue;
    }

    if (isVowel) {
      if (cho && !jung) {
        jung = ch;
      } else if (jung) {
        const combo: string | undefined = JUNG_COMBOS[jung + ch];
        if (combo) {
          jung = combo;
        } else {
          flush();
          jung = ch;
        }
      } else {
        flush();
        jung = ch;
      }
      i++;
      continue;
    }

    // 자음인 경우
    if (!cho) {
      if (jung) flush(); // 홀로 남아있던 모음을 먼저 정리
      cho = ch;
      i++;
      continue;
    }
    if (!jung) {
      flush();
      cho = ch;
      i++;
      continue;
    }
    if (!jong) {
      const nextIsVowel = i + 1 < n && JUNG_LIST.includes(jamos[i + 1]);
      if (NOT_JONG.has(ch) || nextIsVowel) {
        flush();
        cho = ch;
      } else {
        jong = ch;
      }
      i++;
      continue;
    } else {
      const combo: string | undefined = JONG_COMBOS[jong + ch];
      const nextIsVowel = i + 1 < n && JUNG_LIST.includes(jamos[i + 1]);
      if (combo && !nextIsVowel) {
        jong = combo;
      } else {
        flush();
        cho = ch;
      }
      i++;
      continue;
    }
  }
  flush();
  return result.join("");
}

/** 영어 자판으로 잘못 입력된 한글 문자열을 정상 한글로 변환한다. (예: "dkssudgktpdy" -> "안녕하세요") */
export function convertEnToKo(text: string): string {
  const restore: string[] = [];
  const protected_ = protectExtensions(text, restore);
  const masked = fixReversedJamo(protected_, restore);
  const converted = assemble(textToJamo(masked));
  return unmask(converted, restore);
}

// ── 반대 방향: 한글 -> 영어(자판 그대로) ────────────────────────────
const JUNG_COMBOS_REV: Record<string, string> = {};
for (const [k, v] of Object.entries(JUNG_COMBOS)) JUNG_COMBOS_REV[v] = k;
const JONG_COMBOS_REV: Record<string, string> = {};
for (const [k, v] of Object.entries(JONG_COMBOS)) JONG_COMBOS_REV[v] = k;

function jamoToLetters(jamo: string): string {
  if (jamo in REV_MAP) return REV_MAP[jamo];
  if (jamo in JUNG_COMBOS_REV) {
    const pair = JUNG_COMBOS_REV[jamo];
    return REV_MAP[pair[0]] + REV_MAP[pair[1]];
  }
  if (jamo in JONG_COMBOS_REV) {
    const pair = JONG_COMBOS_REV[jamo];
    return REV_MAP[pair[0]] + REV_MAP[pair[1]];
  }
  return jamo;
}

/** 한글 자판으로 잘못 입력된 영어 문자열을 정상 영어(자판 그대로)로 변환한다. (예: "안녕" -> "dkssud") */
export function convertKoToEn(text: string): string {
  const out: string[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const choI = Math.floor(offset / (21 * 28));
      const jungI = Math.floor((offset % (21 * 28)) / 28);
      const jongI = offset % 28;
      out.push(jamoToLetters(CHO_LIST[choI]));
      out.push(jamoToLetters(JUNG_LIST[jungI]));
      if (jongI) out.push(jamoToLetters(JONG_LIST[jongI]));
    } else if (CHO_LIST.includes(ch) || JUNG_LIST.includes(ch)) {
      out.push(jamoToLetters(ch));
    } else {
      out.push(ch);
    }
  }
  return out.join("");
}

export type TypoDirection = "en2ko" | "ko2en";

export function convertTypo(text: string, direction: TypoDirection): string {
  return direction === "en2ko" ? convertEnToKo(text) : convertKoToEn(text);
}
