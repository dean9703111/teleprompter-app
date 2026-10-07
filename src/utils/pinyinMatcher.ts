import { pinyin } from 'pinyin-pro';
import { isSignificant } from './textIndex';

export interface Token {
  key: string;
  // 破音字的其他讀音（已套用模糊音）
  alts?: string[];
  latin: boolean;
  // 對應原文「有效字元」序號區間 [start, end)
  start: number;
  end: number;
}

export interface Match {
  index: number;
  similarity: number;
}

const MATCH_THRESHOLD = 0.7;
const REWIND_THRESHOLD = 0.85;
const JUMP_THRESHOLD = 0.85;
const QUERY_SIZE = 10;
const SHORT_QUERY_SIZE = 6;
const MIN_QUERY_SIZE = 4;
const JUMP_MIN_QUERY_SIZE = 8;
const LOOK_BEHIND = 30;
const LOOK_AHEAD = 150;
const SHORT_LOOK_AHEAD = 40;

const HAN = /\p{Script=Han}/u;
const LATIN = /\p{Script=Latin}/u;

// 念法相同、寫法不同的字
const CHAR_ALIASES: Record<string, string> = { 兩: '二', 两: '二', 幺: '一' };

const CN_DIGITS = '零一二三四五六七八九';
const NUMBER_PINYIN: Record<string, string> = {
  零: 'ling',
  一: 'yi',
  二: 'er',
  三: 'san',
  四: 'si',
  五: 'wu',
  六: 'liu',
  七: 'qi',
  八: 'ba',
  九: 'jiu',
  十: 'shi',
  百: 'bai',
  千: 'qian',
  萬: 'wan',
  億: 'yi',
  兆: 'zhao',
  點: 'dian',
  分: 'fen',
  之: 'zhi',
};

// 台灣口音常見的捲舌 / 後鼻音不分：zh→z、ch→c、sh→s、ing→in、eng→en
const fuzzy = (syllable: string) => syllable.replace(/^([zcs])h/, '$1').replace(/([ie])ng$/, '$1n');

const readingsCache = new Map<string, string[]>();

const getReadings = (ch: string) => {
  let readings = readingsCache.get(ch);
  if (!readings) {
    readings = [...new Set(pinyin(ch, { multiple: true, type: 'array', toneType: 'none' }).map(fuzzy))];
    readingsCache.set(ch, readings);
  }
  return readings;
};

const readDigits = (digits: string) => [...digits].map((d) => CN_DIGITS[Number(d)]).join('');

const readGroup = (value: number) => {
  const units = ['千', '百', '十', ''];
  const digits = value.toString().padStart(4, '0');
  let out = '';
  let pendingZero = false;
  for (let i = 0; i < 4; i++) {
    const d = Number(digits[i]);
    if (d === 0) {
      if (out) pendingZero = true;
      continue;
    }
    if (pendingZero) {
      out += '零';
      pendingZero = false;
    }
    out += CN_DIGITS[d] + units[i];
  }
  return out;
};

const readInteger = (digits: string) => {
  const trimmed = digits.replace(/^0+/, '');
  if (!trimmed) return '零';

  const groupUnits = ['', '萬', '億', '兆'];
  const groups: number[] = [];
  for (let end = trimmed.length; end > 0; end -= 4) {
    groups.unshift(Number(trimmed.slice(Math.max(0, end - 4), end)));
  }

  let out = '';
  let pendingZero = false;
  groups.forEach((group, i) => {
    if (group === 0) {
      if (out) pendingZero = true;
      return;
    }
    if (out && (pendingZero || group < 1000)) out += '零';
    out += readGroup(group) + groupUnits[groups.length - 1 - i];
    pendingZero = false;
  });

  return out.startsWith('一十') ? out.slice(1) : out;
};

const toAsciiDigit = (ch: string | undefined) => {
  if (!ch) return null;
  const normalized = ch.normalize('NFKC');
  return normalized.length === 1 && normalized >= '0' && normalized <= '9' ? normalized : null;
};

