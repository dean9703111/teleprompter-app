import { describe, expect, it } from 'vitest';
import { createReadingLine } from './textIndex';

// 每個 token 的行中心：第一段兩行，段落最後一行很短，空一行後接第二段
const LINE_HEIGHT = 67;
const centers = [
  ...Array(7).fill(100),
  ...Array(7).fill(167),
  ...Array(2).fill(234),
  ...Array(7).fill(368),
  ...Array(7).fill(435),
];

const readingLine = () => createReadingLine(centers.length, (i) => centers[i], LINE_HEIGHT);

describe('createReadingLine', () => {
  it('位置只會往前，跨段落、跨短行也不倒退', () => {
    const at = readingLine();
    let previous = -Infinity;
    for (let position = 0; position <= centers.length - 1; position += 0.05) {
      const y = at(position)!;
      expect(y).toBeGreaterThan(previous);
      previous = y;
    }
  });

  it('念到一行中間時，該行中心就在跟讀線上', () => {
    const at = readingLine();
    expect(at(3)).toBeCloseTo(100);
    expect(at(10)).toBeCloseTo(167);
  });

  it('段落間的空行由前後兩行各分擔一半', () => {
    const at = readingLine();
    // 短行（index 14–15）與下一段第一行（index 16）的分界 = 234 與 368 的中點
    const boundary = (234 + 368) / 2;
    expect(at(15)!).toBeLessThan(boundary);
    expect(at(16)!).toBeGreaterThan(boundary);
  });

  it('量不到的 token 沿用前一個的位置', () => {
    const at = createReadingLine(3, (i) => (i === 1 ? null : 100), LINE_HEIGHT);
    expect(at(1)).toBeCloseTo(100);
  });

  it('超出範圍時夾在頭尾', () => {
    const at = readingLine();
    expect(at(-5)).toBe(at(0));
    expect(at(999)).toBe(at(centers.length - 1));
  });
});
