import { describe, expect, it } from 'vitest';
import { createMotion, predictPosition, recordHeard, recordMatch, recordVoice, resetMotion } from './followMotion';

const MAX_INDEX = 1000;

// 以每秒 4 個字的速度念 2 秒，每 250ms 比對到一次（麥克風也一直聽得到人聲）
const speakSteadily = (start = 0) => {
  const motion = createMotion();
  for (let t = 0; t <= 2000; t += 250) {
    recordVoice(motion, t);
    recordHeard(motion, t);
    recordMatch(motion, start + t / 250, t);
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

  it('預測超前到上限後，比對結果落後也不倒退', () => {
    const motion = speakSteadily();
    recordHeard(motion, 2800);
    const ahead = predictPosition(motion, 2900, MAX_INDEX);
    recordMatch(motion, 8, 2900);
    expect(predictPosition(motion, 2900, MAX_INDEX)).toBe(ahead);
  });

  it('真的回頭重念時會倒回去', () => {
    const motion = speakSteadily(20);
    expect(predictPosition(motion, 2250, MAX_INDEX)).toBeCloseTo(30.6);
    recordHeard(motion, 2500);
    recordMatch(motion, 2, 2500);
    // 第一次落後先不倒退，等確認
    expect(predictPosition(motion, 2500, MAX_INDEX)).toBeGreaterThanOrEqual(30.6);
    recordHeard(motion, 2750);
    recordMatch(motion, 3, 2750);
    // 第二次也在附近才倒回 index 3，仍在說話所以加上 0.4 秒延遲補償：3 + 4 × 0.4
    expect(predictPosition(motion, 2750, MAX_INDEX)).toBeCloseTo(4.6);
  });

  it('單次比對誤判到前面的句子，不會往上跳', () => {
    const motion = speakSteadily(20);
    const ahead = predictPosition(motion, 2250, MAX_INDEX);
    recordHeard(motion, 2500);
    recordMatch(motion, 2, 2500);
    recordHeard(motion, 2750);
    recordMatch(motion, 31, 2750);
    expect(predictPosition(motion, 2750, MAX_INDEX)).toBeGreaterThanOrEqual(ahead);
    expect(motion.index).toBe(31);
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

  it('辨識卡住但麥克風還有人聲時，依語速繼續推進', () => {
    const motion = speakSteadily();
    const ahead = predictPosition(motion, 2250, MAX_INDEX);
    // 之後沒有辨識結果，但每 100ms 都聽得到人聲，持續 2 秒
    let position = ahead;
    for (let t = 2350; t <= 4250; t += 100) {
      recordVoice(motion, t);
      position = predictPosition(motion, t, MAX_INDEX);
    }
    // 最後一次靠辨識推估在 2750：8 + 4 × (0.75 + 0.4) = 12.6；之後 2850~4250 共 15 幀靠語速推進：4 × 1.5 = 6
    expect(position).toBeCloseTo(12.6 + 6);
  });

  it('靠語速推進最多超前 10 秒的量', () => {
    const motion = speakSteadily();
    for (let t = 2300; t <= 20000; t += 100) {
      recordVoice(motion, t);
      predictPosition(motion, t, MAX_INDEX);
    }
    expect(predictPosition(motion, 20000, MAX_INDEX)).toBeCloseTo(8 + 4 * 10);
  });

  it('靠語速推進超前後，辨識恢復時比對落後也不往上跳', () => {
    const motion = speakSteadily();
    for (let t = 2300; t <= 13300; t += 100) {
      recordVoice(motion, t);
      predictPosition(motion, t, MAX_INDEX);
    }
    const ahead = predictPosition(motion, 13300, MAX_INDEX);
    expect(ahead).toBeCloseTo(8 + 4 * 10);
    // 辨識恢復，實際只念到 20 附近（落後推進位置將近 30 個字）
    for (const [t, index] of [[13400, 20], [13650, 21], [13900, 23]]) {
      recordHeard(motion, t);
      recordMatch(motion, index, t);
      expect(predictPosition(motion, t, MAX_INDEX)).toBe(ahead);
    }
  });

  it('沒有人聲也沒有辨識結果時停住', () => {
    const motion = speakSteadily();
    recordVoice(motion, 2000);
    const ahead = predictPosition(motion, 2250, MAX_INDEX);
    expect(predictPosition(motion, 5000, MAX_INDEX)).toBe(ahead);
  });

  it('沒說話一陣子後，短促的雜音不會讓畫面暴衝', () => {
    const motion = speakSteadily();
    const stopped = predictPosition(motion, 4000, MAX_INDEX);
    // 安靜好幾秒後，出現 0.3 秒的雜音
    for (let t = 8000; t <= 8300; t += 50) {
      recordVoice(motion, t);
      expect(predictPosition(motion, t, MAX_INDEX)).toBe(stopped);
    }
  });

  it('安靜過後持續講話超過 1 秒，才恢復依語速推進', () => {
    const motion = speakSteadily();
    const stopped = predictPosition(motion, 4000, MAX_INDEX);
    let position = stopped;
    for (let t = 8000; t <= 9000; t += 50) {
      recordVoice(motion, t);
      position = predictPosition(motion, t, MAX_INDEX);
      if (t < 9000) expect(position).toBe(stopped);
    }
    position = predictPosition(motion, 9100, MAX_INDEX);
    expect(position).toBeGreaterThan(stopped);
  });
});