// 數字一律轉成中文念法：2024年→二零二四年、35%→百分之三十五、3.5→三點五、1,000→一千
export const tokenize = (text: string): Token[] => {
  const chars = Array.from(text);
  const ordinals: number[] = [];
  let ordinal = 0;
  for (const ch of chars) ordinals.push(isSignificant(ch) ? ordinal++ : -1);

  const tokens: Token[] = [];
  let hanRun = '';
  let hanOrdinals: number[] = [];
  let word = '';
  let wordStart = -1;
  let wordEnd = -1;

  const flushHan = () => {
    if (!hanRun) return;
    const runChars = Array.from(hanRun);
    const syllables = pinyin(hanRun, { toneType: 'none', type: 'array' });
    hanOrdinals.forEach((start, i) => {
      const key = fuzzy(syllables[i] ?? '');
      const alts = getReadings(runChars[i]).filter((reading) => reading !== key);
      tokens.push({ key, ...(alts.length && { alts }), latin: false, start, end: start + 1 });
    });
    hanRun = '';
    hanOrdinals = [];
  };

  const flushWord = () => {
    if (!word) return;
    tokens.push({ key: word, latin: true, start: wordStart, end: wordEnd });
    word = '';
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const ord = ordinals[i];

    if (ord < 0) {
      flushHan();
      flushWord();
      continue;
    }

    if (toAsciiDigit(ch)) {
      flushHan();
      flushWord();

      let j = i;
      let intPart = '';
      let fracPart = '';
      let lastDigit = i;
      for (let d = toAsciiDigit(chars[j]); d; d = toAsciiDigit(chars[j])) {
        intPart += d;
        lastDigit = j++;
        const isThousandsSeparator =
          chars[j] === ',' &&
          toAsciiDigit(chars[j + 1]) &&
          toAsciiDigit(chars[j + 2]) &&
          toAsciiDigit(chars[j + 3]) &&
          !toAsciiDigit(chars[j + 4]);
        if (isThousandsSeparator) j++;
      }
      if (chars[j] === '.' && toAsciiDigit(chars[j + 1])) {
        j++;
        for (let d = toAsciiDigit(chars[j]); d; d = toAsciiDigit(chars[j])) {
          fracPart += d;
          lastDigit = j++;
        }
      }

      let k = j;
      while (chars[k] === ' ') k++;
      const isPercent = chars[k] === '%' || chars[k] === '％';
      const isYear = chars[k] === '年' && intPart.length === 4 && !fracPart;
      const readAsDigits = isYear || intPart.length > 12 || (intPart.length > 1 && intPart.startsWith('0'));

      let reading = readAsDigits ? readDigits(intPart) : readInteger(intPart);
      if (fracPart) reading += '點' + readDigits(fracPart);
      if (isPercent) reading = '百分之' + reading;

      const start = ord;
      const end = ordinals[lastDigit] + 1;
      for (const c of reading) {
        tokens.push({ key: fuzzy(NUMBER_PINYIN[c]), latin: false, start, end });
      }

      i = lastDigit;
      continue;
    }

    if (HAN.test(ch)) {
      flushWord();
      hanRun += CHAR_ALIASES[ch] ?? ch;
      hanOrdinals.push(ord);
      continue;
    }

    if (LATIN.test(ch)) {
      flushHan();
      if (!word) wordStart = ord;
      word += ch.normalize('NFKC').toLowerCase();
      wordEnd = ord + 1;
      continue;
    }

    flushHan();
    flushWord();
    tokens.push({ key: ch.normalize('NFKC').toLowerCase(), latin: false, start: ord, end: ord + 1 });
  }

  flushHan();
  flushWord();
  return tokens;
};

let rowA = new Int32Array(32);
let rowB = new Int32Array(32);

// 兩個拼音 / 英文單字的差異 0~1（字母層級編輯距離）
const tokenCost = (a: string, b: string) => {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 1;
  if (lb + 1 > rowA.length) {
    rowA = new Int32Array(lb + 1);
    rowB = new Int32Array(lb + 1);
  }

  let prev = rowA;
  let cur = rowB;
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const substitute = prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1);
      cur[j] = Math.min(substitute, prev[j] + 1, cur[j - 1] + 1);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[lb] / Math.max(la, lb);
};

// 任一讀音相同就算對上（銀行 xing/hang、長大 chang/zhang）
const pairCost = (a: Token, b: Token) => {
  if (a.key === b.key || b.alts?.includes(a.key) || a.alts?.includes(b.key)) return 0;
  return tokenCost(a.key, b.key);
};

