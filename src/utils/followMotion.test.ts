import { describe, expect, it } from 'vitest';
import { createMotion, predictPosition, recordHeard, recordMatch, resetMotion } from './followMotion';

const MAX_INDEX = 1000;

// 以每秒 4 個字的速度念 2 秒，每 250ms 比對到一次
const speakSteadily = () => {
  const motion = createMotion();
  for (let t = 0; t <= 2000; t += 250) {
    recordHeard(motion, t);
    recordMatch(motion, t / 250, t);
  }
  return motion;
};

describe('followMotion', () => {
  it('還沒估出語速前，不做預測', () => {
    const motion = createMotion();
    recordHeard(motion, 0);
    recordMatch(motion, 5, 0);
    expect(predictPosition(motion, 200, MAX_INDEX)).toBe(5);
  });

  it('說話中依語速往前推，並補上辨識延遲', () => {
    const motion = speakSteadily();
    expect(motion.rate).toBeCloseTo(4);
    // 最後比對在 t=2000（index 8），250ms 後：8 + 4 × (0.25 + 0.4)
    expect(predictPosition(motion, 2250, MAX_INDEX)).toBeCloseTo(10.6);
  });

  it('超前最多 1.2 秒的量', () => {
    const motion = speakSteadily();
    recordHeard(motion, 2800);
    // 0.9 秒 + 0.4 秒延遲補償 = 1.3 秒，超過上限只算 1.2 秒
    expect(predictPosition(motion, 2900, MAX_INDEX)).toBeCloseTo(8 + 4 * 1.2);
  });

  it('停頓（沒有辨識結果）時不再前進，也不倒退', () => {
    const motion = speakSteadily();
    const ahead = predictPosition(motion, 2250, MAX_INDEX);
    expect(predictPosition(motion, 4000, MAX_INDEX)).toBe(ahead);
  });

  it('預測稍微超前時等實際比對追上，不倒退', () => {
    const motion = speakSteadily();
    const ahead = predictPosition(motion, 2250, MAX_INDEX);
    recordHeard(motion, 2300);
    recordMatch(motion, 9, 2300);
    expect(predictPosition(motion, 2300, MAX_INDEX)).toBeGreaterThanOrEqual(ahead);
  });

  it('真的回頭重念時會倒回去', () => {
    const motion = speakSteadily();
    expect(predictPosition(motion, 2250, MAX_INDEX)).toBeCloseTo(10.6);
    recordHeard(motion, 2500);
    recordMatch(motion, 2, 2500);
    // 倒回 index 2，仍在說話所以加上 0.4 秒延遲補償：2 + 4 × 0.4
    expect(predictPosition(motion, 2500, MAX_INDEX)).toBeCloseTo(3.6);
  });

  it('重新定位後從新位置開始，保留語速', () => {
    const motion = speakSteadily();
    resetMotion(motion, 50, 3000);
    expect(predictPosition(motion, 3000, MAX_INDEX)).toBe(50);
    expect(motion.rate).toBeCloseTo(4);
  });

  it('不超過稿子結尾', () => {
    const motion = speakSteadily();
    expect(predictPosition(motion, 2250, 9)).toBe(9);
  });
});
