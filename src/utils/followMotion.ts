// 依語速推估目前念到的位置：兩次辨識結果之間持續往前推，下一次比對到再校正

// 辨識結果大約落後實際說話 0.3~0.5 秒，預測時補上
const RECOGNITION_LAG = 0.4;
// 最多比最後一次比對超前多少秒的內容
const MAX_LEAD = 1.2;
// 超過這段時間沒有辨識結果，視為停頓，不再往前推
const SPEAKING_TIMEOUT = 800;
const RATE_WINDOW = 6000;
const MIN_RATE_SPAN = 1500;
const MAX_RATE = 8;
// 預測超前、實際比對落後在這個範圍內就等它追上，不倒退
const REWIND_TOLERANCE = 3;
const JUMP_DISTANCE = 40;

export interface FollowMotion {
  index: number;
  at: number;
  rate: number;
  heardAt: number;
  display: number;
  history: { t: number; index: number }[];
}

export const createMotion = (): FollowMotion => ({
  index: -1,
  at: 0,
  rate: 0,
  heardAt: 0,
  display: -1,
  history: [],
});

// 重新定位（開始跟讀、手動捲動）時使用；語速保留
export const resetMotion = (motion: FollowMotion, index: number, now: number) => {
  motion.index = index;
  motion.display = index;
  motion.at = now;
  motion.history = [];
};

export const recordHeard = (motion: FollowMotion, now: number) => {
  motion.heardAt = now;
};

export const recordMatch = (motion: FollowMotion, index: number, now: number) => {
  const isRewind = index < motion.display - REWIND_TOLERANCE;
  const isJump = index > motion.index + JUMP_DISTANCE;
  if (isRewind || isJump) {
    motion.history = [];
    motion.display = index;
  }

  if (index !== motion.index || !motion.history.length) {
    motion.history.push({ t: now, index });
    motion.history = motion.history.filter((entry) => now - entry.t <= RATE_WINDOW);
    const first = motion.history[0];
    const span = now - first.t;
    if (span >= MIN_RATE_SPAN) {
      motion.rate = Math.min(MAX_RATE, Math.max(0, ((index - first.index) / span) * 1000));
    }
  }

  motion.index = index;
  motion.at = now;
  motion.display = Math.max(motion.display, index);
};

export const predictPosition = (motion: FollowMotion, now: number, maxIndex: number) => {
  if (motion.index < 0) return motion.display;

  let predicted = motion.index;
  if (motion.rate > 0 && now - motion.heardAt < SPEAKING_TIMEOUT) {
    const lead = Math.min((now - motion.at) / 1000 + RECOGNITION_LAG, MAX_LEAD);
    predicted += motion.rate * lead;
  }

  motion.display = Math.min(maxIndex, Math.max(motion.display, predicted));
  return motion.display;
};