// 半全域對齊：query 必須整段對上，稿子可以從任意位置開始；回傳「query 結尾落在稿子每個位置」的相似度
const scan = (script: Token[], query: Token[], from: number, to: number) => {
  const m = query.length;
  const n = to - from;
  let prev2 = new Float32Array(n + 1);
  let prev = new Float32Array(n + 1);
  let cur = new Float32Array(n + 1);

  for (let i = 1; i <= m; i++) {
    const q = query[i - 1];
    const qPrev = i >= 2 ? query[i - 2] : undefined;
    const mergedQuery = qPrev?.latin && q.latin ? qPrev.key + q.key : null;
    cur[0] = i;

    for (let j = 1; j <= n; j++) {
      const t = script[from + j - 1];
      let best = Math.min(prev[j - 1] + pairCost(q, t), prev[j] + 1, cur[j - 1] + 1);

      // 英文允許 2:1 合併，讓 ChatGPT ↔ chat GPT、YouTube ↔ you tube 對得上
      if (q.latin && t.latin) {
        if (mergedQuery) best = Math.min(best, prev2[j - 1] + tokenCost(mergedQuery, t.key));
        const tPrev = j >= 2 ? script[from + j - 2] : undefined;
        if (tPrev?.latin) best = Math.min(best, prev[j - 2] + tokenCost(q.key, tPrev.key + t.key));
      }

      cur[j] = best;
    }
    [prev2, prev, cur] = [prev, cur, prev2];
  }

  const similarities = new Float32Array(n);
  for (let j = 1; j <= n; j++) similarities[j - 1] = 1 - prev[j] / m;
  return similarities;
};

// 最後念出的字要能對上該位置，否則脫稿的第一個字會把位置往前拖
const endsAt = (last: Token, target: Token) => {
  if (pairCost(last, target) <= 0.5) return true;
  return last.latin && target.latin && (target.key.endsWith(last.key) || last.key.endsWith(target.key));
};

const pick = (script: Token[], query: Token[], similarities: Float32Array, from: number, cursor: number) => {
  const last = query[query.length - 1];
  let best: Match | null = null;
  let bestScore = -Infinity;

  for (let k = 0; k < similarities.length; k++) {
    const similarity = similarities[k];
    if (similarity < MATCH_THRESHOLD) continue;

    const index = from + k;
    if (!endsAt(last, script[index])) continue;
    const distance = index - cursor;
    if (distance < -2 && similarity < REWIND_THRESHOLD) continue;

    const score = similarity - (distance >= 0 ? 0.002 * distance : 0.005 * -distance);
    if (score > bestScore) {
      bestScore = score;
      best = { index, similarity };
    }
  }

  // 往回 1~2 個字通常是辨識結果在抖動，不要倒退
  if (best && best.index < cursor && best.index >= cursor - 2) return { index: cursor, similarity: best.similarity };
  return best;
};

// visible：畫面上看得到的 token 區間 [from, to)，整段都納入搜尋（標題、跳過的句子都能直接對上）
export const locate = (
  script: Token[],
  spoken: Token[],
  cursor: number,
  visible?: [number, number],
): Match | null => {
  if (spoken.length < MIN_QUERY_SIZE || !script.length) return null;

  const query = spoken.slice(-QUERY_SIZE);
  const from = Math.max(0, Math.min(cursor - LOOK_BEHIND, visible?.[0] ?? Infinity));
  const to = Math.min(script.length, Math.max(cursor + 1 + LOOK_AHEAD, visible?.[1] ?? 0));
  const match = pick(script, query, scan(script, query, from, to), from, cursor);
  if (match || query.length <= SHORT_QUERY_SIZE) return match;

  // 剛脫稿講完，長 query 前段還是即興內容，改用最後幾個字在附近找
  const shortQuery = spoken.slice(-SHORT_QUERY_SIZE);
  const shortFrom = Math.max(0, cursor - SHORT_QUERY_SIZE - 2);
  const shortTo = Math.min(script.length, cursor + 1 + SHORT_LOOK_AHEAD);
  return pick(script, shortQuery, scan(script, shortQuery, shortFrom, shortTo), shortFrom, cursor);
};

// 附近找不到時全文搜尋（跳段落、手動捲錯位置），門檻較嚴
export const relocate = (script: Token[], spoken: Token[], cursor: number): Match | null => {
  if (spoken.length < JUMP_MIN_QUERY_SIZE || !script.length) return null;

  const query = spoken.slice(-QUERY_SIZE);
  const last = query[query.length - 1];
  const similarities = scan(script, query, 0, script.length);
  let best: Match | null = null;
  let bestScore = -Infinity;
  for (let index = 0; index < similarities.length; index++) {
    const similarity = similarities[index];
    if (similarity < JUMP_THRESHOLD || !endsAt(last, script[index])) continue;
    const score = similarity - 0.0001 * Math.abs(index - cursor);
    if (score > bestScore) {
      bestScore = score;
      best = { index, similarity };
    }
  }
  return best;
};
