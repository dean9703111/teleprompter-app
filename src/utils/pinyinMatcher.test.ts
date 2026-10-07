import { describe, expect, it } from 'vitest';
import { locate, relocate, tokenize, type Token } from './pinyinMatcher';
import { isSignificant } from './textIndex';

const keys = (text: string) => tokenize(text).map((token) => token.key).join(' ');

const SCRIPT = `大家好，我是林鼎淵，今天要跟大家分享如何用 ChatGPT 提升工作效率。
根據 2024 年的調查，有 35% 的上班族每天都會使用 AI 工具。
第一個重點是要學會下指令，指令越清楚，得到的答案就越精準。
第二個重點是要懂得驗證，AI 有時候會一本正經地胡說八道。
最後，我們來看看三個實際的案例，分別是寫信、整理會議記錄、還有做簡報。`;

const scriptTokens = tokenize(SCRIPT);
const significant = Array.from(SCRIPT).filter(isSignificant);
const readUpTo = (index: number) => (index < 0 ? '' : significant.slice(0, scriptTokens[index].end).join(''));

// 模擬辨識：每句逐字送出 interim 結果，句末成為 final
const follow = (utterances: string[], start = -1) => {
  let cursor = start;
  let spoken: Token[] = [];
  for (const utterance of utterances) {
    const chars = Array.from(utterance);
    for (let n = 1; n <= chars.length; n++) {
      const all = spoken.concat(tokenize(chars.slice(0, n).join('')));
      const match = locate(scriptTokens, all, cursor) ?? relocate(scriptTokens, all, cursor);
      if (match) cursor = match.index;
    }
    spoken = spoken.concat(tokenize(utterance)).slice(-40);
  }
  return cursor;
};

describe('tokenize', () => {
  it.each([
    ['2024年', 'er lin er si nian'],
    ['35%', 'bai fen zi san si wu'],
    ['百分之35', 'bai fen zi san si wu'],
    ['3.5', 'san dian wu'],
    ['1,000', 'yi qian'],
    ['12', 'si er'],
    ['105', 'yi bai lin wu'],
    ['10001', 'yi wan lin yi'],
    ['110000', 'si yi wan'],
    ['0912345678', 'lin jiu yi er san si wu liu qi ba'],
    ['兩千', 'er qian'],
    ['iPhone 15', 'iphone si wu'],
  ])('把 %s 轉成中文念法的拼音', (input, expected) => {
    expect(keys(input)).toBe(expected);
  });

  it('數字的每個音節都對應回原本的數字字元', () => {
    const tokens = tokenize('有 35% 的');
    // 百分之三十五：6 個音節都指向「35」
    expect(tokens.map((token) => [token.start, token.end])).toEqual([
      [0, 1],
      ...Array(6).fill([1, 3]),
      [3, 4],
    ]);
  });

  it('英文單字是一個 token，涵蓋整個單字', () => {
    const [, word] = tokenize('用ChatGPT');
    expect(word).toMatchObject({ key: 'chatgpt', latin: true, start: 1, end: 8 });
  });

  it('破音字帶上其他讀音', () => {
    const [, hang] = tokenize('銀行');
    expect(hang.key).toBe('xin');
    expect(hang.alts).toContain('hang');
  });
});

describe('locate / relocate', () => {
  it('照稿念會跟到念到的位置', () => {
    expect(readUpTo(follow(['大家好我是林鼎淵', '今天要跟大家分享如何用ChatGPT提升工作效率']))).toMatch(/提升工作效率$/);
  });

  it('數字用中文念也對得上阿拉伯數字', () => {
    const cursor = follow(['大家好我是林鼎淵今天要跟大家分享如何用 chat GPT 提升工作效率', '根據二零二四年的調查有百分之三十五的上班族']);
    expect(readUpTo(cursor)).toMatch(/的上班族$/);
  });

  it('容許同音錯字與口音', () => {
    expect(readUpTo(follow(['大家好我是林頂元', '今天要跟大家分享如何用恰GPT提升工作笑綠']))).toMatch(/工作效率$/);
    expect(readUpTo(follow(['大家好我是林頂淵今天要跟大家分享', '如何用ChatGPT提生工作效律']))).toMatch(/工作效率$/);
  });

  it('破音字任一讀音都算對上', () => {
    const script = tokenize('我們明天一起去銀行開戶');
    const match = locate(script, tokenize('明天一起去銀航開戶'), -1);
    expect(match?.similarity).toBe(1);
  });

  it('脫稿時位置不會亂跑', () => {
    const before = follow(['大家好我是林鼎淵']);
    const after = follow(['大家好我是林鼎淵', '嗯先講一下我昨天晚上吃了牛肉麵很好吃']);
    expect(after - before).toBeLessThanOrEqual(3);
  });

  it('脫稿後回到稿子會接上', () => {
    const cursor = follow(['大家好我是林鼎淵', '嗯先講一下我昨天晚上吃了牛肉麵很好吃', '今天要跟大家分享如何用ChatGPT提升工作效率']);
    expect(readUpTo(cursor)).toMatch(/提升工作效率$/);
  });

  it('跳段落、跳到最後一段都能重新定位', () => {
    expect(readUpTo(follow(['大家好我是林鼎淵', '第二個重點是要懂得驗證AI有時候會一本正經地胡說八道']))).toMatch(/胡說八道$/);
    expect(readUpTo(follow(['大家好我是林鼎淵', '最後我們來看看三個實際的案例分別是寫信']))).toMatch(/分別是寫信$/);
  });

  it('講無關的內容不會移動', () => {
    expect(follow(['今天天氣真好我們去公園散步吧然後去吃冰淇淋'])).toBe(-1);
  });

  it('回頭重念上一句會倒回去', () => {
    const end = follow(['第一個重點是要學會下指令指令越清楚得到的答案就越精準'], 30);
    const reread = follow(['第一個重點是要學會下指令指令越清楚得到的答案就越精準', '第一個重點是要學會下指令'], 30);
    expect(readUpTo(end)).toMatch(/越精準$/);
    expect(readUpTo(reread)).toMatch(/學會下指令$/);
  });
});
